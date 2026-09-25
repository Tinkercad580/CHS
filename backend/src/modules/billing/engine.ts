import { addDays, toIsoDate } from "../../core/dates";
import { prisma, type Tx } from "../../core/db";
import { applyBps, formatInr, roundToRupee, scaleDecimal, sub, ZERO, add, type Paise } from "../../core/money";
import { configNumber } from "../../core/statutory";
import { apportion, percentToBps, total, type BuildingFacts, type HeadSpec, type Line, type Problem, type Statutory, type UnitFacts } from "./domain/apportion";
import { interestForBill, type OverdueBill } from "./domain/interest";

/**
 * The billing engine: loads the facts a bill depends on, as of a date, and
 * turns them into lines. Deterministic — the same facts, rates and statutory
 * values always give the same bill (MASTER_SPEC E1), which is why every
 * input is resolved as of the period, never "now".
 */

export function rateAsOf(rates: { id: string; rate: { toString(): string }; rateByType: unknown; effectiveFrom: Date; effectiveTo: Date | null }[], asOf: Date): HeadSpec["rate"] {
  const r = rates
    .filter((x) => x.effectiveFrom <= asOf && (!x.effectiveTo || x.effectiveTo > asOf))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
  return r ? { id: r.id, rate: r.rate.toString(), rateByType: (r.rateByType as Record<string, number> | null) ?? null } : null;
}

export async function statutoryAsOf(societyId: string, asOf: Date, db: Tx = prisma): Promise<Statutory & { interestCapPercent: number; gstRatePercent: number; gstMemberThresholdPaise: Paise; gstTurnoverThresholdPaise: Paise }> {
  const n = (key: string) => configNumber(db, key, societyId, asOf);
  const [nonOcc, edu, sink, repair, cap, gstRate, gstMember, gstTurnover] = await Promise.all([
    n("non_occupancy_percent"),
    n("education_fund_min_amount_paise"),
    n("sinking_fund_min_percent"),
    n("repair_fund_min_percent"),
    n("interest_cap_percent"),
    n("gst_rate_percent"),
    n("gst_member_threshold_paise"),
    n("gst_turnover_threshold_paise"),
  ]);
  return {
    nonOccupancyPercent: nonOcc,
    educationFundMinPaise: BigInt(Math.round(edu)),
    sinkingFundMinPercent: sink,
    repairFundMinPercent: repair,
    interestCapPercent: cap,
    gstRatePercent: gstRate,
    gstMemberThresholdPaise: BigInt(Math.round(gstMember)),
    gstTurnoverThresholdPaise: BigInt(Math.round(gstTurnover)),
  };
}

export interface Facts {
  units: (UnitFacts & { payerName: string | null })[];
  buildings: Map<string, BuildingFacts>;
  manual: Map<string, Map<string, Paise>>;
}

