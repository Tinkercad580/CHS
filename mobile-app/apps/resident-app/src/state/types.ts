import type { PaySheet, ResidentState, ResidentToast } from "@sahaj/shared";
import type { ResidentIdentity } from "../api/identity";

/** A toast plus the severity that picks its colour — the prototype's toast() takes a "kind" the shared type doesn't carry. */
export interface AppToast extends ResidentToast {
  kind: "ok" | "warn";
}

/** What the payment sheets are paying: a unit's dues, as the API's dues card states them. */
export interface PayTarget {
  unitId: string;
  unitLabel: string;
  amountPaise: number;
  /** What the sheet says is being paid — "Maintenance — September 2026", or "Dues for C-0405" when several bills are open. */
  title: string;
}

/**
 * The resident prototype's state shape (README.md "State management" → Resident),
 * widened where toasts need a kind and with the signed-in account's identity —
 * which flats `role`/`unit` may point at, and the society they belong to. It is
 * null until the session gate adopts an account (see SignedInApp).
 *
 * Bills, notices, the notification inbox and its preferences are the API's now
 * (api/billing.ts, api/notices.ts, api/notifications.ts), so their fixture
 * arrays are gone; only which one is open stays here. So are the household,
 * vehicles and tenancies (members.myHome). The SOS hold and the action log
 * have no screen left that reads them. `sheet` gains "failed", the
 * declined-payment outcome the prototype never had.
 */
export interface AppResidentState
  extends Omit<
    ResidentState,
    | "toasts" | "bills" | "notices" | "notifs" | "prefs" | "lastPaidBillId" | "sheet"
    | "household" | "vehicles" | "tenantAgreement" | "tenantAgreements" | "log"
    | "sosKind" | "holdingSos" | "sosPct" | "sosSent"
  > {
  toasts: AppToast[];
  identity: ResidentIdentity | null;
  sheet: PaySheet | "failed";
  payTarget: PayTarget | null;
  /** The "add your email" prompt was closed — for this session only. */
  emailPromptDismissed: boolean;
}

/**
 * One state object, updated the way the source prototype does — a patch, or an
 * updater that reads the latest state and returns a patch (the same role
 * `this.setState(fn)` plays in the original class component). A single reducer
 * keeps this the one place `AppResidentState` is mutated — mirrors the gate app's
 * `state/types.ts`.
 */
export type ResidentAction =
  | { type: "SET"; patch: Partial<AppResidentState> }
  | { type: "UPDATE"; updater: (state: AppResidentState) => Partial<AppResidentState> };

export function residentReducer(state: AppResidentState, action: ResidentAction): AppResidentState {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.patch };
    case "UPDATE":
      return { ...state, ...action.updater(state) };
    default:
      return state;
  }
}
