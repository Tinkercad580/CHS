import { staff } from "@sahaj/shared";
import type { AppGateState } from "./types";
import { START_ENTRIES, START_PARCELS, START_ALERTS, STAFF_SEED_STATUS } from "../mock/gateSeed";

/** Deep-copied from the seed constants on every call, so "reset" (if ever wired up) restores cleanly. */
export function createInitialState(): AppGateState {
  return {
    onDuty: false,
    guardName: null,
    pin: "",
    pinError: null,

    screen: "entry",
    cameFrom: "entry",
    code: "",
    checking: false,
    result: null,

    entries: START_ENTRIES.map((e) => ({ ...e })),
    logFilter: "all",

    staff: staff.map((s) => ({ ...s })),
    staffFilter: "all",
    staffInside: Object.fromEntries(staff.map((s) => [s.passNo, STAFF_SEED_STATUS[s.passNo]?.inside ?? false])),
    staffSince: Object.fromEntries(staff.map((s) => [s.passNo, STAFF_SEED_STATUS[s.passNo]?.sinceLabel ?? "Not in today"])),

    parcels: START_PARCELS.map((p) => ({ ...p })),
    parcelOpen: false,
    parcelUnit: "",
    courier: "Blue Dart",
    parcelError: false,

    walkin: { name: "", unit: "", purpose: "Guest" },
    walkinStage: "form",

    plateQuery: "",
    handoverNote: "",
    handoverDone: false,

    alertKind: "Medical",
    holding: false,
    holdPct: 0,
    alerts: START_ALERTS.map((a) => ({ ...a })),

    offline: false,
    toasts: [],
    log: [],
  };
}