/** Unit attributes as of a date — the snapshot each bill records (MASTER_SPEC C4). */
export async function loadFacts(societyId: string, asOf: Date, db: Tx = prisma): Promise<Facts> {
  const [units, buildings, manual] = await Promise.all([
    db.unit.findMany({
      where: { societyId, status: "ACTIVE" },
      include: {
        building: { select: { name: true } },
        occupancies: { where: { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] }, take: 1, orderBy: { effectiveFrom: "desc" } },
        parkingSlots: { where: { active: true }, select: { id: true } },
        memberships: { where: { cessationDate: null, kind: "PRIMARY" }, take: 1, include: { person: { select: { name: true } } } },
        tenancies: { where: { endedOn: null, startDate: { lte: asOf } }, take: 1, include: { tenant: { select: { name: true } } } },
      },
      orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
    }),
    db.building.findMany({ where: { societyId, deletedAt: null }, include: { units: { where: { status: "ACTIVE" }, select: { carpetAreaSqft: true } } } }),
    db.unitCharge.findMany({ where: { societyId, effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] } }),
  ]);
  const bmap = new Map<string, BuildingFacts>(
    buildings.map((b) => [
      b.id,
      {
        id: b.id,
        name: b.name,
        liftPresent: b.liftPresent,
        constructionCostPaise: b.constructionCostPaise,
        // All-or-nothing: a cost split by area needs every unit's area, else it's split equally.
        totalCarpetArea100: b.units.every((u) => u.carpetAreaSqft !== null) ? b.units.reduce((s, u) => s + scaleDecimal(u.carpetAreaSqft!.toString(), 2), 0n) : 0n,
        unitCount: b.units.length,
      },
    ]),
  );
  const mmap = new Map<string, Map<string, Paise>>();
  for (const m of manual) {
    const per = mmap.get(m.unitId) ?? new Map<string, Paise>();
    per.set(m.headId, m.amountPaise);
    mmap.set(m.unitId, per);
  }
  return {
    buildings: bmap,
    manual: mmap,
    units: units.map((u) => {
      const tenancy = u.tenancies[0];
      const owner = u.memberships[0]?.person.name ?? null;
      return {
        unitId: u.id,
        label: `${u.building.name}-${u.number}`,
        type: u.type,
        floor: u.floor,
        buildingId: u.buildingId,
        carpetAreaSqft: u.carpetAreaSqft?.toString() ?? null,
        waterInlets: u.waterInlets,
        liftServed: u.liftServed,
        occupancy: u.occupancies[0]?.status ?? null,
        parkingSlots: u.parkingSlots.length,
        hasPrimaryMember: !!u.memberships[0],
        payerName: tenancy && tenancy.billPayer === "TENANT" ? tenancy.tenant.name : owner,
      };
    }),
  };
}

/** Published, unpaid principal on a unit's bills, with the payments that reduced it — the input to interest. */
export async function overdueBills(db: Tx, societyId: string, unitIds: string[], graceDays: number, before: Date): Promise<Map<string, OverdueBill[]>> {
  const bills = await db.bill.findMany({
    where: { societyId, unitId: { in: unitIds }, status: "PUBLISHED", dueDate: { lt: before } },
    select: { id: true, unitId: true, number: true, dueDate: true, principalPaise: true, gstPaise: true, roundingPaise: true },
  });
  const allocs = bills.length
    ? await db.allocation.findMany({
        where: { billId: { in: bills.map((b) => b.id) }, bucket: "PRINCIPAL" },
        select: { billId: true, amountPaise: true, createdAt: true, payment: { select: { paidAt: true } } },
      })
    : [];
  const byBill = new Map<string, { date: Date; amountPaise: Paise }[]>();
  for (const a of allocs) {
    const list = byBill.get(a.billId!) ?? [];
    list.push({ date: a.payment.paidAt ?? a.createdAt, amountPaise: a.amountPaise });
    byBill.set(a.billId!, list);
  }
  const out = new Map<string, OverdueBill[]>();
  for (const b of bills) {
    const list = out.get(b.unitId) ?? [];
    list.push({
      billId: b.id,
      number: b.number,
      principalPaise: add(b.principalPaise, b.gstPaise, b.roundingPaise),
      interestFrom: addDays(b.dueDate, graceDays + 1),
      payments: byBill.get(b.id) ?? [],
    });
    out.set(b.unitId, list);
  }
  return out;
}

export interface ComputedBill {
  unit: Facts["units"][number];
  lines: Line[];
  principalPaise: Paise;
  interestPaise: Paise;
  gstPaise: Paise;
  roundingPaise: Paise;
  totalPaise: Paise;
  problems: Problem[];
}

export interface RunInputs {
  societyId: string;
  periodStart: Date;
  periodEnd: Date;
  months: number;
  /** Interest accrues from here — the previous run's period start, or the due dates. */
  interestWindowStart: Date | null;
  config: { interestRateBps: number; graceDays: number; roundingRule: "NEAREST_RUPEE" | "UP_RUPEE" | "NONE" };
  gstRegistered: boolean;
}

