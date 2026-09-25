import { schemas, type BillRecord } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { financialYear, fromIsoDate, toIso, toIsoDate, todayIst } from "../../core/dates";
import { Prisma, prisma, transaction, type Tx } from "../../core/db";
import { AppError, forbidden, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { add, formatInr, fromWire, min, sub, toWire, ZERO, type Paise } from "../../core/money";
import { formatNumber, nextNumber } from "../../core/numbering";
import { contains, paginate } from "../../core/pagination";
import { actingUnitIds } from "../members/members.service";
import { notifyLater } from "../notifications/notify";
import { getBillingConfig } from "../society/society.service";
import { applyAdvances } from "../payments/allocation";
import { computeRun, unitRecipients } from "./engine";

type BillRow = Prisma.BillGetPayload<{ include: { lines: true } }>;
const MONTHS = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6 } as const;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function balanceOf(b: { totalPaise: bigint; principalPaidPaise: bigint; interestPaidPaise: bigint; status: string }): Paise {
  if (b.status !== "PUBLISHED") return ZERO;
  return sub(b.totalPaise, add(b.principalPaidPaise, b.interestPaidPaise));
}

function paymentState(b: BillRow, today: Date): BillRecord["paymentState"] {
  if (b.status === "DRAFT") return "DRAFT";
  if (b.status === "CANCELLED") return "CANCELLED";
  const bal = balanceOf(b);
  if (bal <= ZERO) return "PAID";
  if (b.dueDate < today) return "OVERDUE";
  return add(b.principalPaidPaise, b.interestPaidPaise) > ZERO ? "PARTLY_PAID" : "UNPAID";
}

export function billDto(b: BillRow, unitLabel: string, today = todayIst()): BillRecord {
  const paid = add(b.principalPaidPaise, b.interestPaidPaise);
  return {
    id: b.id,
    unitId: b.unitId,
    unitLabel,
    kind: b.kind,
    status: b.status,
    paymentState: paymentState(b, today),
    number: b.number,
    fy: b.fy,
    period: b.period,
    title: b.title,
    billDate: toIsoDate(b.billDate),
    dueDate: toIsoDate(b.dueDate),
    principalPaise: toWire(b.principalPaise)!,
    interestPaise: toWire(b.interestPaise)!,
    gstPaise: toWire(b.gstPaise)!,
    totalPaise: toWire(b.totalPaise)!,
    paidPaise: toWire(paid)!,
    balancePaise: toWire(balanceOf(b))!,
    arrearsPaise: toWire(b.arrearsPaise)!,
    payerName: b.payerName,
    publishedAt: toIso(b.publishedAt),
    cancelReason: b.cancelReason,
    lines: [...b.lines]
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((l) => ({ code: l.code, label: l.label, kind: l.kind as BillRecord["lines"][number]["kind"], method: l.method, rate: l.rate, basis: l.basis, ruleRef: l.ruleRef, amountPaise: toWire(l.amountPaise)! })),
  };
}

async function labels(ids: string[], db: Tx = prisma) {
  const units = await db.unit.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, number: true, building: { select: { name: true } } } });
  return new Map(units.map((u) => [u.id, `${u.building.name}-${u.number}`]));
}

// ─── Periods ────────────────────────────────────────────────────────────────

export function periodBounds(period: string, months: number) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m - 1 + months, 0));
  return { start, end };
}

function periodTitle(start: Date, months: number) {
  const a = MONTH_NAMES[start.getUTCMonth()]!;
  if (months === 1) return `Maintenance — ${a} ${start.getUTCFullYear()}`;
  const endMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months - 1, 1));
  return `Maintenance — ${a.slice(0, 3)}–${MONTH_NAMES[endMonth.getUTCMonth()]!.slice(0, 3)} ${endMonth.getUTCFullYear()}`;
}

function defaultDueDate(periodStart: Date, generationDay: number, dueDay: number) {
  const due = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), dueDay));
  return dueDay < generationDay ? new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, dueDay)) : due;
}

// ─── Runs ───────────────────────────────────────────────────────────────────

