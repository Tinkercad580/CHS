import { api, type BillRecord as Bill, type Dues, type Ledger, type PaymentRecord as Payment } from "@chs/contract";
import { useApiInfiniteQuery, useApiQuery, toLoadState, type LoadState } from "@chs/api-client/react";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../state/ResidentProvider";
import { unitByLabel, useResidentAccount } from "./identity";

/**
 * The resident's money: dues cards, bills and payments, straight from the API.
 *
 * Every figure is integer paise on the wire and stays that way until it is
 * printed. Nothing here totals or derives a balance — the server's dues card
 * already carries current, arrears, interest and total, and the bill carries
 * its own balance, so the app cannot drift from the society's ledger.
 * Realtime `billing.changed` / `payments.changed` refetch these queries.
 */

export type { Bill, Dues, Ledger, Payment };
export type LedgerEntry = Ledger["entries"][number];

/** The society every resident query is scoped to — the adopted identity's. */
export function useSocietyId(): string {
  return useResident().state.identity?.societyId ?? "";
}

/** One dues card per unit the resident pays for (MASTER_SPEC C4). */
export function useMyDues(): LoadState<Dues[]> {
  const societyId = useSocietyId();
  return toLoadState(useApiQuery(api.billing.myDues, { params: { societyId } }, { enabled: societyId !== "" }));
}

export function duesForUnit(list: Dues[], label: string): Dues | undefined {
  return list.find((d) => d.unitLabel === label);
}

/**
 * The due date to headline. `nextDueDate` is the next one still ahead, so once
 * a new month is billed it moves on even while last month's bill is overdue;
 * the oldest overdue open bill wins, so arrears are never shown as "due later".
 */
export function duesDeadline(dues: Dues): { date: string; overdue: boolean } | null {
  const overdue = dues.openBills.filter((b) => b.paymentState === "OVERDUE").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (overdue) return { date: overdue.dueDate, overdue: true };
  return dues.nextDueDate ? { date: dues.nextDueDate, overdue: (dues.daysLeft ?? 0) < 0 } : null;
}

/**
 * The id of a flat the app knows by label. The dues card names it; a flat with
 * no card (nothing ever billed) is found through myHome. Undefined while both
 * are still loading.
 */
export function useUnitId(label: string): { unitId: string | undefined; loading: boolean } {
  const dues = useMyDues();
  const { home } = useResidentAccount();
  const unitId =
    (dues.status === "ready" ? duesForUnit(dues.data, label)?.unitId : undefined) ??
    (home.status === "ready" ? unitByLabel(home.data, label)?.unit.id : undefined);
  return { unitId, loading: !unitId && (dues.status === "loading" || home.status === "loading") };
}

/** The first year of the financial year (April to March, IST) a date falls in. */
function fyStartYear(isoDate = todayIso()): number {
  const [y, m] = parts(isoDate);
  return m >= 4 ? y : y - 1;
}

