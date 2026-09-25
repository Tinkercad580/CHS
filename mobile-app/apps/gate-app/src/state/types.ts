import type { GateScreen, GateState, GateToast, WalkinStage } from "@sahaj/shared";

/**
 * A toast plus the severity that picks its colour (go/hold/stop) — the prototype's
 * toast() takes a "kind" the shared GateToast type doesn't carry. `urgent` is an
 * emergency: drawn heavier, held on screen longer and dismissed by a tap.
 */
export interface AppToast extends GateToast {
  kind: "ok" | "warn" | "bad";
  urgent?: boolean;
}

/**
 * Every screen the shell can show: the prototype's nine, plus the office's
 * notices (a list and one notice), which the prototype never had — guards only
 * started receiving notices once the API existed.
 */
export type AppScreen = GateScreen | "notices" | "notice";

/**
 * The gate prototype's state shape (README.md, "State management" → Gate), plus
 * gate-app-local additions that the shared `GateState` type deliberately leaves out
 * because they are pure display bookkeeping, not cross-product domain data:
 *  - `staffSince`: a per-staff-member "in since / left at" label, keyed by pass number.
 *  - `parcelError`: whether the parcel sheet's last save attempt failed validation.
 *  - `toasts`: widened to `AppToast[]` to carry the severity that colours a toast.
 *  - `screen` / `cameFrom`: widened to `AppScreen`, with `noticeId` naming the notice on screen.
 *  - `shiftStartedAt`: when this guard first unlocked the handset after signing in — the
 *    only shift time the handset actually knows (there is no roster in the API yet).
 *  - `walkinStage`: narrowed to the form and the wait for the resident's answer. Nothing
 *    can tell the handset a resident approved (there is no gate module yet), so there is
 *    no "approved" stage; the guard records the answer they got by phone.
 *
 * `guardName` is the signed-in account's name from `/me`. The shared type's `pin`,
 * `pinError` and `offline` are left out: the shift screen keeps the digits it is
 * collecting to itself, and the OFFLINE pill reads the device's network (useOffline).
 */
export interface AppGateState extends Omit<GateState, "toasts" | "screen" | "cameFrom" | "pin" | "pinError" | "offline" | "walkinStage"> {
  screen: AppScreen;
  cameFrom: AppScreen;
  noticeId: string | null;
  shiftStartedAt: string | null;
  toasts: AppToast[];
  staffSince: Record<string, string>;
  parcelError: boolean;
  walkinStage: Exclude<WalkinStage, "approved">;
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
