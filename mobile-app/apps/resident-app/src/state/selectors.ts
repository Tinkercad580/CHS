import { FOCUS_UNIT_OWNER, FOCUS_UNIT_LET_OUT, formatInr, type Bill } from "@sahaj/shared";
import type { AppResidentState } from "./types";

/**
 * Derived values are computed here, never stored (README's "Derived values are
 * computed, never stored" under State management) — total due, unread counts,
 * attendance totals, salary payable, vote tallies all live in this file, not in
 * `AppResidentState` fields that could drift from the rows they summarise.
 */

export interface UnitInfo {
  code: string;
  line: string;
  tag: "Owner" | "Tenant" | "Landlord";
}

/** The active unit and how its ledger reads, mirroring the prototype's `curUnit()`. */
export function currentUnit(state: AppResidentState): UnitInfo {
  if (state.role === "owner") return { code: FOCUS_UNIT_OWNER, line: `${FOCUS_UNIT_OWNER} · Shanti Vihar CHS`, tag: "Owner" };
  if (state.role === "tenant") return { code: state.unit, line: `${state.unit} · Shanti Vihar CHS · rented`, tag: "Tenant" };
  // owner_tenant: `unit` toggles between the owned/occupied flat and the let-out flat.
  if (state.unit === FOCUS_UNIT_LET_OUT) return { code: FOCUS_UNIT_LET_OUT, line: `${FOCUS_UNIT_LET_OUT} · owned, rented out`, tag: "Landlord" };
  return { code: FOCUS_UNIT_OWNER, line: `${FOCUS_UNIT_OWNER} · owned, you live here`, tag: "Owner" };
}

/**
 * Bills scoped to the active unit and role (README's "Roles and data scoping" —
 * scope on role/unit, not just a summary line). Facility charges never show for a
 * tenant or on a let-out ledger, since those bills simply don't belong to that unit.
 */
export function visibleBills(state: AppResidentState): Bill[] {
  const unit = currentUnit(state).code;
  let list = state.bills.filter((b) => b.unit === unit);
  if (state.role === "tenant") list = list.filter((b) => b.category !== "facility");
  if (state.dueFilter === "unpaid") list = list.filter((b) => b.status === "unpaid");
  if (state.dueFilter === "paid") list = list.filter((b) => b.status === "paid");
  return list;
}

export function totalDue(state: AppResidentState): number {
  const unit = currentUnit(state).code;
  return state.bills.filter((b) => b.unit === unit && b.status === "unpaid").reduce((sum, b) => sum + b.amount, 0);
}

export function unpaidBillCount(state: AppResidentState): number {
  const unit = currentUnit(state).code;
  return state.bills.filter((b) => b.unit === unit && b.status === "unpaid").length;
}

export function unreadNoticeCount(state: AppResidentState): number {
  return state.notices.filter((n) => n.unread).length;
}

export function unreadNotifCount(state: AppResidentState): number {
  return state.notifs.filter((n) => n.unread).length;
}

export function expectedPasses(state: AppResidentState) {
  return state.passes.filter((p) => p.state === "expected");
}

export function openTicketCount(state: AppResidentState): number {
  return state.tickets.filter((t) => t.status !== "resolved").length;
}

export function activeBill(state: AppResidentState): Bill {
  return state.bills.find((b) => b.id === state.activeBillId) ?? state.bills[0];
}

export interface HelpSummary {
  present: number;
  absent: number;
  off: number;
  unrecorded: number;
  totalWorkingDays: number;
  perDay: number;
  payable: number;
}

/** Attendance totals for one daily-help person — computed from their sheet, never stored (matches admin's "Staff & help" discipline). */
export function helpSummary(state: AppResidentState, passNo: string): HelpSummary {
  const person = state.dailyHelp.find((h) => h.passNo === passNo);
  const sheet = state.attendanceSheets.find((s) => s.personId === passNo);
  const days = sheet?.days ?? [];
  const present = days.filter((d) => d === "present").length;
  const absent = days.filter((d) => d === "absent").length;
  const off = days.filter((d) => d === "off").length;
  const unrecorded = days.filter((d) => d === "unrecorded").length;
  const totalWorkingDays = person ? Math.round(person.monthlySalary / Math.max(1, person.perDayRate)) : 0;
  const perDay = person?.perDayRate ?? 0;
  return { present, absent, off, unrecorded, totalWorkingDays, perDay, payable: Math.round(perDay * present) };
}

export interface PollTallyOption {
  key: string;
  label: string;
  count: number;
  pct: number;
  picked: boolean;
}

/** Live tally for one poll, folding in the viewer's own (uncommitted-to-seed) vote — mirrors the prototype's `pollOptions`. */
export function pollTally(state: AppResidentState, pollId: string): PollTallyOption[] {
  const poll = state.polls.find((p) => p.id === pollId);
  if (!poll) return [];
  const mine = state.votes[pollId];
  const total = poll.options.reduce((a, o) => a + o.votes, 0) + (mine ? 1 : 0);
  return poll.options.map((o) => {
    const count = o.votes + (mine === o.key ? 1 : 0);
    return { key: o.key, label: o.label, count, pct: total > 0 && mine ? Math.round((count / total) * 100) : 0, picked: mine === o.key };
  });
}

export function ledgerBalanceLabel(amount: number): string {
  return formatInr(amount);
}

export const helpRoleWords: Record<string, { mr: string; hi: string }> = {
  Housekeeping: { mr: "साफसफाई", hi: "साफ़-सफ़ाई" },
  Cook: { mr: "स्वयंपाक", hi: "रसोइया" },
  Driver: { mr: "चालक", hi: "ड्राइवर" },
  Nanny: { mr: "आया", hi: "आया" },
  "Care giver": { mr: "देखभाल", hi: "देखभाल" },
};