async function writeDraftBills(tx: Prisma.TransactionClient, scope: { societyId: string }, runId: string, fyStartMonth: number, run: { periodStart: Date; periodEnd: Date; billDate: Date; dueDate: Date; period: string }, months: number) {
  const config = await getBillingConfig(scope.societyId);
  const society = await tx.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { gstRegistered: true } });
  const previous = await tx.billRun.findFirst({ where: { societyId: scope.societyId, status: "PUBLISHED", periodStart: { lt: run.periodStart } }, orderBy: { periodStart: "desc" } });
  const result = await computeRun(
    {
      societyId: scope.societyId,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      months,
      interestWindowStart: previous?.periodStart ?? null,
      config: { interestRateBps: config.interestRateBps, graceDays: config.graceDays, roundingRule: config.roundingRule },
      gstRegistered: society.gstRegistered,
    },
    tx,
  );
  // Balance brought forward, per unit, for display on the bill.
  const open = await tx.bill.findMany({ where: { societyId: scope.societyId, status: "PUBLISHED" }, select: { unitId: true, totalPaise: true, principalPaidPaise: true, interestPaidPaise: true, status: true } });
  const arrears = new Map<string, Paise>();
  for (const b of open) arrears.set(b.unitId, add(arrears.get(b.unitId) ?? ZERO, balanceOf(b)));

  await tx.bill.deleteMany({ where: { billRunId: runId, status: "DRAFT" } });
  let totalPaise = ZERO;
  let count = 0;
  const title = periodTitle(run.periodStart, months);
  const fy = financialYear(run.billDate, fyStartMonth);
  for (const b of result.bills) {
    if (b.totalPaise <= ZERO) continue;
    await tx.bill.create({
      data: {
        societyId: scope.societyId,
        billRunId: runId,
        unitId: b.unit.unitId,
        status: "DRAFT",
        fy,
        period: run.period,
        title,
        billDate: run.billDate,
        dueDate: run.dueDate,
        principalPaise: b.principalPaise,
        interestPaise: b.interestPaise,
        gstPaise: b.gstPaise,
        roundingPaise: b.roundingPaise,
        totalPaise: b.totalPaise,
        arrearsPaise: arrears.get(b.unit.unitId) ?? ZERO,
        payerName: b.unit.payerName,
        attributes: { ...b.unit } as unknown as Prisma.InputJsonValue,
        lines: {
          create: b.lines.map((l, i) => ({
            headId: l.headId,
            code: l.code,
            label: l.label,
            kind: l.kind,
            method: l.method,
            rate: l.rate,
            rateId: l.rateId,
            input: l.input,
            basis: l.basis.slice(0, 200),
            ruleRef: l.ruleRef,
            amountPaise: l.amountPaise,
            sortOrder: l.sortOrder * 10 + i,
          })),
        },
      },
    });
    totalPaise = add(totalPaise, b.totalPaise);
    count++;
  }
  await tx.billRun.update({
    where: { id: runId },
    data: {
      billCount: count,
      totalPaise,
      snapshot: result.snapshot as Prisma.InputJsonValue,
      exceptions: result.problems.slice(0, 500) as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function createRun(scope: SocietyScope, userId: string, body: z.output<typeof schemas.billing.CreateBillRunBody>) {
  const config = await getBillingConfig(scope.societyId);
  if (!config.updatedAt) throw new AppError("PRECONDITION_FAILED", "Set up billing configuration before generating bills.");
  const months = MONTHS[config.cycle];
  const { start, end } = periodBounds(body.period, months);
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { fyStartMonth: true } });
  const billDate = body.billDate ? fromIsoDate(body.billDate) : start;
  const dueDate = body.dueDate ? fromIsoDate(body.dueDate) : defaultDueDate(start, config.generationDay, config.dueDay);
  if (dueDate < billDate) throw new AppError("VALIDATION_FAILED", "The due date can't be before the bill date.");
  const heads = await prisma.chargeHead.count({ where: { societyId: scope.societyId, active: true } });
  if (!heads) throw new AppError("PRECONDITION_FAILED", "Add charge heads before generating bills.");

  const runId = await transaction(prisma, async (tx) => {
    const clash = await tx.billRun.findFirst({ where: { societyId: scope.societyId, period: body.period, status: { not: "DISCARDED" } } });
    if (clash) throw new AppError("CONFLICT", `A ${clash.status.toLowerCase()} run for ${body.period} already exists.`, { runId: clash.id });
    const later = await tx.billRun.findFirst({ where: { societyId: scope.societyId, status: "PUBLISHED", periodStart: { gte: start } } });
    if (later) throw new AppError("BUSINESS_RULE_VIOLATION", `${later.period} is already published; periods are billed in order.`);
    const run = await tx.billRun.create({ data: { societyId: scope.societyId, period: body.period, periodStart: start, periodEnd: end, billDate, dueDate, createdById: userId } });
    await writeDraftBills(tx, scope, run.id, society.fyStartMonth, { ...run }, months);
    await audit(tx, { action: "bill_run.create", entity: "bill_run", entityId: run.id, after: { period: body.period } });
    return run.id;
  }, 120_000);
  events.emit({ name: "billing.changed", to: { admins: scope.societyId }, payload: { unitId: null } });
  return preview(scope.societyId, runId);
}

export async function recompute(scope: SocietyScope, runId: string) {
  const config = await getBillingConfig(scope.societyId);
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { fyStartMonth: true } });
  await transaction(prisma, async (tx) => {
    const run = await tx.billRun.findFirst({ where: { id: runId, societyId: scope.societyId } });
    if (!run) throw notFound("Bill run");
    if (run.status !== "DRAFT") throw new AppError("CONFLICT", "Only a draft run can be recomputed.");
    await writeDraftBills(tx, scope, run.id, society.fyStartMonth, run, MONTHS[config.cycle]);
  }, 120_000);
  return preview(scope.societyId, runId);
}

