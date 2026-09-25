import { createHmac, randomUUID } from "node:crypto";
import { schemas, type PaymentRecord } from "@chs/contract";
import type { z } from "zod";
import { env } from "../../config/env";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { financialYear, fromIsoDate, toIso, toIsoDate, todayIst } from "../../core/dates";
import { Prisma, prisma, transaction } from "../../core/db";
import { AppError, forbidden, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { formatInr, fromWire, toWire, ZERO } from "../../core/money";
import { formatNumber, nextNumber } from "../../core/numbering";
import { paginate } from "../../core/pagination";
import { safeEqual } from "../../core/crypto";
import { defineJob } from "../../core/queue";
import { duesFor } from "../billing/bills.service";
import { unitRecipients } from "../billing/engine";
import { actingUnitIds } from "../members/members.service";
import { notifyLater } from "../notifications/notify";
import { getBillingConfig } from "../society/society.service";
import { allocate, reverseAllocations } from "./allocation";

const include = { receipt: true, allocations: true } as const;
type Row = Prisma.PaymentGetPayload<{ include: typeof include }>;

async function toDto(p: Row): Promise<PaymentRecord> {
  const [unit, bills] = await Promise.all([
    prisma.unit.findUniqueOrThrow({ where: { id: p.unitId }, select: { number: true, building: { select: { name: true } } } }),
    prisma.bill.findMany({ where: { id: { in: p.allocations.map((a) => a.billId).filter((x): x is string => !!x) } }, select: { id: true, number: true } }),
  ]);
  const num = new Map(bills.map((b) => [b.id, b.number]));
  // Net per bill and bucket: reversals and re-applied advances cancel out.
  const net = new Map<string, { billId: string | null; bucket: "INTEREST" | "PRINCIPAL" | "ADVANCE"; amount: bigint }>();
  for (const a of p.allocations) {
    const k = `${a.billId}:${a.bucket}`;
    const e = net.get(k) ?? { billId: a.billId, bucket: a.bucket, amount: ZERO };
    e.amount += a.amountPaise;
    net.set(k, e);
  }
  return {
    id: p.id,
    unitId: p.unitId,
    unitLabel: `${unit.building.name}-${unit.number}`,
    amountPaise: toWire(p.amountPaise)!,
    mode: p.mode,
    status: p.status,
    gateway: p.gateway,
    instrumentNo: p.instrumentNo,
    bankName: p.bankName,
    remarks: p.remarks,
    failureReason: p.failureReason,
    paidAt: toIso(p.paidAt),
    createdAt: toIso(p.createdAt),
    receipt: p.receipt ? { id: p.receipt.id, number: p.receipt.number, amountPaise: toWire(p.receipt.amountPaise)!, date: toIsoDate(p.receipt.date), status: p.receipt.status, cancelReason: p.receipt.cancelReason } : null,
    allocations: [...net.values()].filter((a) => a.amount !== ZERO).map((a) => ({ billId: a.billId, billNumber: a.billId ? (num.get(a.billId) ?? null) : null, bucket: a.bucket, amountPaise: toWire(a.amount)! })),
  };
}

async function load(societyId: string, id: string) {
  const p = await prisma.payment.findFirst({ where: { id, societyId }, include });
  if (!p) throw notFound("Payment");
  return p;
}

const isDesk = (scope: SocietyScope) => ["payments.record", "accounts.manage", "billing.publish"].some((x) => scope.permissions.has(x as never));

// ─── Confirmation: the one path every channel ends in ───────────────────────

/**
 * Mark a payment successful: receipt with a gapless number, ledger credit,
 * allocation to bills. Runs inside the caller's transaction with the payment
 * row locked, so a duplicate webhook or a double click can't issue twice.
 */
async function succeed(tx: Prisma.TransactionClient, paymentId: string, paidAt: Date, gatewayPaymentId: string | null): Promise<Row> {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.status === "SUCCESS") return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include });
  if (!["CREATED", "PENDING"].includes(p.status)) throw new AppError("PAYMENT_STATE_INVALID", `A ${p.status.toLowerCase()} payment can't be confirmed.`);
  const [society, config] = await Promise.all([tx.society.findUniqueOrThrow({ where: { id: p.societyId }, select: { code: true, fyStartMonth: true } }), getBillingConfig(p.societyId)]);
  const date = new Date(Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate()));
  const fy = financialYear(date, society.fyStartMonth);
  const seq = await nextNumber(tx, p.societyId, "RECEIPT", fy);
  await tx.payment.update({ where: { id: p.id }, data: { status: "SUCCESS", paidAt, gatewayPaymentId: gatewayPaymentId ?? p.gatewayPaymentId } });
  await tx.receipt.create({ data: { societyId: p.societyId, unitId: p.unitId, paymentId: p.id, number: formatNumber(config.receiptNumberFormat, { code: society.code, fy, seq }), fy, amountPaise: p.amountPaise, date } });
  await tx.ledgerEntry.create({ data: { societyId: p.societyId, unitId: p.unitId, date, kind: "PAYMENT", refType: "payment", refId: p.id, creditPaise: p.amountPaise, narration: `Payment received (${p.mode.toLowerCase()})` } });
  await allocate(tx, p.societyId, p.unitId, p.id, p.amountPaise, config.allocationOrder);
  await audit(tx, { action: "payment.success", entity: "payment", entityId: p.id, societyId: p.societyId, after: { amountPaise: p.amountPaise, mode: p.mode } });
  return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include });
}

