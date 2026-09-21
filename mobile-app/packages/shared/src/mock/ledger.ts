import type { LedgerEntry } from "../types/common";
import { FOCUS_UNIT_OWNER } from "./society";

/** Bye-law 68 charges 1.5% simple interest a month on anything unpaid past its due date — the rate shown on the Statement screen. */
export const lateInterestMonthlyRate = 0.015;

export const ledger: LedgerEntry[] = [
  { id: "l1", unit: FOCUS_UNIT_OWNER, label: "Maintenance — August", when: "4 Aug 2026", note: "UPI · RCP-2026-08-1204", amount: -4850, kind: "payment" },
  { id: "l2", unit: FOCUS_UNIT_OWNER, label: "Clubhouse booking", when: "10 Aug 2026", note: "UPI · RCP-2026-08-0977", amount: -2500, kind: "payment" },
  { id: "l3", unit: FOCUS_UNIT_OWNER, label: "Maintenance — September", when: "1 Sep 2026", note: "Due 17 Sep", amount: 4850, kind: "charge" },
  { id: "l4", unit: FOCUS_UNIT_OWNER, label: "Parking — Q3", when: "1 Sep 2026", note: "Due 17 Sep", amount: 1200, kind: "charge" },
  { id: "l5", unit: FOCUS_UNIT_OWNER, label: "Clubhouse refund", when: "8 Sep 2026", note: "Flooring work · credited", amount: -2500, kind: "credit" },
  { id: "l6", unit: FOCUS_UNIT_OWNER, label: "Interest on July arrears", when: "1 Aug 2026", note: "1.5% monthly, bye-law 68", amount: 73, kind: "interest" },
];