export async function discard(scope: SocietyScope, runId: string) {
  await transaction(prisma, async (tx) => {
    const run = await tx.billRun.findFirst({ where: { id: runId, societyId: scope.societyId } });
    if (!run) throw notFound("Bill run");
    if (run.status !== "DRAFT") throw new AppError("CONFLICT", "Published runs can't be discarded — cancel individual bills instead.");
    await tx.billLine.deleteMany({ where: { bill: { billRunId: runId } } });
    await tx.bill.deleteMany({ where: { billRunId: runId } });
    await tx.billRun.update({ where: { id: runId }, data: { status: "DISCARDED", billCount: 0, totalPaise: 0n } });
    await audit(tx, { action: "bill_run.discard", entity: "bill_run", entityId: runId });
  });
  events.emit({ name: "billing.changed", to: { admins: scope.societyId }, payload: { unitId: null } });
  return { ok: true as const };
}

/**
 * Publish: gapless numbers in unit order, ledger debits, unit advances applied
 * to the new bills, units marked billed — all in one transaction. Residents
 * are told after it commits.
 */
export async function publishRun(scope: SocietyScope, userId: string, runId: string) {
  const config = await getBillingConfig(scope.societyId);
  const published = await transaction(prisma, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM bill_runs WHERE id = ${runId}::uuid AND society_id = ${scope.societyId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound("Bill run");
    const run = await tx.billRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status !== "DRAFT") throw new AppError("CONFLICT", "This run has already been published.");
    const society = await tx.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { code: true } });
    const bills = await tx.bill.findMany({ where: { billRunId: runId, status: "DRAFT" }, include: { lines: true } });
    const label = await labels(bills.map((b) => b.unitId), tx);
    bills.sort((a, b) => label.get(a.unitId)!.localeCompare(label.get(b.unitId)!, "en", { numeric: true }));
    const now = new Date();
    for (const b of bills) {
      const seq = await nextNumber(tx, scope.societyId, "BILL", b.fy);
      await tx.bill.update({ where: { id: b.id }, data: { status: "PUBLISHED", number: formatNumber(config.billNumberFormat, { code: society.code, fy: b.fy, seq }), publishedAt: now } });
      await tx.ledgerEntry.create({
        data: { societyId: scope.societyId, unitId: b.unitId, date: b.billDate, kind: "BILL", refType: "bill", refId: b.id, debitPaise: b.totalPaise, narration: b.title },
      });
    }
    await tx.unit.updateMany({ where: { id: { in: bills.map((b) => b.unitId) }, firstBilledAt: null }, data: { firstBilledAt: now } });
    await tx.billRun.update({ where: { id: runId }, data: { status: "PUBLISHED", publishedAt: now, publishedById: userId } });
    for (const unitId of new Set(bills.map((b) => b.unitId))) await applyAdvances(tx, scope.societyId, unitId, config.allocationOrder);
    await audit(tx, { action: "bill_run.publish", entity: "bill_run", entityId: runId, after: { bills: bills.length, totalPaise: run.totalPaise } });
    return { run, bills };
  }, 180_000);

  const recipients = await unitRecipients(scope.societyId, published.bills.map((b) => b.unitId));
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { name: true } });
  for (const b of published.bills) {
    const users = recipients.get(b.unitId) ?? [];
    if (!users.length) continue;
    notifyLater({
      societyId: scope.societyId,
      userIds: users,
      category: "BILLING",
      title: `${b.title.replace("Maintenance — ", "")} bill is out`,
      body: `${formatInr(b.totalPaise)} for ${(await labels([b.unitId])).get(b.unitId)}, due ${toIsoDate(b.dueDate)}.`,
      data: { route: `/bills/${b.id}`, billId: b.id },
      email: { subject: `${society.name}: ${b.title}`, text: billEmailText(b, society.name) },
    });
  }
  events.emit({ name: "billing.changed", to: { society: scope.societyId }, payload: { unitId: null } });
  return preview(scope.societyId, runId);
}