async function announce(p: Row) {
  const recipients = (await unitRecipients(p.societyId, [p.unitId])).get(p.unitId) ?? [];
  const users = [...new Set([...recipients, ...(p.payerUserId ? [p.payerUserId] : [])])];
  if (p.status === "SUCCESS" && p.receipt) {
    notifyLater({
      societyId: p.societyId,
      userIds: users,
      category: "PAYMENT",
      title: "Payment received",
      body: `${formatInr(p.amountPaise)} received. Receipt ${p.receipt.number}.`,
      data: { route: `/payments/${p.id}`, paymentId: p.id, status: "SUCCESS", unitId: p.unitId },
    });
  } else if (p.status === "FAILED" && p.payerUserId) {
    notifyLater({ societyId: p.societyId, userIds: [p.payerUserId], category: "PAYMENT", title: "Payment didn't go through", body: `${formatInr(p.amountPaise)} — ${p.failureReason ?? "the payment failed"}. Nothing was charged.`, data: { route: `/payments/${p.id}`, paymentId: p.id, status: "FAILED", unitId: p.unitId } });
  }
  events.emit({ name: "payments.changed", to: { admins: p.societyId, unit: p.unitId, ...(p.payerUserId ? { user: p.payerUserId } : {}) }, payload: { paymentId: p.id, status: p.status } });
  events.emit({ name: "billing.changed", to: { admins: p.societyId, unit: p.unitId }, payload: { unitId: p.unitId } });
}

// ─── Online (resident) ──────────────────────────────────────────────────────

export async function start(scope: SocietyScope, userId: string, body: z.output<typeof schemas.payments.StartPaymentBody>) {
  if (!(await actingUnitIds(prisma, scope, userId)).has(body.unitId)) throw forbidden("You can only pay for your own unit.");
  const [dues] = await duesFor(scope.societyId, [body.unitId]);
  const due = dues?.totalDuePaise ?? 0;
  const amount = body.amountPaise ?? due;
  if (amount <= 0) throw new AppError("NOTHING_DUE", "Nothing is due on this unit.");
  const id = randomUUID();
  const p = await prisma.payment.create({
    data: { id, societyId: scope.societyId, unitId: body.unitId, amountPaise: fromWire(amount)!, mode: "ONLINE", status: "CREATED", gateway: env.PAYMENT_GATEWAY, gatewayOrderId: `${env.PAYMENT_GATEWAY}_order_${id}`, payerUserId: userId },
    include,
  });
  await audit(prisma, { action: "payment.start", entity: "payment", entityId: p.id, after: { amountPaise: amount } });
  const dto = await toDto(p);
  return { payment: dto, gateway: "dummy" as const, orderId: p.gatewayOrderId!, amountPaise: amount, description: `Society dues for ${dto.unitLabel}` };
}