/** Compute every unit's bill for a period. No writes. */
export async function computeRun(input: RunInputs, db: Tx = prisma): Promise<{ bills: ComputedBill[]; problems: (Problem & { unitId: string | null; unitLabel: string | null })[]; snapshot: Record<string, unknown> }> {
  const asOf = input.periodStart;
  const [facts, statutory, heads] = await Promise.all([
    loadFacts(input.societyId, asOf, db),
    statutoryAsOf(input.societyId, asOf, db),
    db.chargeHead.findMany({ where: { societyId: input.societyId, active: true }, include: { rates: true } }),
  ]);
  const specs: HeadSpec[] = heads.map((h) => ({ ...h, filters: h.filters as HeadSpec["filters"], rate: rateAsOf(h.rates, asOf) }));
  const problems: (Problem & { unitId: string | null; unitLabel: string | null })[] = [];

  // B3.1 re-checked at billing time: a rate that was legal when set may not be today.
  const capBps = percentToBps(statutory.interestCapPercent);
  let interestBps = input.config.interestRateBps;
  if (interestBps > capBps) {
    problems.push({ unitId: null, unitLabel: null, code: "INTEREST_ABOVE_CAP", message: `The configured interest rate is above the ${statutory.interestCapPercent}% cap; the cap was used.` });
    interestBps = capBps;
  }

  const overdue = await overdueBills(db, input.societyId, facts.units.map((u) => u.unitId), input.config.graceDays, input.periodStart);
  const bills: ComputedBill[] = [];
  for (const unit of facts.units) {
    const building = facts.buildings.get(unit.buildingId);
    if (!building) continue;
    const { lines, problems: p } = apportion({ unit, building, heads: specs, manual: facts.manual.get(unit.unitId) ?? new Map(), months: input.months, statutory });
    for (const x of p) problems.push({ ...x, unitId: unit.unitId, unitLabel: unit.label });
    if (!unit.payerName) problems.push({ unitId: unit.unitId, unitLabel: unit.label, code: "NO_PAYER", message: `${unit.label} has no primary owner recorded` });

    // Interest on overdue principal for the window since the last run.
    let interest = ZERO;
    const basisParts: string[] = [];
    for (const b of overdue.get(unit.unitId) ?? []) {
      const windowStart = input.interestWindowStart ?? b.interestFrom;
      const r = interestForBill(b, windowStart, input.periodStart, interestBps);
      if (r.amount > ZERO) {
        interest = add(interest, r.amount);
        basisParts.push(`${b.number ?? "bill"}: ${r.days} days`);
      }
    }
    const all = [...lines];
    if (interest > ZERO) {
      all.push({
        headId: null, code: "INTEREST", label: "Interest on overdue dues", kind: "INTEREST", method: "INTEREST_SIMPLE",
        rate: String(interestBps), rateId: null, input: null,
        basis: `${interestBps / 100}% a year, simple, on unpaid principal — ${basisParts.join("; ")}`,
        ruleRef: "MCS Rules 2026, 106C-12; bye-laws (verify)", amountPaise: interest, gstApplicable: false, sortOrder: 900,
      });
    }

    // GST (B3.6): only when registered and both thresholds are crossed; then on the whole taxable amount.
    let gst = ZERO;
    const taxable = total(lines.filter((l) => l.gstApplicable));
    if (input.gstRegistered && taxable > ZERO) {
      const monthlyTotal = total(lines) / BigInt(input.months);
      if (monthlyTotal > statutory.gstMemberThresholdPaise) {
        gst = applyBps(taxable, percentToBps(statutory.gstRatePercent));
        all.push({
          headId: null, code: "GST", label: `GST ${statutory.gstRatePercent}%`, kind: "GST", method: null, rate: String(statutory.gstRatePercent), rateId: null,
          input: String(taxable), basis: `${statutory.gstRatePercent}% of ${formatInr(taxable)} taxable (monthly charges above ${formatInr(statutory.gstMemberThresholdPaise)})`,
          ruleRef: "CGST — thresholds from statutory config (verify)", amountPaise: gst, gstApplicable: false, sortOrder: 950,
        });
      }
    }

    const principal = total(lines);
    const before = add(principal, interest, gst);
    const rounded = roundToRupee(before, input.config.roundingRule);
    const rounding = sub(rounded, before);
    if (rounding !== ZERO) {
      all.push({ headId: null, code: "ROUND", label: "Rounding", kind: "ROUNDING", method: null, rate: null, rateId: null, input: null, basis: "To the nearest rupee", ruleRef: null, amountPaise: rounding, gstApplicable: false, sortOrder: 999 });
    }
    bills.push({ unit, lines: all, principalPaise: principal, interestPaise: interest, gstPaise: gst, roundingPaise: rounding, totalPaise: rounded, problems: p });
  }

  // Turnover threshold: if the society's billing, annualised, stays under it, no unit is charged GST.
  if (input.gstRegistered) {
    const annual = (bills.reduce((s, b) => s + b.principalPaise, 0n) * 12n) / BigInt(input.months);
    if (annual <= statutory.gstTurnoverThresholdPaise) {
      for (const b of bills) {
        if (b.gstPaise === ZERO) continue;
        b.lines = b.lines.filter((l) => l.kind !== "GST" && l.kind !== "ROUNDING");
        const before = add(b.principalPaise, b.interestPaise);
        const rounded = roundToRupee(before, input.config.roundingRule);
        b.gstPaise = ZERO;
        b.roundingPaise = sub(rounded, before);
        b.totalPaise = rounded;
        if (b.roundingPaise !== ZERO) b.lines.push({ headId: null, code: "ROUND", label: "Rounding", kind: "ROUNDING", method: null, rate: null, rateId: null, input: null, basis: "To the nearest rupee", ruleRef: null, amountPaise: b.roundingPaise, gstApplicable: false, sortOrder: 999 });
      }
      problems.push({ unitId: null, unitLabel: null, code: "GST_BELOW_TURNOVER", message: "Annual billing is under the GST turnover threshold, so no GST was charged." });
    }
  }

  return {
    bills,
    problems,
    snapshot: {
      asOf: toIsoDate(asOf),
      months: input.months,
      interestRateBps: interestBps,
      graceDays: input.config.graceDays,
      roundingRule: input.config.roundingRule,
      gstRegistered: input.gstRegistered,
      statutory: { ...statutory, educationFundMinPaise: String(statutory.educationFundMinPaise), gstMemberThresholdPaise: String(statutory.gstMemberThresholdPaise), gstTurnoverThresholdPaise: String(statutory.gstTurnoverThresholdPaise) },
      rates: specs.filter((h) => h.rate).map((h) => ({ head: h.code, method: h.method, rate: h.rate!.rate, rateId: h.rate!.id })),
    },
  };
}

