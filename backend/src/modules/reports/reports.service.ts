import ExcelJS from "exceljs";
import { schemas, type ReportData } from "@chs/contract";
import type { z } from "zod";
import type { SocietyScope } from "../../core/context";
import { addDays, fromIsoDate, toIsoDate, todayIst } from "../../core/dates";
import { prisma } from "../../core/db";
import { AppError, notFound } from "../../core/errors";
import { add, formatInr, sub, toWire, ZERO, type Paise } from "../../core/money";
import { defineJob } from "../../core/queue";
import { balanceOf } from "../billing/bills.service";
import { sendReportEmail } from "../notifications/notify";

type ReportType = (typeof schemas.reports.REPORT_TYPES)[number];
type Params = z.output<typeof schemas.reports.ReportParams>;

const fyStart = (d: Date, month: number) => new Date(Date.UTC(d.getUTCMonth() + 1 >= month ? d.getUTCFullYear() : d.getUTCFullYear() - 1, month - 1, 1));
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const label = (u: { number: string; building: { name: string } }) => `${u.building.name}-${u.number}`;

// ─── Dashboard (MASTER_SPEC C18) ────────────────────────────────────────────

export async function dashboard(societyId: string) {
  const today = todayIst();
  const society = await prisma.society.findUniqueOrThrow({ where: { id: societyId }, select: { fyStartMonth: true } });
  const fy = fyStart(today, society.fyStartMonth);
  const month = monthStart(today);
  const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const nextFy = new Date(Date.UTC(fy.getUTCFullYear() + 1, fy.getUTCMonth(), 1));
  // Bounded both ends: a run published early for next month isn't "billed this month".
  const sumBills = (from: Date, to: Date) => prisma.bill.aggregate({ where: { societyId, status: "PUBLISHED", billDate: { gte: from, lt: to } }, _sum: { totalPaise: true } });
  const sumPaid = (from: Date, to: Date) => prisma.payment.aggregate({ where: { societyId, status: "SUCCESS", paidAt: { gte: from, lt: to } }, _sum: { amountPaise: true } });
  const [units, bm, bf, pm, pf, open, occ, approvals, active, invited, notices] = await Promise.all([
    prisma.unit.count({ where: { societyId, status: "ACTIVE" } }),
    sumBills(month, nextMonth),
    sumBills(fy, nextFy),
    sumPaid(month, nextMonth),
    sumPaid(fy, nextFy),
    prisma.bill.findMany({ where: { societyId, status: "PUBLISHED" }, select: { unitId: true, dueDate: true, totalPaise: true, principalPaidPaise: true, interestPaidPaise: true, status: true } }),
    prisma.occupancy.groupBy({ by: ["status"], where: { societyId, effectiveTo: null }, _count: true }),
    prisma.memberApproval.count({ where: { societyId, status: "PENDING" } }),
    prisma.societyUser.count({ where: { societyId, deletedAt: null, suspendedAt: null, user: { passwordHash: { not: null } } } }),
    prisma.societyUser.count({ where: { societyId, deletedAt: null, suspendedAt: null, user: { passwordHash: null } } }),
    prisma.notice.count({ where: { societyId, status: { not: "DRAFT" }, publishedAt: { gte: month } } }),
  ]);
  const ageing = { notYetDue: ZERO, d0_30: ZERO, d31_60: ZERO, d61_90: ZERO, d90plus: ZERO };
  const perUnit = new Map<string, { due: Paise; oldest: Date }>();
  let outstanding = ZERO;
  for (const b of open) {
    const bal = balanceOf(b);
    if (bal <= ZERO) continue;
    outstanding = add(outstanding, bal);
    const age = Math.floor((today.getTime() - b.dueDate.getTime()) / 86_400_000);
    if (age < 0) ageing.notYetDue = add(ageing.notYetDue, bal);
    else if (age <= 30) ageing.d0_30 = add(ageing.d0_30, bal);
    else if (age <= 60) ageing.d31_60 = add(ageing.d31_60, bal);
    else if (age <= 90) ageing.d61_90 = add(ageing.d61_90, bal);
    else ageing.d90plus = add(ageing.d90plus, bal);
    const e = perUnit.get(b.unitId) ?? { due: ZERO, oldest: b.dueDate };
    e.due = add(e.due, bal);
    if (b.dueDate < e.oldest) e.oldest = b.dueDate;
    perUnit.set(b.unitId, e);
  }
  // Defaulters are overdue, not merely billed: something past its due date.
  const top = [...perUnit].filter(([, v]) => v.oldest < today).sort((a, b) => (b[1].due > a[1].due ? 1 : b[1].due < a[1].due ? -1 : 0)).slice(0, 10);
  const topUnits = await prisma.unit.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, number: true, building: { select: { name: true } }, memberships: { where: { cessationDate: null, kind: "PRIMARY" }, take: 1, select: { person: { select: { name: true } } } } },
  });
  const billedFy = bf._sum.totalPaise ?? ZERO;
  const collectedFy = pf._sum.amountPaise ?? ZERO;
  return {
    asOf: toIsoDate(today),
    units,
    billedThisMonthPaise: toWire(bm._sum.totalPaise ?? ZERO)!,
    collectedThisMonthPaise: toWire(pm._sum.amountPaise ?? ZERO)!,
    billedFyPaise: toWire(billedFy)!,
    collectedFyPaise: toWire(collectedFy)!,
    collectionEfficiencyBps: billedFy > ZERO ? Number((collectedFy * 10_000n) / billedFy) : null,
    outstandingPaise: toWire(outstanding)!,
    monthly: await monthlySeries(societyId, month),
    ageing: { notYetDue: toWire(ageing.notYetDue)!, d0_30: toWire(ageing.d0_30)!, d31_60: toWire(ageing.d31_60)!, d61_90: toWire(ageing.d61_90)!, d90plus: toWire(ageing.d90plus)! },
    topDefaulters: top.map(([id, v]) => {
      const u = topUnits.find((x) => x.id === id);
      return { unitId: id, unitLabel: u ? label(u) : "", ownerName: u?.memberships[0]?.person.name ?? null, duePaise: toWire(v.due)!, oldestDueDate: toIsoDate(v.oldest) };
    }),
    occupancy: Object.fromEntries(occ.map((o) => [o.status, o._count])),
    pendingApprovals: approvals,
    activeUsers: active,
    invitedUsers: invited,
    noticesThisMonth: notices,
  };
}