function sign(body: string): string {
  return createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET).update(body).digest("hex");
}

/**
 * Gateway event — from the webhook, or from the dummy checkout, which builds
 * the same event a real gateway would send. Idempotent by event id; a replay
 * returns quietly.
 */
export async function handleGatewayEvent(gateway: string, ev: z.output<typeof schemas.payments.GatewayWebhookBody>): Promise<Row | null> {
  const result = await transaction(prisma, async (tx) => {
    // ON CONFLICT DO NOTHING: a unique violation would abort the transaction, a skipped insert doesn't.
    const fresh = await tx.gatewayEvent.createMany({ data: [{ gateway, eventId: ev.eventId, payload: ev as unknown as Prisma.InputJsonValue }], skipDuplicates: true });
    if (fresh.count === 0) return null; // already processed
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payments WHERE gateway_order_id = ${ev.orderId} FOR UPDATE`;
    if (!locked.length) throw new AppError("NOT_FOUND", "Unknown order.");
    const p = await tx.payment.findUniqueOrThrow({ where: { id: locked[0]!.id } });
    if (fromWire(ev.amountPaise) !== p.amountPaise) throw new AppError("BAD_REQUEST", "Amount doesn't match the order.");
    if (p.status === "SUCCESS" || p.status === "FAILED") return tx.payment.findUniqueOrThrow({ where: { id: p.id }, include });
    if (ev.type === "payment.captured") return succeed(tx, p.id, new Date(), ev.paymentId);
    const failed = await tx.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: ev.reason ?? "Declined by the bank", gatewayPaymentId: ev.paymentId }, include });
    await audit(tx, { action: "payment.failed", entity: "payment", entityId: p.id, societyId: p.societyId, after: { reason: failed.failureReason } });
    return failed;
  });
  if (result) await announce(result);
  return result;
}

export async function webhook(gateway: string, rawBody: string, signature: string | undefined, body: z.output<typeof schemas.payments.GatewayWebhookBody>) {
  if (gateway !== env.PAYMENT_GATEWAY) throw new AppError("NOT_FOUND", "Unknown gateway.");
  if (!signature || !safeEqual(sign(rawBody), signature)) throw new AppError("UNAUTHENTICATED", "Bad signature.");
  await handleGatewayEvent(gateway, body);
  return { ok: true as const };
}

/** The dummy gateway's checkout: success or failure on demand, through the same event path as a real webhook. */
export async function completeDummy(scope: SocietyScope, userId: string, paymentId: string, body: z.output<typeof schemas.payments.DummyCheckoutBody>) {
  if (env.PAYMENT_GATEWAY !== "dummy") throw new AppError("NOT_FOUND", "Not available.");
  const p = await load(scope.societyId, paymentId);
  if (p.payerUserId !== userId) throw forbidden();
  if (p.gatewayOrderId !== body.orderId) throw new AppError("BAD_REQUEST", "That order belongs to a different payment.");
  const result = await handleGatewayEvent("dummy", {
    eventId: `dummy_evt_${randomUUID()}`,
    type: body.outcome === "success" ? "payment.captured" : "payment.failed",
    orderId: body.orderId,
    paymentId: `dummy_pay_${randomUUID()}`,
    amountPaise: toWire(p.amountPaise)!,
    reason: body.outcome === "failure" ? "Declined in the test checkout" : undefined,
  });
  return toDto(result ?? (await load(scope.societyId, paymentId)));
}

export const signDummyWebhook = sign;

/** The payer closes the checkout without paying. Only a checkout that hasn't reached the gateway's success path. */
export async function cancelCheckout(scope: SocietyScope, userId: string, paymentId: string) {
  const p = await load(scope.societyId, paymentId);
  if (p.payerUserId !== userId) throw forbidden();
  if (p.status !== "CREATED") throw new AppError("PAYMENT_STATE_INVALID", `A ${p.status.toLowerCase()} payment can't be cancelled.`);
  const r = await prisma.payment.updateMany({ where: { id: p.id, status: "CREATED" }, data: { status: "CANCELLED", failureReason: "Checkout closed" } });
  if (!r.count) throw new AppError("PAYMENT_STATE_INVALID", "This payment has already moved on.");
  await audit(prisma, { action: "payment.checkout_cancelled", entity: "payment", entityId: p.id });
  return toDto(await load(scope.societyId, paymentId));
}

// ─── Desk (committee) ───────────────────────────────────────────────────────

export async function record(scope: SocietyScope, userId: string, body: z.output<typeof schemas.payments.RecordPaymentBody>) {
  const unit = await prisma.unit.findFirst({ where: { id: body.unitId, societyId: scope.societyId } });
  if (!unit) throw notFound("Unit");
  const date = fromIsoDate(body.date);
  if (date > todayIst()) throw new AppError("VALIDATION_FAILED", "The payment date can't be in the future.");
  const p = await transaction(prisma, async (tx) => {
    const created = await tx.payment.create({
      data: {
        societyId: scope.societyId,
        unitId: body.unitId,
        amountPaise: fromWire(body.amountPaise)!,
        mode: body.mode,
        // A cheque is provisional until it clears (MASTER_SPEC C5); everything else is money in hand.
        status: body.mode === "CHEQUE" ? "PENDING" : "CREATED",
        instrumentNo: body.instrumentNo ?? null,
        instrumentDate: fromIsoDate(body.instrumentDate ?? null),
        bankName: body.bankName ?? null,
        remarks: body.remarks ?? null,
        recordedById: userId,
      },
    });
    await audit(tx, { action: "payment.record", entity: "payment", entityId: created.id, after: { ...body } });
    if (body.mode === "CHEQUE") return tx.payment.findUniqueOrThrow({ where: { id: created.id }, include });
    return succeed(tx, created.id, new Date(`${body.date}T12:00:00.000Z`), null);
  });
  await announce(p);
  return toDto(p);
}

export async function chequeAction(scope: SocietyScope, id: string, body: z.output<typeof schemas.payments.ChequeActionBody>) {
  const p = await transaction(prisma, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payments WHERE id = ${id}::uuid AND society_id = ${scope.societyId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound("Payment");
    const row = await tx.payment.findUniqueOrThrow({ where: { id } });
    if (row.mode !== "CHEQUE" || row.status !== "PENDING") throw new AppError("PAYMENT_STATE_INVALID", "Only a pending cheque can be cleared or bounced.");
    if (body.action === "clear") return succeed(tx, id, new Date(), null);
    const failed = await tx.payment.update({ where: { id }, data: { status: "FAILED", failureReason: body.reason ?? "Cheque returned" }, include });
    await audit(tx, { action: "payment.cheque_bounced", entity: "payment", entityId: id, after: { reason: failed.failureReason } });
    return failed;
  });
  await announce(p);
  return toDto(p);
}

/** Receipts are never deleted: cancelling reverses the payment's allocations and posts a ledger reversal. */
export async function cancelReceipt(scope: SocietyScope, id: string, reason: string) {
  const p = await transaction(prisma, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payments WHERE id = ${id}::uuid AND society_id = ${scope.societyId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound("Payment");
    const row = await tx.payment.findUniqueOrThrow({ where: { id }, include: { receipt: true } });
    if (row.status !== "SUCCESS" || !row.receipt) throw new AppError("PAYMENT_STATE_INVALID", "Only a successful payment with a receipt can be cancelled.");
    await reverseAllocations(tx, id);
    await tx.receipt.update({ where: { id: row.receipt.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    await tx.ledgerEntry.create({ data: { societyId: row.societyId, unitId: row.unitId, date: todayIst(), kind: "REVERSAL", refType: "payment", refId: id, debitPaise: row.amountPaise, narration: `Receipt ${row.receipt.number} cancelled: ${reason}`.slice(0, 200) } });
    await audit(tx, { action: "payment.receipt_cancelled", entity: "payment", entityId: id, before: { status: "SUCCESS" }, after: { status: "REVERSED", reason } });
    return tx.payment.update({ where: { id }, data: { status: "REVERSED" }, include });
  });
  await announce(p);
  return toDto(p);
}

/** Units whose label matches "A-12", "A 1204" or a bare number. */
async function unitIdsMatching(societyId: string, q: string): Promise<string[]> {
  const m = /^(.+?)[-\s/]+(\w*)$/.exec(q.trim());
  const units = await prisma.unit.findMany({
    where: { societyId, ...(m ? { building: { name: { equals: m[1]!, mode: "insensitive" } }, number: { startsWith: m[2]!, mode: "insensitive" } } : { number: { contains: q.trim(), mode: "insensitive" } }) },
    select: { id: true },
    take: 500,
  });
  return units.map((u) => u.id);
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function list(scope: SocietyScope, q: z.output<typeof schemas.payments.PaymentListQuery>, unitScope?: string[]) {
  const where: Prisma.PaymentWhereInput = {
    societyId: scope.societyId,
    ...(unitScope ? { unitId: q.unitId && unitScope.includes(q.unitId) ? q.unitId : { in: unitScope } } : q.unitId ? { unitId: q.unitId } : {}),
    ...(q.status ? { status: q.status } : unitScope ? { status: { not: "CREATED" } } : {}),
    ...(q.mode ? { mode: q.mode } : {}),
    // Dates are when the money arrived, not when the row was keyed in.
    ...(q.from || q.to ? { paidAt: { ...(q.from ? { gte: fromIsoDate(q.from) } : {}), ...(q.to ? { lt: new Date(fromIsoDate(q.to).getTime() + 86_400_000) } : {}) } } : {}),
    ...(q.q
      ? {
          OR: [
            { receipt: { number: { contains: q.q, mode: "insensitive" } } },
            { instrumentNo: { contains: q.q, mode: "insensitive" } },
            { unitId: { in: await unitIdsMatching(scope.societyId, q.q) } },
          ],
        }
      : {}),
  };
  const page = await paginate(q.limit, q.cursor, (p) => prisma.payment.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...p }), (p) => p, () => prisma.payment.count({ where }));
  return { ...page, items: await Promise.all(page.items.map(toDto)) };
}

export async function mine(scope: SocietyScope, userId: string, q: z.output<typeof schemas.payments.PaymentListQuery>) {
  const units = [...(await actingUnitIds(prisma, scope, userId))];
  if (!units.length) return { items: [], nextCursor: null, total: 0 };
  return list(scope, q, units);
}

export async function get(scope: SocietyScope, userId: string, id: string) {
  const p = await load(scope.societyId, id);
  if (!isDesk(scope) && p.payerUserId !== userId && !(await actingUnitIds(prisma, scope, userId)).has(p.unitId)) throw notFound("Payment");
  return toDto(p);
}

/** Checkouts abandoned for 30 minutes are closed, so they don't linger as "processing". */
export const expireCheckouts = defineJob("payments.expire-checkouts", async () => {
  await prisma.payment.updateMany({ where: { status: "CREATED", mode: "ONLINE", createdAt: { lt: new Date(Date.now() - 30 * 60_000) } }, data: { status: "CANCELLED", failureReason: "Checkout not completed" } });
});