function billEmailText(b: BillRow, society: string) {
  const lines = [...b.lines].sort((x, y) => x.sortOrder - y.sortOrder).map((l) => `${l.label}: ${formatInr(l.amountPaise)} — ${l.basis}`);
  return `${b.title} from ${society}.\n\n${lines.join("\n")}\n\nTotal ${formatInr(b.totalPaise)}, due ${toIsoDate(b.dueDate)}.${b.arrearsPaise > ZERO ? `\n\nBalance brought forward: ${formatInr(b.arrearsPaise)}.` : ""}\n\nPay in the Sahaj app.`;
}

export async function listRuns(societyId: string) {
  const runs = await prisma.billRun.findMany({ where: { societyId, status: { not: "DISCARDED" } }, orderBy: { periodStart: "desc" }, take: 60 });
  return runs.map(runSummary);
}

function runSummary(r: Prisma.BillRunGetPayload<object>) {
  return {
    id: r.id,
    period: r.period,
    periodStart: toIsoDate(r.periodStart),
    periodEnd: toIsoDate(r.periodEnd),
    billDate: toIsoDate(r.billDate),
    dueDate: toIsoDate(r.dueDate),
    status: r.status,
    billCount: r.billCount,
    totalPaise: toWire(r.totalPaise)!,
    publishedAt: toIso(r.publishedAt),
    createdAt: toIso(r.createdAt),
  };
}

export async function preview(societyId: string, runId: string) {
  const run = await prisma.billRun.findFirst({ where: { id: runId, societyId } });
  if (!run) throw notFound("Bill run");
  const bills = await prisma.bill.findMany({ where: { billRunId: runId }, include: { lines: true } });
  const units = await prisma.unit.findMany({ where: { id: { in: bills.map((b) => b.unitId) } }, select: { id: true, number: true, building: { select: { name: true } } } });
  const unitBy = new Map(units.map((u) => [u.id, u]));
  const byHead = new Map<string, { code: string; label: string; totalPaise: Paise; units: number }>();
  const byBuilding = new Map<string, { buildingName: string; totalPaise: Paise; bills: number }>();
  for (const b of bills) {
    const bn = unitBy.get(b.unitId)?.building.name ?? "?";
    const e = byBuilding.get(bn) ?? { buildingName: bn, totalPaise: ZERO, bills: 0 };
    e.totalPaise = add(e.totalPaise, b.totalPaise);
    e.bills++;
    byBuilding.set(bn, e);
    for (const l of b.lines) {
      const h = byHead.get(l.code) ?? { code: l.code, label: l.label, totalPaise: ZERO, units: 0 };
      h.totalPaise = add(h.totalPaise, l.amountPaise);
      h.units++;
      byHead.set(l.code, h);
    }
  }
  // Variance against the last published run: anything moving more than 10% is worth a look before publishing.
  const prev = await prisma.billRun.findFirst({ where: { societyId, status: "PUBLISHED", periodStart: { lt: run.periodStart } }, orderBy: { periodStart: "desc" } });
  const variances = [];
  if (prev) {
    const prevBills = await prisma.bill.findMany({ where: { billRunId: prev.id, status: { not: "DRAFT" } }, select: { unitId: true, totalPaise: true } });
    const prevBy = new Map(prevBills.map((b) => [b.unitId, b.totalPaise]));
    for (const b of bills) {
      const p = prevBy.get(b.unitId);
      if (!p || p === ZERO) continue;
      const changeBps = Number(((b.totalPaise - p) * 10_000n) / p);
      if (Math.abs(changeBps) > 1000) {
        const u = unitBy.get(b.unitId)!;
        variances.push({ unitId: b.unitId, unitLabel: `${u.building.name}-${u.number}`, previousPaise: toWire(p)!, currentPaise: toWire(b.totalPaise)!, changeBps });
      }
    }
  }
  const exceptions = (run.exceptions as { unitId: string | null; unitLabel: string | null; code: string; message: string }[]) ?? [];
  return {
    ...runSummary(run),
    byHead: [...byHead.values()].map((h) => ({ ...h, totalPaise: toWire(h.totalPaise)! })),
    byBuilding: [...byBuilding.values()].sort((a, b) => a.buildingName.localeCompare(b.buildingName)).map((b) => ({ ...b, totalPaise: toWire(b.totalPaise)! })),
    variances: variances.sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps)).slice(0, 200),
    exceptions,
  };
}