async function monthlySeries(societyId: string, currentMonth: Date) {
  const start = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 5, 1));
  const [billed, paid] = await Promise.all([
    prisma.$queryRaw<{ m: string; s: bigint }[]>`SELECT to_char(bill_date, 'YYYY-MM') AS m, sum(total_paise) AS s FROM bills WHERE society_id = ${societyId}::uuid AND status = 'PUBLISHED' AND bill_date >= ${start} GROUP BY 1`,
    prisma.$queryRaw<{ m: string; s: bigint }[]>`SELECT to_char(paid_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS m, sum(amount_paise) AS s FROM payments WHERE society_id = ${societyId}::uuid AND status = 'SUCCESS' AND paid_at >= ${start} GROUP BY 1`,
  ]);
  const b = new Map(billed.map((r) => [r.m, r.s]));
  const p = new Map(paid.map((r) => [r.m, r.s]));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const m = toIsoDate(d).slice(0, 7);
    return { month: m, billedPaise: toWire(b.get(m) ?? ZERO)!, collectedPaise: toWire(p.get(m) ?? ZERO)! };
  });
}

// ─── Report library ─────────────────────────────────────────────────────────

const money = (key: string, l: string) => ({ key, label: l, kind: "money" as const });
const text = (key: string, l: string) => ({ key, label: l, kind: "text" as const });
const date = (key: string, l: string) => ({ key, label: l, kind: "date" as const });

function range(p: Params, fallbackDays = 30) {
  const to = p.to ? fromIsoDate(p.to) : todayIst();
  const from = p.from ? fromIsoDate(p.from) : addDays(to, -fallbackDays);
  if (from > to) throw new AppError("VALIDATION_FAILED", "The start date is after the end date.");
  return { from, toExclusive: addDays(to, 1), text: `${toIsoDate(from)} to ${toIsoDate(to)}` };
}

