import { visitorPasses, type VisitorPass } from "@sahaj/shared";
import type { AppGateState } from "./types";

/** Passes still worth showing on Entry's "expected" list — not ones already spent (expired/cancelled). */
export function expectedPasses(): VisitorPass[] {
  return visitorPasses.filter((p) => p.state !== "expired" && p.state !== "cancelled");
}

/**
 * Derived values are computed, never stored (README.md, "State management" notes) —
 * total inside, parcels held and staff on site all come from filtering the live
 * arrays, so two screens reading them can never disagree.
 */

export function insideCount(state: AppGateState): number {
  return state.entries.filter((e) => e.status === "inside").length;
}

export function heldParcelsCount(state: AppGateState): number {
  return state.parcels.filter((p) => p.status === "held").length;
}

export function staffInsideCount(state: AppGateState): number {
  return state.staff.filter((s) => state.staffInside[s.passNo]).length;
}

export function filteredEntries(state: AppGateState) {
  if (state.logFilter === "inside") return state.entries.filter((e) => e.status === "inside");
  if (state.logFilter === "turned_away") return state.entries.filter((e) => e.status === "turned_away");
  return state.entries;
}

export function filteredStaff(state: AppGateState) {
  if (state.staffFilter === "inside") return state.staff.filter((s) => state.staffInside[s.passNo]);
  if (state.staffFilter === "out") return state.staff.filter((s) => !state.staffInside[s.passNo]);
  return state.staff;
}