// ─── Bills ──────────────────────────────────────────────────────────────────

/** Units whose label matches the search: "A-1204" / "A 12" → building A, number starting 12. */
async function unitIdsForLabel(societyId: string, q: string): Promise<string[]> {
  const m = /^(.+?)[-\s/]+(\w*)$/.exec(q.trim());
  if (!m) return [];
  const units = await prisma.unit.findMany({ where: { societyId, building: { name: { equals: m[1]!, mode: "insensitive" } }, number: { startsWith: m[2]!, mode: "insensitive" } }, select: { id: true }, take: 500 });
  return units.map((u) => u.id);
}

function billWhere(societyId: string, q: z.output<typeof schemas.billing.BillListQuery>, today: Date, labelUnits: string[] = []): Prisma.BillWhereInput {
  return {
    societyId,
    ...(q.unitId ? { unitId: q.unitId } : {}),
    ...(q.period ? { period: q.period } : {}),
    ...(q.status ? { status: q.status } : { status: { not: "DRAFT" } }),
    ...(q.state ? { status: "PUBLISHED" as const } : {}),
    ...(q.state === "OVERDUE" ? { dueDate: { lt: today } } : {}),
    ...(q.q ? { OR: [{ number: contains(q.q) }, { title: contains(q.q) }, { payerName: contains(q.q) }, ...(labelUnits.length ? [{ unitId: { in: labelUnits } }] : [])] } : {}),
  };
}

/** Ids of published bills that are settled (or not) — a comparison of three columns Prisma can't express. */
async function billIdsBySettled(societyId: string, settled: boolean): Promise<string[]> {
  const rows = settled
    ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM bills WHERE society_id = ${societyId}::uuid AND status = 'PUBLISHED' AND total_paise <= principal_paid_paise + interest_paid_paise`
    : await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM bills WHERE society_id = ${societyId}::uuid AND status = 'PUBLISHED' AND total_paise > principal_paid_paise + interest_paid_paise`;
  return rows.map((r) => r.id);
}

export async function listBills(societyId: string, q: z.output<typeof schemas.billing.BillListQuery>, unitScope?: string[]) {
  const today = todayIst();
  const byState = q.state ? { id: { in: await billIdsBySettled(societyId, q.state === "PAID") } } : {};
  const labelUnits = q.q ? await unitIdsForLabel(societyId, q.q) : [];
  const where = { ...billWhere(societyId, q, today, labelUnits), ...byState, ...(unitScope ? { unitId: q.unitId && unitScope.includes(q.unitId) ? q.unitId : { in: unitScope } } : {}) };
  const page = await paginate(
    q.limit,
    q.cursor,
    (p) => prisma.bill.findMany({ where, include: { lines: true }, orderBy: [{ billDate: "desc" }, { id: "desc" }], ...p }),
    (b) => b,
    () => prisma.bill.count({ where }),
  );
  const label = await labels(page.items.map((b) => b.unitId));
  return { ...page, items: page.items.map((b) => billDto(b, label.get(b.unitId) ?? "", today)) };
}