export async function runReport(societyId: string, type: ReportType, p: Params): Promise<ReportData> {
  switch (type) {
    case "COLLECTIONS": {
      const r = range(p);
      const rows = await prisma.payment.findMany({ where: { societyId, status: { in: ["SUCCESS", "REVERSED"] }, paidAt: { gte: r.from, lt: r.toExclusive } }, include: { receipt: true }, orderBy: { paidAt: "asc" } });
      const units = await unitLabels(rows.map((x) => x.unitId));
      const byMode: Record<string, number> = {};
      for (const x of rows) if (x.status === "SUCCESS") byMode[x.mode] = (byMode[x.mode] ?? 0) + toWire(x.amountPaise)!;
      return {
        type, title: "Collections", subtitle: r.text,
        columns: [date("date", "Date"), text("receipt", "Receipt"), text("unit", "Unit"), text("mode", "Mode"), text("status", "Status"), money("amount", "Amount")],
        rows: rows.map((x) => ({ date: toIsoDate(x.paidAt!), receipt: x.receipt?.number ?? null, unit: units.get(x.unitId) ?? "", mode: x.mode, status: x.status === "REVERSED" ? "Cancelled" : "Received", amount: x.status === "SUCCESS" ? toWire(x.amountPaise)! : 0 })),
        totals: { amount: Object.values(byMode).reduce((a, b) => a + b, 0), ...Object.fromEntries(Object.entries(byMode).map(([k, v]) => [`mode_${k}`, v])) },
      };
    }
    case "DEFAULTERS": {
      const today = todayIst();
      const bills = await prisma.bill.findMany({ where: { societyId, status: "PUBLISHED", dueDate: { lt: today } } });
      const per = new Map<string, { due: Paise; oldest: Date; count: number }>();
      for (const b of bills) {
        const bal = balanceOf(b);
        if (bal <= ZERO) continue;
        const e = per.get(b.unitId) ?? { due: ZERO, oldest: b.dueDate, count: 0 };
        e.due = add(e.due, bal);
        e.count++;
        if (b.dueDate < e.oldest) e.oldest = b.dueDate;
        per.set(b.unitId, e);
      }
      const units = await prisma.unit.findMany({ where: { id: { in: [...per.keys()] } }, select: { id: true, number: true, building: { select: { name: true } }, memberships: { where: { cessationDate: null, kind: "PRIMARY" }, take: 1, select: { person: { select: { name: true, mobile: true } } } } } });
      const rows = units
        .map((u) => {
          const e = per.get(u.id)!;
          return { unit: label(u), owner: u.memberships[0]?.person.name ?? null, mobile: u.memberships[0]?.person.mobile ?? null, bills: e.count, oldestDue: toIsoDate(e.oldest), daysOverdue: Math.floor((today.getTime() - e.oldest.getTime()) / 86_400_000), due: toWire(e.due)! };
        })
        .sort((a, b) => b.due - a.due);
      return {
        type, title: "Defaulters", subtitle: `Overdue as of ${toIsoDate(today)}`,
        columns: [text("unit", "Unit"), text("owner", "Owner"), text("mobile", "Mobile"), { key: "bills", label: "Bills", kind: "number" }, date("oldestDue", "Oldest due"), { key: "daysOverdue", label: "Days overdue", kind: "number" }, money("due", "Outstanding")],
        rows,
        totals: { due: rows.reduce((s, r) => s + r.due, 0) },
      };
    }
    case "BILL_REGISTER": {
      const period = p.period ?? toIsoDate(todayIst()).slice(0, 7);
      const bills = await prisma.bill.findMany({ where: { societyId, period, status: { not: "DRAFT" } }, orderBy: { number: "asc" } });
      const units = await unitLabels(bills.map((b) => b.unitId));
      return {
        type, title: "Bill register", subtitle: `Period ${period}`,
        columns: [text("number", "Bill no."), text("unit", "Unit"), text("payer", "Payer"), date("billDate", "Bill date"), date("dueDate", "Due"), money("principal", "Charges"), money("interest", "Interest"), money("gst", "GST"), money("total", "Total"), money("balance", "Balance"), text("status", "Status")],
        rows: bills.map((b) => ({ number: b.number, unit: units.get(b.unitId) ?? "", payer: b.payerName, billDate: toIsoDate(b.billDate), dueDate: toIsoDate(b.dueDate), principal: toWire(b.principalPaise)!, interest: toWire(b.interestPaise)!, gst: toWire(b.gstPaise)!, total: toWire(b.totalPaise)!, balance: toWire(balanceOf(b))!, status: b.status })),
        totals: { total: bills.filter((b) => b.status === "PUBLISHED").reduce((s, b) => s + toWire(b.totalPaise)!, 0), balance: bills.reduce((s, b) => s + toWire(balanceOf(b))!, 0) },
      };
    }
    case "RECEIPT_REGISTER": {
      const r = range(p);
      const receipts = await prisma.receipt.findMany({ where: { societyId, date: { gte: r.from, lt: r.toExclusive } }, include: { payment: true }, orderBy: { number: "asc" } });
      const units = await unitLabels(receipts.map((x) => x.unitId));
      return {
        type, title: "Receipt register", subtitle: r.text,
        columns: [text("number", "Receipt no."), date("date", "Date"), text("unit", "Unit"), text("mode", "Mode"), text("instrument", "Reference"), money("amount", "Amount"), text("status", "Status")],
        rows: receipts.map((x) => ({ number: x.number, date: toIsoDate(x.date), unit: units.get(x.unitId) ?? "", mode: x.payment.mode, instrument: x.payment.instrumentNo, amount: toWire(x.amountPaise)!, status: x.status })),
        totals: { amount: receipts.filter((x) => x.status === "ISSUED").reduce((s, x) => s + toWire(x.amountPaise)!, 0) },
      };
    }
    case "MEMBER_LEDGER": {
      if (!p.unitId) throw new AppError("VALIDATION_FAILED", "Choose a unit.", [{ path: ["unitId"], message: "Required" }]);
      const unit = await prisma.unit.findFirst({ where: { id: p.unitId, societyId }, include: { building: { select: { name: true } } } });
      if (!unit) throw notFound("Unit");
      const entries = await prisma.ledgerEntry.findMany({ where: { unitId: unit.id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
      let bal = ZERO;
      return {
        type, title: `Ledger — ${label(unit)}`, subtitle: `As of ${toIsoDate(todayIst())}`,
        columns: [date("date", "Date"), text("narration", "Particulars"), money("debit", "Debit"), money("credit", "Credit"), money("balance", "Balance")],
        rows: entries.map((e) => {
          bal = add(bal, sub(e.debitPaise, e.creditPaise));
          return { date: toIsoDate(e.date), narration: e.narration, debit: toWire(e.debitPaise)!, credit: toWire(e.creditPaise)!, balance: toWire(bal)! };
        }),
        totals: { balance: toWire(bal)! },
      };
    }
    case "OCCUPANCY": {
      const units = await prisma.unit.findMany({
        where: { societyId },
        orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
        select: { number: true, carpetAreaSqft: true, building: { select: { name: true } }, occupancies: { where: { effectiveTo: null }, take: 1 }, memberships: { where: { cessationDate: null, kind: "PRIMARY" }, take: 1, select: { person: { select: { name: true } } } } },
      });
      return {
        type, title: "Occupancy", subtitle: `As of ${toIsoDate(todayIst())}`,
        columns: [text("unit", "Unit"), text("owner", "Owner"), text("occupancy", "Occupancy"), date("since", "Since"), { key: "area", label: "Carpet area", kind: "number" }],
        rows: units.map((u) => ({ unit: label(u), owner: u.memberships[0]?.person.name ?? null, occupancy: u.occupancies[0]?.status ?? null, since: toIsoDate(u.occupancies[0]?.effectiveFrom ?? null), area: u.carpetAreaSqft ? Number(u.carpetAreaSqft) : null })),
        totals: null,
      };
    }
    case "TENANT_REGISTER": {
      const t = await prisma.tenancy.findMany({ where: { societyId, endedOn: null }, include: { tenant: true, unit: { select: { number: true, building: { select: { name: true } } } } }, orderBy: { endDate: "asc" } });
      return {
        type, title: "Tenant register", subtitle: "Active tenancies, soonest expiry first",
        columns: [text("unit", "Unit"), text("tenant", "Tenant"), text("mobile", "Mobile"), date("start", "Start"), date("end", "End"), text("police", "Police intimation"), text("payer", "Bill payer")],
        rows: t.map((x) => ({ unit: label(x.unit), tenant: x.tenant.name, mobile: x.tenant.mobile, start: toIsoDate(x.startDate), end: toIsoDate(x.endDate), police: x.policeIntimationRef, payer: x.billPayer })),
        totals: null,
      };
    }
    case "NOTICE_DELIVERY": {
      if (!p.noticeId) throw new AppError("VALIDATION_FAILED", "Choose a notice.", [{ path: ["noticeId"], message: "Required" }]);
      const notice = await prisma.notice.findFirst({ where: { id: p.noticeId, societyId } });
      if (!notice) throw notFound("Notice");
      const rows = await prisma.noticeRecipient.findMany({ where: { noticeId: notice.id }, orderBy: { unitLabel: "asc" } });
      const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
      const deliveries = await prisma.notificationDelivery.findMany({ where: { notificationId: { in: rows.map((r) => r.notificationId).filter((x): x is string => !!x) } } });
      const st = (nid: string | null, ch: "PUSH" | "EMAIL") => (nid ? (deliveries.find((d) => d.notificationId === nid && d.channel === ch)?.status ?? "—") : "—");
      return {
        type, title: `Proof of service — ${notice.title}`, subtitle: `Published ${notice.publishedAt ? toIsoDate(notice.publishedAt) : "—"} · ${rows.length} recipients`,
        columns: [text("name", "Recipient"), text("unit", "Unit"), text("push", "Push"), text("email", "Email"), date("read", "Read"), date("ack", "Acknowledged")],
        rows: rows.map((r) => ({ name: users.find((u) => u.id === r.userId)?.name ?? "", unit: r.unitLabel, push: st(r.notificationId, "PUSH"), email: st(r.notificationId, "EMAIL"), read: r.readAt ? toIsoDate(r.readAt) : null, ack: r.acknowledgedAt ? toIsoDate(r.acknowledgedAt) : null })),
        totals: { recipients: rows.length, read: rows.filter((r) => r.readAt).length, acknowledged: rows.filter((r) => r.acknowledgedAt).length },
      };
    }
  }
}

async function unitLabels(ids: string[]) {
  const units = await prisma.unit.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, number: true, building: { select: { name: true } } } });
  return new Map(units.map((u) => [u.id, label(u)]));
}

