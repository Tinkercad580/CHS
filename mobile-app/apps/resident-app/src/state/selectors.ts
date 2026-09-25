import type { AppResidentState } from "./types";
import { HOLDING_LABEL } from "../api/identity";

/**
 * Derived values are computed here, never stored (README's "Derived values are
 * computed, never stored" under State management) — attendance totals, salary
 * payable, vote tallies all live in this file, not in `AppResidentState` fields
 * that could drift from the rows they summarise. Dues, bills and unread counts
 * are the API's and are read through api/billing.ts and friends instead.
 */

export interface UnitInfo {
  code: string;
  line: string;
  /** How the viewed flat is held: the home flat's holding, "Landlord" for a let-out flat, "Owner" for any other. */
  tag: string;
}

/**
 * The active unit and how its ledger reads, after the prototype's `curUnit()`.
 * The flats and the society name are the signed-in account's (`state.identity`).
 * The home flat reads as it is held (owner, co-owner, family member, tenant);
 * another flat of theirs as let out or simply owned.
 */
export function currentUnit(state: AppResidentState): UnitInfo {
  const identity = state.identity;
  const society = identity?.societyName ?? "";
  const other = identity?.otherUnits.find((u) => u.label === state.unit);
  if (other) return other.letOut ? { code: other.label, line: `${other.label} · owned, rented out`, tag: "Landlord" } : { code: other.label, line: `${other.label} · owned`, tag: "Owner" };
  const holding = identity?.homeHolding ?? "owner";
  const tag = HOLDING_LABEL[holding];
  if (holding === "tenant") return { code: state.unit, line: `${state.unit} · ${society} · rented`, tag };
  // With other flats to switch between, the home line says which one this is.
  if (identity && identity.otherUnits.length > 0) return { code: state.unit, line: `${state.unit} · ${holding === "family" ? "family home" : "owned"}, you live here`, tag };
  return { code: state.unit, line: `${state.unit} · ${society}`, tag };
}

/** Passes still expected at the gate for the flat being viewed — the list Visitors shows. */
export function expectedPasses(state: AppResidentState) {
  return state.passes.filter((p) => p.state === "expected" && p.unit === state.unit);
}

/** Open tickets of the flat being viewed, the same scope as the Helpdesk list. */
export function openTicketCount(state: AppResidentState): number {
  return state.tickets.filter((t) => t.unit === state.unit && t.status !== "resolved").length;
}

/** Daily help registered against the flat being viewed — the Daily help screen's list. */
export function unitDailyHelp(state: AppResidentState) {
  return state.dailyHelp.filter((h) => h.unit === state.unit);
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


export const helpRoleWords: Record<string, { mr: string; hi: string }> = {
  Housekeeping: { mr: "साफसफाई", hi: "साफ़-सफ़ाई" },
  Cook: { mr: "स्वयंपाक", hi: "रसोइया" },
  Driver: { mr: "चालक", hi: "ड्राइवर" },
  Nanny: { mr: "आया", hi: "आया" },
  "Care giver": { mr: "देखभाल", hi: "देखभाल" },
};