/** The current financial year as statements name it: "2026-27". */
export function financialYear(isoDate = todayIso()): string {
  const start = fyStartYear(isoDate);
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** One unit's ledger for the current financial year (April to March), with its running balance. */
export function useUnitLedger(unitId: string | undefined) {
  const societyId = useSocietyId();
  const from = `${fyStartYear()}-04-01`;
  return useApiQuery(api.billing.ledger, { params: { societyId, unitId: unitId ?? "" }, query: { from } }, { enabled: !!unitId && societyId !== "" });
}

/** Bills of one unit, newest first, a page at a time. Filtering is done here, not by `state=`, which the server applies after paging. */
export function useUnitBills(unitId: string | undefined) {
  const societyId = useSocietyId();
  return useApiInfiniteQuery(api.billing.myBills, { params: { societyId }, query: { unitId, limit: 50 } }, { enabled: !!unitId && societyId !== "" });
}

/** Settled payments of one unit — the receipts, and when each bill was settled. */
export function useUnitPayments(unitId: string | undefined) {
  const societyId = useSocietyId();
  return useApiQuery(api.payments.mine, { params: { societyId }, query: { unitId, limit: 100 } }, { enabled: !!unitId && societyId !== "" });
}

/**
 * The most recent successful payment that paid into a bill — where "Paid 12 Aug"
 * and the receipt number on a settled bill come from. The bill itself carries
 * only how much has been paid, not by what.
 */
export function settlingPayment(payments: Payment[] | undefined, billId: string): Payment | undefined {
  return payments
    ?.filter((p) => p.status === "SUCCESS" && p.allocations.some((a) => a.billId === billId))
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
}

// ---- Bill state -------------------------------------------------------------

export type BillTone = "paid" | "unpaid" | "overdue";

/** The three looks a bill card has: settled, open, and open past its due date. */
export function billTone(bill: Bill): BillTone {
  if (bill.paymentState === "PAID" || bill.paymentState === "CANCELLED") return "paid";
  return bill.paymentState === "OVERDUE" ? "overdue" : "unpaid";
}

export const BILL_STATE_LABEL: Record<Bill["paymentState"], string> = {
  DRAFT: "Draft",
  UNPAID: "Unpaid",
  PARTLY_PAID: "Part paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

/** The tag on a bill card — what kind of bill, since every regular bill is the month's maintenance. */
export function billTag(bill: Bill): string {
  return bill.kind === "SUPPLEMENTARY" ? "Supplementary" : "Maintenance";
}

/** "Due in 6 days", "Due today", "Overdue by 10 days" — for a due date against today. */
export function dueWhen(dueDate: string, today = todayIso()): string {
  const days = daysBetween(today, dueDate);
  if (days > 1) return `Due in ${days} days`;
  if (days === 1) return "Due tomorrow";
  if (days === 0) return "Due today";
  return days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`;
}

// ---- Money and dates ----------------------------------------------------------

/**
 * Integer paise → the design's "₹4,850", with Indian grouping. Paise are shown
 * only when there are any, and then always as two digits ("₹213.30") — the
 * shared formatInr drops a trailing zero, which is right for its rupee
 * figures and wrong for money that has paise. Integer arithmetic throughout.
 */
export function formatPaise(paise: number): string {
  const abs = Math.abs(Math.round(paise));
  const rest = abs % 100;
  return `${paise < 0 ? "-" : ""}${formatInr(Math.floor(abs / 100))}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(isoDate: string): [number, number, number] {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}

/** Today as the society's calendar sees it (IST), YYYY-MM-DD. */
export function todayIso(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = parts(fromIso);
  const [ty, tm, td] = parts(toIso);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** "2026-09-15" → "15 Sep". */
export function dayMonth(isoDate: string): string {
  const [, m, d] = parts(isoDate);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "2026-09-15" → "15 September 2026". */
export function longDate(isoDate: string): string {
  const [y, m, d] = parts(isoDate);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** A billing period "2026-09" → "1 Sep – 30 Sep 2026", the way the design prints a bill's cover. */
export function periodRange(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `1 ${MONTHS_SHORT[m - 1]} – ${last} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** An instant, in India's calendar: "12 Aug 2026, 5:30 pm". */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** An instant as its IST calendar date, for the day-level helpers above. */
export function istDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** "Just now", "2 hours ago", "Yesterday", "4 days ago", then the date — how the design dates notices and alerts. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = daysBetween(istDate(iso), istDate(new Date(now).toISOString()));
  if (days <= 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return dayMonth(istDate(iso));
}

/** How a payment was made, as a receipt reads it. */
export const PAYMENT_MODE_LABEL: Record<Payment["mode"], string> = {
  ONLINE: "Online",
  UPI: "UPI",
  CASH: "Cash",
  CHEQUE: "Cheque",
  NEFT: "NEFT",
  RTGS: "RTGS",
  IMPS: "IMPS",
  OTHER: "Other",
};