async function assertCanSeeUnit(scope: SocietyScope, userId: string, unitId: string) {
  const staff = ["billing.generate", "billing.publish", "payments.record", "accounts.manage", "accounts.view"].some((p) => scope.permissions.has(p as never));
  if (staff) return;
  if (!(await actingUnitIds(prisma, scope, userId)).has(unitId)) throw forbidden("You can only see your own unit's bills.");
}

export async function getBill(scope: SocietyScope, userId: string, id: string) {
  const b = await prisma.bill.findFirst({ where: { id, societyId: scope.societyId }, include: { lines: true } });
  if (!b) throw notFound("Bill");
  await assertCanSeeUnit(scope, userId, b.unitId);
  if (b.status === "DRAFT" && !scope.permissions.has("billing.generate")) throw notFound("Bill");
  return billDto(b, (await labels([b.unitId])).get(b.unitId) ?? "");
}

export async function cancelBill(scope: SocietyScope, id: string, reason: string) {
  const b = await transaction(prisma, async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id, societyId: scope.societyId }, include: { lines: true } });
    if (!bill) throw notFound("Bill");
    if (bill.status !== "PUBLISHED") throw new AppError("CONFLICT", "Only a published bill can be cancelled.");
    if (add(bill.principalPaidPaise, bill.interestPaidPaise) > ZERO) {
      throw new AppError("BUSINESS_RULE_VIOLATION", "This bill has payments against it. Issue a credit note instead, or cancel the receipt first.");
    }
    const after = await tx.bill.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason }, include: { lines: true } });
    await tx.ledgerEntry.create({
      data: { societyId: scope.societyId, unitId: bill.unitId, date: todayIst(), kind: "REVERSAL", refType: "bill", refId: bill.id, creditPaise: bill.totalPaise, narration: `Cancelled ${bill.number}: ${reason}`.slice(0, 200) },
    });
    await audit(tx, { action: "bill.cancel", entity: "bill", entityId: id, before: { status: "PUBLISHED" }, after: { status: "CANCELLED", reason } });
    return after;
  });
  events.emit({ name: "billing.changed", to: { admins: scope.societyId, unit: b.unitId }, payload: { unitId: b.unitId } });
  return billDto(b, (await labels([b.unitId])).get(b.unitId) ?? "");
}

/** Supplementary bills, published at once with their own numbers — repair contributions, penalties, NOC fees. */
export async function adhocBills(scope: SocietyScope, body: z.output<typeof schemas.billing.AdhocBillBody>) {
  const config = await getBillingConfig(scope.societyId);
  const due = fromIsoDate(body.dueDate);
  const today = todayIst();
  if (due < today) throw new AppError("VALIDATION_FAILED", "The due date is in the past.");
  const created = await transaction(prisma, async (tx) => {
    const society = await tx.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { code: true, fyStartMonth: true } });
    const units = await tx.unit.findMany({
      where: { societyId: scope.societyId, id: { in: body.unitIds } },
      select: {
        id: true,
        memberships: { where: { cessationDate: null, kind: "PRIMARY" }, take: 1, select: { person: { select: { name: true } } } },
        tenancies: { where: { endedOn: null }, take: 1, select: { billPayer: true, tenant: { select: { name: true } } } },
      },
    });
    if (units.length !== new Set(body.unitIds).size) throw new AppError("VALIDATION_FAILED", "Some units aren't in this society.");
    const fy = financialYear(today, society.fyStartMonth);
    const total = body.lines.reduce((s, l) => add(s, fromWire(l.amountPaise)!), ZERO);
    const out: BillRow[] = [];
    for (const u of units) {
      const seq = await nextNumber(tx, scope.societyId, "BILL", fy);
      const b = await tx.bill.create({
        data: {
          societyId: scope.societyId,
          unitId: u.id,
          kind: "SUPPLEMENTARY",
          status: "DRAFT",
          fy,
          period: toIsoDate(today).slice(0, 7),
          title: body.title,
          billDate: today,
          dueDate: due,
          principalPaise: total,
          totalPaise: total,
          payerName: u.tenancies[0]?.billPayer === "TENANT" ? u.tenancies[0].tenant.name : (u.memberships[0]?.person.name ?? null),
          lines: { create: body.lines.map((l, i) => ({ headId: l.headId ?? null, code: "ADHOC", label: l.label, kind: "ADHOC", basis: "Supplementary charge", amountPaise: fromWire(l.amountPaise)!, sortOrder: i })) },
        },
        include: { lines: true },
      });
      const pub = await tx.bill.update({ where: { id: b.id }, data: { status: "PUBLISHED", publishedAt: new Date(), number: formatNumber(config.billNumberFormat, { code: society.code, fy, seq }) }, include: { lines: true } });
      await tx.ledgerEntry.create({ data: { societyId: scope.societyId, unitId: u.id, date: today, kind: "BILL", refType: "bill", refId: b.id, debitPaise: total, narration: body.title } });
      out.push(pub);
    }
    await audit(tx, { action: "bill.adhoc", entity: "society", entityId: scope.societyId, after: { units: units.length, title: body.title, totalPaise: total } });
    return out;
  });
  const recipients = await unitRecipients(scope.societyId, created.map((b) => b.unitId));
  const label = await labels(created.map((b) => b.unitId));
  for (const b of created) {
    notifyLater({ societyId: scope.societyId, userIds: recipients.get(b.unitId) ?? [], category: "BILLING", title: body.title, body: `${formatInr(b.totalPaise)} for ${label.get(b.unitId)}, due ${body.dueDate}.`, data: { route: `/bills/${b.id}`, billId: b.id } });
  }
  events.emit({ name: "billing.changed", to: { society: scope.societyId }, payload: { unitId: null } });
  return { created: created.length, bills: created.map((b) => billDto(b, label.get(b.unitId) ?? "")) };
}

