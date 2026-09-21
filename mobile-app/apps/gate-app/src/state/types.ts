import type { GateState, GateToast } from "@sahaj/shared";

/** A toast plus the severity that picks its colour (go/hold/stop) — the prototype's toast() takes a "kind" the shared GateToast type doesn't carry. */
export interface AppToast extends GateToast {
  kind: "ok" | "warn" | "bad";
}

/**
 * The gate prototype's state shape (README.md, "State management" → Gate), plus
 * gate-app-local additions that the shared `GateState` type deliberately leaves out
 * because they are pure display bookkeeping, not cross-product domain data:
 *  - `staffSince`: a per-staff-member "in since / left at" label, keyed by pass number.
 *  - `parcelError`: whether the parcel sheet's last save attempt failed validation.
 *  - `toasts`: widened to `AppToast[]` to carry the severity that colours a toast.
 */
export interface AppGateState extends Omit<GateState, "toasts"> {
  toasts: AppToast[];
  staffSince: Record<string, string>;
  parcelError: boolean;
}

/**
 * One state object, updated the way the source prototype does — a patch, or an updater
 * that reads the latest state and returns a patch (for read-modify-write transitions,
 * the same role `this.setState(fn)` plays in the original class component). A single
 * reducer keeps this the one place `AppGateState` is mutated.
 */
export type GateAction =
  | { type: "SET"; patch: Partial<AppGateState> }
  | { type: "UPDATE"; updater: (state: AppGateState) => Partial<AppGateState> };

export function gateReducer(state: AppGateState, action: GateAction): AppGateState {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.patch };
    case "UPDATE":
      return { ...state, ...action.updater(state) };
    default:
      return state;
  }
}
