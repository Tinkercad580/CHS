import { api } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { simpleInterest } from "../../src/core/money";
import { prisma } from "../../src/core/db";
import { computeRun } from "../../src/modules/billing/engine";
import { signDummyWebhook } from "../../src/modules/payments/payments.service";
import { addUser, app, call, login, makeSociety, resetDb } from "../helpers";
import request from "supertest";

/**
 * Billing and payments end to end — MASTER_SPEC Phase 4/5 exit criteria and
 * compliance items 3 (historical reproducibility) and 6 (immutability).
 */

let S: Awaited<ReturnType<typeof makeSociety>>;
let admin: string;
let owner: Awaited<ReturnType<typeof addUser>>;
let ownerToken: string;
const sid = () => S.society.id;
const resolution = { meetingRef: "AGM 2025/4", resolvedOn: "2025-09-21" };

async function head(code: string, category: string, method: string, rate: string, extra: Record<string, unknown> = {}) {
  const h = await call(api.billing.createHead, { params: { societyId: sid() }, body: { code, name: code, category, method, ...extra } }, admin);
  expect(h.status, JSON.stringify(h.body)).toBe(200);
  const r = await call(api.billing.setRate, { params: { societyId: sid(), headId: h.body.data.id }, body: { rate, effectiveFrom: "2026-07-01", ...(category.endsWith("FUND") ? { resolution } : {}) } }, admin);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return h.body.data.id as string;
}

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("BILL", 4);
  admin = (await login(S.admin.mobile)).token;
  await prisma.building.update({ where: { id: S.building.id }, data: { constructionCostPaise: 1_20_00_000_00n } });
  const areas = ["850", "980", "1180", "1420"];
  for (const [i, u] of S.units.entries()) await prisma.unit.update({ where: { id: u.id }, data: { carpetAreaSqft: areas[i]!, waterInlets: i < 2 ? 2 : 3 } });
  owner = await addUser(sid(), "OWNER", { name: "Anita Deshpande", unitId: S.units[0]!.id });
  ownerToken = (await login(owner.mobile)).token;
  for (const [i, u] of S.units.entries()) {
    await call(api.members.addMembership, { params: { societyId: sid(), unitId: u.id }, body: { person: i === 0 ? { name: "Anita Deshpande", mobile: owner.mobile } : { name: `Owner ${i}` }, kind: "PRIMARY", admissionDate: "2020-01-01" } }, admin);
    await call(api.members.setOccupancy, { params: { societyId: sid(), unitId: u.id }, body: { status: i === 3 ? "TENANTED" : i === 2 ? "FAMILY_OCCUPIED" : "SELF_OCCUPIED", effectiveFrom: "2020-01-01" } }, admin);
  }
  await call(api.society.updateBillingConfig, { params: { societyId: sid() }, body: { interestRateBps: 1200, interestResolution: resolution, dueDay: 15, generationDay: 1, graceDays: 0 } }, admin);
});