// ─── Ledger, credit notes, dues ─────────────────────────────────────────────

export async function advanceOf(db: Tx, unitId: string): Promise<Paise> {
  const r = await db.allocation.aggregate({ where: { unitId, bucket: "ADVANCE" }, _sum: { amountPaise: true } });
  return r._sum.amountPaise ?? ZERO;
}

export async function ledger(scope: SocietyScope, userId: string, unitId: string, q: { from?: string | undefined; to?: string | undefined }) {
  await assertCanSeeUnit(scope, userId, unitId);
  const unit = await prisma.unit.findFirst({ where: { id: unitId, societyId: scope.societyId }, include: { building: { select: { name: true } } } });
  if (!unit) throw notFound("Unit");
  const entries = await prisma.ledgerEntry.findMany({ where: { unitId, societyId: scope.societyId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  let balance = ZERO;
  const from = q.from ? fromIsoDate(q.from) : null;
  const to = q.to ? fromIsoDate(q.to) : null;
  const rows = [];
  for (const e of entries) {
    balance = add(balance, sub(e.debitPaise, e.creditPaise));
    if ((from && e.date < from) || (to && e.date > to)) continue;
    rows.push({ id: e.id, date: toIsoDate(e.date), kind: e.kind, narration: e.narration, debitPaise: toWire(e.debitPaise)!, creditPaise: toWire(e.creditPaise)!, balancePaise: toWire(balance)!, refType: e.refType, refId: e.refId });
  }
  return { unitId, unitLabel: `${unit.building.name}-${unit.number}`, entries: rows, balancePaise: toWire(balance)!, advancePaise: toWire(await advanceOf(prisma, unitId))! };
}

export async function creditNote(scope: SocietyScope, userId: string, unitId: string, body: z.output<typeof schemas.billing.CreditNoteBody>) {
  const amount = fromWire(body.amountPaise)!;
  const note = await transaction(prisma, async (tx) => {
    const unit = await tx.unit.findFirst({ where: { id: unitId, societyId: scope.societyId } });
    if (!unit) throw notFound("Unit");
    const bills = body.billId
      ? await tx.bill.findMany({ where: { id: body.billId, unitId, status: "PUBLISHED" } })
      : await tx.bill.findMany({ where: { unitId, status: "PUBLISHED" }, orderBy: [{ dueDate: "asc" }] });
    const openBalance = bills.reduce((s, b) => add(s, balanceOf(b)), ZERO);
    if (!bills.length || openBalance <= ZERO) throw new AppError("NOTHING_DUE", "There is nothing outstanding to credit.");
    if (amount > openBalance) throw new AppError("BUSINESS_RULE_VIOLATION", `The credit can't exceed what is outstanding (${formatInr(openBalance)}).`);
    const society = await tx.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { code: true, fyStartMonth: true } });
    const fy = financialYear(todayIst(), society.fyStartMonth);
    const seq = await nextNumber(tx, scope.societyId, "CREDIT_NOTE", fy);
    const cn = await tx.creditNote.create({
      data: { societyId: scope.societyId, unitId, billId: body.billId ?? null, number: formatNumber("{CODE}/CN/{FY}/{SEQ}", { code: society.code, fy, seq }), amountPaise: amount, reason: body.reason, createdById: userId },
    });
    // A credit reduces principal on the named bill, or the oldest ones first.
    let left = amount;
    for (const b of bills) {
      if (left <= ZERO) break;
      const principalOpen = sub(add(b.principalPaise, b.gstPaise, b.roundingPaise), b.principalPaidPaise);
      const take = min(left, principalOpen);
      if (take > ZERO) {
        await tx.bill.update({ where: { id: b.id }, data: { principalPaidPaise: { increment: take } } });
        left = sub(left, take);
      }
    }
    await tx.ledgerEntry.create({ data: { societyId: scope.societyId, unitId, date: todayIst(), kind: "CREDIT_NOTE", refType: "credit_note", refId: cn.id, creditPaise: amount, narration: `Credit note ${cn.number}: ${body.reason}`.slice(0, 200) } });
    await audit(tx, { action: "credit_note.create", entity: "credit_note", entityId: cn.id, after: { amountPaise: amount, reason: body.reason } });
    return cn;
  });
  events.emit({ name: "billing.changed", to: { admins: scope.societyId, unit: unitId }, payload: { unitId } });
  return { id: note.id, number: note.number, unitId, amountPaise: toWire(note.amountPaise)!, reason: note.reason, createdAt: toIso(note.createdAt) };
}

export async function duesFor(societyId: string, unitIds: string[]) {
  const today = todayIst();
  const [bills, label] = await Promise.all([
    prisma.bill.findMany({ where: { societyId, unitId: { in: unitIds }, status: "PUBLISHED" }, include: { lines: true }, orderBy: [{ dueDate: "asc" }, { billDate: "asc" }] }),
    labels(unitIds),
  ]);
  const out = [];
  for (const unitId of unitIds) {
    const open = bills.filter((b) => b.unitId === unitId && balanceOf(b) > ZERO);
    const latest = open.reduce<BillRow | null>((l, b) => (!l || b.billDate > l.billDate ? b : l), null);
    let current = ZERO;
    let arrears = ZERO;
    let interest = ZERO;
    for (const b of open) {
      const interestOpen = sub(b.interestPaise, b.interestPaidPaise);
      interest = add(interest, interestOpen);
      const principalOpen = sub(balanceOf(b), interestOpen);
      if (b === latest) current = add(current, principalOpen);
      else arrears = add(arrears, principalOpen);
    }
    const nextDue = open.find((b) => b.dueDate >= today)?.dueDate ?? open[0]?.dueDate ?? null;
    const overdueSince = open.find((b) => b.dueDate < today)?.dueDate ?? null;
    out.push({
      unitId,
      unitLabel: label.get(unitId) ?? "",
      currentPaise: toWire(current)!,
      arrearsPaise: toWire(arrears)!,
      interestPaise: toWire(interest)!,
      totalDuePaise: toWire(add(current, arrears, interest))!,
      advancePaise: toWire(await advanceOf(prisma, unitId))!,
      nextDueDate: toIsoDate(nextDue),
      overdueSince: toIsoDate(overdueSince),
      daysLeft: nextDue ? Math.round((nextDue.getTime() - today.getTime()) / 86_400_000) : null,
      openBills: open.map((b) => billDto(b, label.get(unitId) ?? "", today)),
    });
  }
  return out;
}

export async function myDues(scope: SocietyScope, userId: string) {
  const units = [...(await actingUnitIds(prisma, scope, userId))];
  return duesFor(scope.societyId, units);
}

export async function myBills(scope: SocietyScope, userId: string, q: z.output<typeof schemas.billing.BillListQuery>) {
  const units = [...(await actingUnitIds(prisma, scope, userId))];
  if (!units.length) return { items: [], nextCursor: null, total: 0 };
  return listBills(scope.societyId, { ...q, status: q.status ?? "PUBLISHED" }, units);
}