// ─── Files and email ────────────────────────────────────────────────────────

export async function toFile(report: ReportData, format: "xlsx" | "csv"): Promise<{ filename: string; content: Buffer; contentType: string }> {
  const base = report.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const cell = (c: ReportData["columns"][number], v: unknown) => (v === null || v === undefined ? "" : c.kind === "money" ? Number(v) / 100 : v);
  if (format === "csv") {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [report.columns.map((c) => esc(c.label)).join(","), ...report.rows.map((r) => report.columns.map((c) => esc(cell(c, r[c.key]))).join(","))];
    return { filename: `${base}.csv`, content: Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8"), contentType: "text/csv" };
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sahaj";
  const ws = wb.addWorksheet(report.title.slice(0, 31));
  ws.addRow([report.title]).font = { bold: true, size: 14 };
  ws.addRow([report.subtitle]).font = { color: { argb: "FF5B6B66" } };
  ws.addRow([]);
  const header = ws.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true };
  header.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2EF" } }));
  for (const r of report.rows) ws.addRow(report.columns.map((c) => cell(c, r[c.key])));
  report.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(40, Math.max(12, c.label.length + 4));
    if (c.kind === "money") col.numFmt = "₹#,##,##0.00";
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return { filename: `${base}.xlsx`, content: buf, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

const emailJob = defineJob<{ societyId: string; userId: string; type: ReportType; params: Params; format: "xlsx" | "csv" }>(
  "reports.email",
  async ({ societyId, userId, type, params, format }) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) return;
    const report = await runReport(societyId, type, params);
    const file = await toFile(report, format);
    const society = await prisma.society.findUniqueOrThrow({ where: { id: societyId }, select: { name: true } });
    const totalLine = report.totals && Object.keys(report.totals).length ? `\n\n${Object.entries(report.totals).filter(([k]) => !k.startsWith("mode_")).map(([k, v]) => `${k}: ${report.columns.find((c) => c.key === k)?.kind === "money" ? formatInr(BigInt(v)) : v}`).join("\n")}` : "";
    await sendReportEmail({
      to: user.email,
      userId,
      societyId,
      subject: `${society.name}: ${report.title} (${report.subtitle})`,
      text: `Hello ${user.name.split(" ")[0]},\n\n${report.title} for ${report.subtitle} is attached — ${report.rows.length} rows.${totalLine}`,
      attachments: [file],
    });
  },
  { attempts: 4 },
);

export async function emailReport(scope: SocietyScope, userId: string, type: ReportType, body: z.output<typeof schemas.reports.EmailReportBody>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  if (!user.email) throw new AppError("EMAIL_REQUIRED", "Add an email address to your profile to receive reports.");
  const { format, ...params } = body;
  await runReport(scope.societyId, type, params); // fail fast on bad parameters, in the request
  await emailJob.enqueue({ societyId: scope.societyId, userId, type, params, format });
  return { queued: true as const, to: user.email };
}

// ─── Scheduled digests (MASTER_SPEC C18) ────────────────────────────────────

/** People who get a scheduled report: hold one of the permissions, have an email, and haven't turned report email off. */
async function digestRecipients(societyId: string, permissions: string[]) {
  const users = await prisma.societyUser.findMany({
    where: { societyId, deletedAt: null, suspendedAt: null, permissions: { hasSome: permissions }, user: { email: { not: null } } },
    select: { userId: true },
  });
  const off = await prisma.notificationPreference.findMany({ where: { userId: { in: users.map((u) => u.userId) }, category: "REPORT", email: false }, select: { userId: true } });
  const optedOut = new Set(off.map((o) => o.userId));
  return users.map((u) => u.userId).filter((u) => !optedOut.has(u));
}

/** Daily collection summary to the treasurer and anyone else who records payments. */
export const dailyCollections = defineJob("reports.daily-collections", async () => {
  const today = toIsoDate(todayIst());
  for (const s of await prisma.society.findMany({ where: { status: "LIVE" }, select: { id: true } })) {
    const any = await prisma.payment.count({ where: { societyId: s.id, status: "SUCCESS", paidAt: { gte: fromIsoDate(today) } } });
    if (!any) continue; // no news isn't worth an email
    for (const userId of await digestRecipients(s.id, ["payments.record", "accounts.manage"])) {
      await emailJob.enqueue({ societyId: s.id, userId, type: "COLLECTIONS", params: { from: today, to: today }, format: "xlsx" }, { jobId: `daily:${s.id}:${userId}:${today}` });
    }
  }
});

/** Monday digest for administrators: defaulters and last week's collections. */
export const weeklyDigest = defineJob("reports.weekly-digest", async () => {
  const now = todayIst();
  if (now.getUTCDay() !== 1) return;
  const to = toIsoDate(addDays(now, -1));
  const from = toIsoDate(addDays(now, -7));
  for (const s of await prisma.society.findMany({ where: { status: "LIVE" }, select: { id: true, fyStartMonth: true } })) {
    for (const userId of await digestRecipients(s.id, ["society.configure", "billing.publish", "recovery.notice"])) {
      await emailJob.enqueue({ societyId: s.id, userId, type: "DEFAULTERS", params: {}, format: "xlsx" }, { jobId: `weekly-def:${s.id}:${userId}:${to}` });
      await emailJob.enqueue({ societyId: s.id, userId, type: "COLLECTIONS", params: { from, to }, format: "xlsx" }, { jobId: `weekly-col:${s.id}:${userId}:${to}` });
    }
  }
});
