import type { ResidentState, ResidentToast } from "@sahaj/shared";

/** A toast plus the severity that picks its colour — the prototype's toast() takes a "kind" the shared type doesn't carry. */
export interface AppToast extends ResidentToast {
  kind: "ok" | "warn";
}

/** The resident prototype's state shape (README.md "State management" → Resident), widened only where toasts need a kind. */
export interface AppResidentState extends Omit<ResidentState, "toasts"> {
  toasts: AppToast[];
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