/** Everyone who should hear about a unit's bill: its access users, owners and current tenant. */
export async function unitRecipients(societyId: string, unitIds: string[], db: Tx = prisma): Promise<Map<string, string[]>> {
  const out = new Map<string, Set<string>>(unitIds.map((u) => [u, new Set<string>()]));
  const [access, persons] = await Promise.all([
    db.societyUser.findMany({ where: { societyId, unitId: { in: unitIds }, deletedAt: null, suspendedAt: null, userType: { notIn: ["GUARD", "STAFF"] } }, select: { unitId: true, userId: true } }),
    db.person.findMany({
      where: { societyId, userId: { not: null }, deletedAt: null, OR: [{ memberships: { some: { unitId: { in: unitIds }, cessationDate: null } } }, { tenancies: { some: { unitId: { in: unitIds }, endedOn: null } } }] },
      select: { userId: true, memberships: { where: { cessationDate: null }, select: { unitId: true } }, tenancies: { where: { endedOn: null }, select: { unitId: true } } },
    }),
  ]);
  for (const a of access) out.get(a.unitId!)?.add(a.userId);
  for (const p of persons) for (const u of [...p.memberships, ...p.tenancies]) out.get(u.unitId)?.add(p.userId!);
  const active = new Set(
    (await db.societyUser.findMany({ where: { societyId, deletedAt: null, suspendedAt: null }, select: { userId: true } })).map((s) => s.userId),
  );
  return new Map([...out].map(([k, v]) => [k, [...v].filter((u) => active.has(u))]));
}
