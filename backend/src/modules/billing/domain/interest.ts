/**
 * Interest on defaulted dues — MASTER_SPEC B3.1: simple (never compound),
 * at the general-body rate, capped by statute. Pure.
 *
 * Interest for a window is the integral of what was actually outstanding each
 * day: a payment on the 10th stops interest on the amount it cleared from the
 * 10th, not from the next bill. Only principal is charged interest; earlier
 * interest never is.
 */
import { add, simpleInterest, ZERO, type Paise } from "../../../core/money";

export interface OverdueBill {
  billId: string;
  number: string | null;
  /** Principal owed on the bill (charges + GST + rounding), before any payment. */
  principalPaise: Paise;
  /** Interest starts the day after this (due date + grace). */
  interestFrom: Date;
  /** Principal payments with their dates, in any order. */
  payments: { date: Date; amountPaise: Paise }[];
}

const DAY = 86_400_000;
const days = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY));

/** Interest on one bill for [windowStart, windowEnd). */
export function interestForBill(bill: OverdueBill, windowStart: Date, windowEnd: Date, bps: number): { amount: Paise; days: number; averagePrincipal: Paise } {
  const start = new Date(Math.max(windowStart.getTime(), bill.interestFrom.getTime()));
  if (start >= windowEnd) return { amount: ZERO, days: 0, averagePrincipal: ZERO };
  const sorted = [...bill.payments].sort((a, b) => a.date.getTime() - b.date.getTime());
  let outstanding = bill.principalPaise;
  for (const p of sorted) if (p.date <= start) outstanding -= p.amountPaise;
  let cursor = start;
  let amount = ZERO;
  for (const p of sorted) {
    if (p.date <= start) continue;
    if (p.date >= windowEnd) break;
    amount = add(amount, simpleInterest(outstanding, bps, days(cursor, p.date)));
    outstanding -= p.amountPaise;
    cursor = p.date;
  }
  amount = add(amount, simpleInterest(outstanding, bps, days(cursor, windowEnd)));
  return { amount, days: days(start, windowEnd), averagePrincipal: outstanding };
}
