import { add, min, sub, ZERO, type Paise } from "../../core/money";
import type { Prisma } from "../../core/db";

type Tx = Prisma.TransactionClient;
type Bucket = "INTEREST" | "ARREARS" | "CURRENT";

/**
 * Apply money to a unit's open bills — MASTER_SPEC C5. The society's order
 * decides which buckets are cleared first (by default interest, then arrears,
 * then the current bill); within a bucket, oldest bill first. Whatever is left
 * becomes an advance, applied automatically to the next bills published.
 */
export async function allocate(tx: Tx, societyId: string, unitId: string, paymentId: string, amount: Paise, order: readonly Bucket[]): Promise<Paise> {
  const bills = await tx.bill.findMany({
    where: { societyId, unitId, status: "PUBLISHED" },
    orderBy: [{ dueDate: "asc" }, { billDate: "asc" }],
    select: { id: true, billDate: true, principalPaise: true, gstPaise: true, roundingPaise: true, interestPaise: true, principalPaidPaise: true, interestPaidPaise: true },
  });
  const latest = bills.reduce<(typeof bills)[number] | null>((l, b) => (!l || b.billDate > l.billDate ? b : l), null);
  let left = amount;
  const give = async (billId: string, bucket: "INTEREST" | "PRINCIPAL", open: Paise) => {
    const take = min(left, open);
    if (take <= ZERO) return;
    await tx.bill.update({ where: { id: billId }, data: bucket === "INTEREST" ? { interestPaidPaise: { increment: take } } : { principalPaidPaise: { increment: take } } });
    await tx.allocation.create({ data: { societyId, paymentId, unitId, billId, bucket, amountPaise: take } });
    left = sub(left, take);
    const b = bills.find((x) => x.id === billId)!;
    if (bucket === "INTEREST") b.interestPaidPaise = add(b.interestPaidPaise, take);
    else b.principalPaidPaise = add(b.principalPaidPaise, take);
  };
  for (const bucket of order) {
    for (const b of bills) {
      if (left <= ZERO) break;
      if (bucket === "INTEREST") await give(b.id, "INTEREST", sub(b.interestPaise, b.interestPaidPaise));
      else if ((bucket === "CURRENT") === (b.id === latest?.id)) await give(b.id, "PRINCIPAL", sub(add(b.principalPaise, b.gstPaise, b.roundingPaise), b.principalPaidPaise));
    }
  }
  if (left > ZERO) await tx.allocation.create({ data: { societyId, paymentId, unitId, billId: null, bucket: "ADVANCE", amountPaise: left } });
  return left;
}

/** Move a unit's advance balance onto its open bills, oldest advance first. */
export async function applyAdvances(tx: Tx, societyId: string, unitId: string, order: readonly Bucket[]): Promise<void> {
  const rows = await tx.allocation.groupBy({ by: ["paymentId"], where: { unitId, bucket: "ADVANCE" }, _sum: { amountPaise: true } });
  const positive = rows.filter((r) => (r._sum.amountPaise ?? ZERO) > ZERO);
  if (!positive.length) return;
  const payments = await tx.payment.findMany({ where: { id: { in: positive.map((r) => r.paymentId) } }, select: { id: true, paidAt: true } });
  positive.sort((a, b) => (payments.find((p) => p.id === a.paymentId)?.paidAt?.getTime() ?? 0) - (payments.find((p) => p.id === b.paymentId)?.paidAt?.getTime() ?? 0));
  for (const r of positive) {
    const available = r._sum.amountPaise!;
    // Take the advance back out, then allocate it as if it had just arrived; what doesn't fit returns as advance.
    await tx.allocation.create({ data: { societyId, paymentId: r.paymentId, unitId, billId: null, bucket: "ADVANCE", amountPaise: -available } });
    const remainder = await allocate(tx, societyId, unitId, r.paymentId, available, order);
    if (remainder === available) break; // nothing open to apply to
  }
}

/** Undo every allocation of a payment (receipt cancelled, cheque bounced). */
export async function reverseAllocations(tx: Tx, paymentId: string): Promise<void> {
  const rows = await tx.allocation.groupBy({ by: ["billId", "bucket", "unitId", "societyId"], where: { paymentId }, _sum: { amountPaise: true } });
  for (const r of rows) {
    const amount = r._sum.amountPaise ?? ZERO;
    if (amount === ZERO) continue;
    if (r.billId && r.bucket !== "ADVANCE") {
      await tx.bill.update({ where: { id: r.billId }, data: r.bucket === "INTEREST" ? { interestPaidPaise: { decrement: amount } } : { principalPaidPaise: { decrement: amount } } });
    }
    await tx.allocation.create({ data: { societyId: r.societyId, paymentId, unitId: r.unitId, billId: r.billId, bucket: r.bucket, amountPaise: -amount } });
  }
}