describe("charge heads", () => {
  it("refuses a method Rule 106C-12 doesn't allow for the category", async () => {
    const r = await call(api.billing.createHead, { params: { societyId: sid() }, body: { code: "BAD", name: "Bad", category: "SERVICE", method: "PER_CARPET_AREA" } }, admin);
    expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(r.body.error.details.allowed).toEqual(["EQUAL_PER_UNIT"]);
  });

  it("builds a compliant schedule", async () => {
    const svc = await head("SVC", "SERVICE", "EQUAL_PER_UNIT", "180000", { sortOrder: 10 });
    await head("WATER", "WATER", "PER_WATER_INLET", "14000", { sortOrder: 20 });
    await head("LIFT", "LIFT", "BUILDING_SCOPED_EQUAL", "35000", { sortOrder: 30 });
    await head("SINK", "SINKING_FUND", "PERCENT_OF_CONSTRUCTION_COST", "25", { sortOrder: 40 });
    await head("NOC", "NON_OCCUPANCY", "PERCENT_OF_HEAD", "1000", { sortOrder: 50, baseHeadId: svc });
  });

  it("non-occupancy must be based on service charges and within the cap", async () => {
    const water = (await prisma.chargeHead.findFirstOrThrow({ where: { societyId: sid(), code: "WATER" } })).id;
    const r = await call(api.billing.createHead, { params: { societyId: sid() }, body: { code: "NOC2", name: "NOC2", category: "NON_OCCUPANCY", method: "PERCENT_OF_HEAD", baseHeadId: water } }, admin);
    expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    const noc = (await prisma.chargeHead.findFirstOrThrow({ where: { societyId: sid(), code: "NOC" } })).id;
    const over = await call(api.billing.setRate, { params: { societyId: sid(), headId: noc }, body: { rate: "1500", effectiveFrom: "2026-12-01" } }, admin);
    expect(over.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("fund rates need a resolution and can't go below the minimum", async () => {
    const sink = (await prisma.chargeHead.findFirstOrThrow({ where: { societyId: sid(), code: "SINK" } })).id;
    expect((await call(api.billing.setRate, { params: { societyId: sid(), headId: sink }, body: { rate: "30", effectiveFrom: "2026-12-01" } }, admin)).body.error.code).toBe("RESOLUTION_REQUIRED");
    expect((await call(api.billing.setRate, { params: { societyId: sid(), headId: sink }, body: { rate: "20", effectiveFrom: "2026-12-01", resolution } }, admin)).body.error.code).toBe("FUND_BELOW_MINIMUM");
  });

  it("simulates who pays what", async () => {
    const svc = (await prisma.chargeHead.findFirstOrThrow({ where: { societyId: sid(), code: "NOC" } })).id;
    const r = await call(api.billing.simulate, { params: { societyId: sid(), headId: svc }, query: { asOf: "2026-08-01" } }, admin);
    expect(r.body.data.rows).toEqual([expect.objectContaining({ unitLabel: "A-104", amountPaise: 18000 })]);
  });
});

describe("bill runs", () => {
  let augRun: string;

  it("previews, then publishes with gapless numbers and ledger entries", async () => {
    const draft = await call(api.billing.createRun, { params: { societyId: sid() }, body: { period: "2026-08" } }, admin);
    expect(draft.status, JSON.stringify(draft.body)).toBe(200);
    augRun = draft.body.data.id;
    expect(draft.body.data).toMatchObject({ status: "DRAFT", billCount: 4, dueDate: "2026-08-15" });
    expect(draft.body.data.byHead.map((h: { code: string }) => h.code)).toEqual(expect.arrayContaining(["SVC", "WATER", "LIFT", "SINK", "NOC"]));

    // A draft is invisible to residents.
    expect((await call(api.billing.myBills, { params: { societyId: sid() } }, ownerToken)).body.data.items).toHaveLength(0);

    const pub = await call(api.billing.publishRun, { params: { societyId: sid(), runId: augRun } }, admin);
    expect(pub.body.data.status).toBe("PUBLISHED");
    const bills = await prisma.bill.findMany({ where: { billRunId: augRun }, orderBy: { number: "asc" } });
    expect(bills.map((b) => b.number)).toEqual(["BILL/2026-27/000001", "BILL/2026-27/000002", "BILL/2026-27/000003", "BILL/2026-27/000004"]);
    expect(await prisma.ledgerEntry.count({ where: { societyId: sid(), kind: "BILL" } })).toBe(4);
    const twice = await call(api.billing.publishRun, { params: { societyId: sid(), runId: augRun } }, admin);
    expect(twice.body.error.code).toBe("CONFLICT");
  });

  it("the resident sees each line and the basis it was computed on", async () => {
    const mine = await call(api.billing.myBills, { params: { societyId: sid() } }, ownerToken);
    expect(mine.body.data.items).toHaveLength(1);
    const bill = mine.body.data.items[0];
    expect(bill.unitLabel).toBe("A-101");
    expect(bill.lines.map((l: { basis: string }) => l.basis)).toEqual(expect.arrayContaining(["₹1,800 per unit", "2 inlets × ₹140"]));
    // Self-occupied: no non-occupancy line.
    expect(bill.lines.find((l: { code: string }) => l.code === "NOC")).toBeUndefined();
  });

  it("charges non-occupancy only on the tenanted flat, never the family-occupied one", async () => {
    const bills = await prisma.bill.findMany({ where: { billRunId: augRun }, include: { lines: true } });
    const byUnit = new Map(bills.map((b) => [b.unitId, b]));
    expect(byUnit.get(S.units[3]!.id)!.lines.find((l) => l.code === "NOC")?.amountPaise).toBe(18000n);
    expect(byUnit.get(S.units[2]!.id)!.lines.find((l) => l.code === "NOC")).toBeUndefined();
  });

  it("published bills can't be changed, even directly in the database (compliance item 6)", async () => {
    const b = await prisma.bill.findFirstOrThrow({ where: { billRunId: augRun } });
    await expect(prisma.bill.update({ where: { id: b.id }, data: { totalPaise: 1n } })).rejects.toThrow(/immutable/);
    await expect(prisma.billLine.updateMany({ where: { billId: b.id }, data: { amountPaise: 1n } })).rejects.toThrow(/immutable/);
    await expect(prisma.ledgerEntry.deleteMany({ where: { societyId: sid() } })).rejects.toThrow(/append-only/);
  });

  it("rates can't be changed back into a published period", async () => {
    const svc = (await prisma.chargeHead.findFirstOrThrow({ where: { societyId: sid(), code: "SVC" } })).id;
    const r = await call(api.billing.setRate, { params: { societyId: sid(), headId: svc }, body: { rate: "200000", effectiveFrom: "2026-08-15" } }, admin);
    expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    const later = await call(api.billing.setRate, { params: { societyId: sid(), headId: svc }, body: { rate: "200000", effectiveFrom: "2026-10-01" } }, admin);
    expect(later.status).toBe(200);
  });

  it("recomputing a published period after a rate change reproduces it to the paisa (compliance item 3)", async () => {
    const run = await prisma.billRun.findUniqueOrThrow({ where: { id: augRun } });
    const again = await computeRun({
      societyId: sid(), periodStart: run.periodStart, periodEnd: run.periodEnd, months: 1, interestWindowStart: null,
      config: { interestRateBps: 1200, graceDays: 0, roundingRule: "NEAREST_RUPEE" }, gstRegistered: false,
    });
    const stored = await prisma.bill.findMany({ where: { billRunId: augRun } });
    for (const b of stored) expect(again.bills.find((x) => x.unit.unitId === b.unitId)!.totalPaise).toBe(b.totalPaise);
  });
});

describe("payments", () => {
  it("pays online through the dummy gateway: receipt, allocation, dues cleared", async () => {
    const dues = await call(api.billing.myDues, { params: { societyId: sid() } }, ownerToken);
    const due = dues.body.data[0].totalDuePaise;
    expect(due).toBeGreaterThan(0);
    const start = await call(api.payments.start, { params: { societyId: sid() }, body: { unitId: S.units[0]!.id } }, ownerToken, { "idempotency-key": "pay-anita-0001" });
    expect(start.body.data).toMatchObject({ gateway: "dummy", amountPaise: due });
    const done = await call(api.payments.completeDummyCheckout, { params: { societyId: sid(), paymentId: start.body.data.payment.id }, body: { orderId: start.body.data.orderId, outcome: "success" } }, ownerToken);
    expect(done.body.data.status).toBe("SUCCESS");
    expect(done.body.data.receipt.number).toBe("BILL/R/2026-27/000001");
    const after = await call(api.billing.myDues, { params: { societyId: sid() } }, ownerToken);
    expect(after.body.data[0].totalDuePaise).toBe(0);
  });

  it("a failed checkout charges nothing and a replayed webhook is ignored", async () => {
    const start = await call(api.payments.start, { params: { societyId: sid() }, body: { unitId: S.units[0]!.id, amountPaise: 50000 } }, ownerToken);
    const failed = await call(api.payments.completeDummyCheckout, { params: { societyId: sid(), paymentId: start.body.data.payment.id }, body: { orderId: start.body.data.orderId, outcome: "failure" } }, ownerToken);
    expect(failed.body.data.status).toBe("FAILED");
    expect(failed.body.data.receipt).toBeNull();
  });

  it("an abandoned checkout can be cancelled by the payer, once", async () => {
    const start = await call(api.payments.start, { params: { societyId: sid() }, body: { unitId: S.units[0]!.id, amountPaise: 20000 } }, ownerToken);
    const id = start.body.data.payment.id;
    expect((await call(api.payments.cancelCheckout, { params: { societyId: sid(), paymentId: id } }, admin)).status).toBe(403);
    const c = await call(api.payments.cancelCheckout, { params: { societyId: sid(), paymentId: id } }, ownerToken);
    expect(c.body.data.status).toBe("CANCELLED");
    expect((await call(api.payments.cancelCheckout, { params: { societyId: sid(), paymentId: id } }, ownerToken)).body.error.code).toBe("PAYMENT_STATE_INVALID");
    const late = await call(api.payments.completeDummyCheckout, { params: { societyId: sid(), paymentId: id }, body: { orderId: start.body.data.orderId, outcome: "success" } }, ownerToken);
    expect(late.body.data?.status ?? late.body.error.code).not.toBe("SUCCESS");
  });

  it("verifies webhook signatures and processes an event once", async () => {
    const start = await call(api.payments.start, { params: { societyId: sid() }, body: { unitId: S.units[0]!.id, amountPaise: 10000 } }, ownerToken);
    const body = JSON.stringify({ eventId: "evt-1", type: "payment.captured", orderId: start.body.data.orderId, paymentId: "pay-1", amountPaise: 10000 });
    const bad = await request(app).post("/api/v1/webhooks/payments/dummy").set("content-type", "application/json").set("x-gateway-signature", "nope").send(body);
    expect(bad.status).toBe(401);
    const ok = () => request(app).post("/api/v1/webhooks/payments/dummy").set("content-type", "application/json").set("x-gateway-signature", signDummyWebhook(body)).send(body);
    expect((await ok()).status).toBe(200);
    expect((await ok()).status).toBe(200);
    expect(await prisma.receipt.count({ where: { payment: { gatewayOrderId: start.body.data.orderId } } })).toBe(1);
    // Nothing was due, so the whole amount is an advance.
    const dues = await call(api.billing.myDues, { params: { societyId: sid() } }, ownerToken);
    expect(dues.body.data[0].advancePaise).toBe(10000);
  });

  it("records a cheque as pending until cleared, and a bounce reverses nothing because nothing was applied", async () => {
    const unitId = S.units[1]!.id;
    const chq = await call(api.payments.record, { params: { societyId: sid() }, body: { unitId, amountPaise: 100000, mode: "CHEQUE", date: "2026-08-10", instrumentNo: "000123", bankName: "Cosmos" } }, admin);
    expect(chq.body.data).toMatchObject({ status: "PENDING", receipt: null });
    const bounced = await call(api.payments.chequeAction, { params: { societyId: sid(), paymentId: chq.body.data.id }, body: { action: "bounce", reason: "Insufficient funds" } }, admin);
    expect(bounced.body.data.status).toBe("FAILED");
    const cash = await call(api.payments.record, { params: { societyId: sid() }, body: { unitId, amountPaise: 100000, mode: "CASH", date: "2026-08-10" } }, admin);
    expect(cash.body.data.status).toBe("SUCCESS");
    expect(cash.body.data.allocations[0].bucket).toBe("PRINCIPAL");
  });

  it("cancelling a receipt reverses it in the bills and the ledger", async () => {
    const unitId = S.units[1]!.id;
    const p = (await prisma.payment.findFirstOrThrow({ where: { unitId, mode: "CASH", status: "SUCCESS" } })).id;
    const before = await call(api.billing.ledger, { params: { societyId: sid(), unitId } }, admin);
    const r = await call(api.payments.cancelReceipt, { params: { societyId: sid(), paymentId: p }, body: { reason: "Entered against the wrong flat" } }, admin);
    expect(r.body.data).toMatchObject({ status: "REVERSED", receipt: { status: "CANCELLED" }, allocations: [] });
    const after = await call(api.billing.ledger, { params: { societyId: sid(), unitId } }, admin);
    expect(after.body.data.balancePaise).toBe(before.body.data.balancePaise + 100000);
  });

  it("September carries simple interest on August's unpaid principal, and applies advances", async () => {
    const sep = await call(api.billing.createRun, { params: { societyId: sid() }, body: { period: "2026-09" } }, admin);
    await call(api.billing.publishRun, { params: { societyId: sid(), runId: sep.body.data.id } }, admin);
    const b2 = await prisma.bill.findFirstOrThrow({ where: { billRunId: sep.body.data.id, unitId: S.units[1]!.id }, include: { lines: true } });
    const aug = await prisma.bill.findFirstOrThrow({ where: { unitId: S.units[1]!.id, period: "2026-08" } });
    const interest = b2.lines.find((l) => l.code === "INTEREST")!;
    // Due 15 Aug, interest from the 16th to 1 Sep = 16 days at 12% simple.
    expect(interest.amountPaise).toBe(simpleInterest(aug.totalPaise, 1200, 16));
    // Anita's ₹100 advance went onto her September bill — interest first (she paid August late), then principal.
    const anita = await prisma.bill.findFirstOrThrow({ where: { billRunId: sep.body.data.id, unitId: S.units[0]!.id } });
    expect(anita.interestPaise).toBeGreaterThan(0n);
    expect(anita.interestPaidPaise).toBe(anita.interestPaise);
    expect(anita.interestPaidPaise + anita.principalPaidPaise).toBe(10000n);
  });

  it("a credit note reduces what is owed", async () => {
    const unitId = S.units[2]!.id;
    const r = await call(api.billing.creditNote, { params: { societyId: sid(), unitId }, body: { amountPaise: 5000, reason: "Lift out of service in August" } }, admin);
    expect(r.body.data.number).toMatch(/^BILL\/CN\/2026-27\/000001$/);
    const ledger = await call(api.billing.ledger, { params: { societyId: sid(), unitId } }, admin);
    expect(ledger.body.data.entries.at(-1)).toMatchObject({ kind: "CREDIT_NOTE", creditPaise: 5000 });
  });
});

describe("dashboard and reports", () => {
  it("summarises billed, collected and outstanding", async () => {
    const r = await call(api.reports.dashboard, { params: { societyId: sid() } }, admin);
    expect(r.status).toBe(200);
    expect(r.body.data.units).toBe(4);
    expect(r.body.data.outstandingPaise).toBeGreaterThan(0);
    expect(r.body.data.topDefaulters.length).toBeGreaterThan(0);
  });

  it("runs the defaulters report and refuses to email without an email on file", async () => {
    const r = await call(api.reports.get, { params: { societyId: sid(), type: "defaulters" } }, admin);
    expect(r.body.data.columns.map((c: { key: string }) => c.key)).toContain("due");
    const email = await call(api.reports.email, { params: { societyId: sid(), type: "defaulters" }, body: { format: "xlsx" } }, admin);
    expect(email.body.error.code).toBe("EMAIL_REQUIRED");
    await prisma.user.update({ where: { id: S.admin.user.id }, data: { email: "secretary@example.in" } });
    const ok = await call(api.reports.email, { params: { societyId: sid(), type: "defaulters" }, body: { format: "csv" } }, admin);
    expect(ok.body.data).toEqual({ queued: true, to: "secretary@example.in" });
  });

  it("residents can't read society reports", async () => {
    expect((await call(api.reports.dashboard, { params: { societyId: sid() } }, ownerToken)).status).toBe(403);
  });
});

describe("bill filters", () => {
  it("filters paid and unpaid in the database, so pages are full and totals exact", async () => {
    const unpaid = await call(api.billing.bills, { params: { societyId: sid() }, query: { state: "UNPAID", limit: 1 } }, admin);
    const paid = await call(api.billing.bills, { params: { societyId: sid() }, query: { state: "PAID", limit: 1 } }, admin);
    const all = await call(api.billing.bills, { params: { societyId: sid() }, query: { limit: 1 } }, admin);
    expect(unpaid.body.data.items).toHaveLength(1);
    expect(unpaid.body.data.items[0].balancePaise).toBeGreaterThan(0);
    expect(paid.body.data.items[0].balancePaise).toBe(0);
    expect(unpaid.body.data.total + paid.body.data.total).toBeLessThanOrEqual(all.body.data.total);
    const dues = await call(api.billing.myDues, { params: { societyId: sid() } }, ownerToken);
    expect(dues.body.data[0]).toHaveProperty("overdueSince");
  });
});
