import type { EntryLogRow, StaffMember, Parcel, GateAlert, AlertKind, VisitorPass } from "./common";

export type GateScreen =
  | "entry" | "staff" | "log" | "parcels" | "more"
  | "walkin" | "alert" | "plate" | "handover";

export type VerdictType = "valid" | "expired" | "unknown";

export interface VerifyResult {
  type: VerdictType;
  pass: VisitorPass | null;
}

export type WalkinStage = "form" | "waiting" | "approved";

export interface WalkinForm {
  name: string;
  unit: string;
  purpose: string;
}

export interface GateToast {
  id: string;
  message: string;
}

export interface GateLogEntry {
  id: string;
  at: string;
  message: string;
}

/**
 * Mirrors the gate prototype's state shape (README.md, "State management").
 */
export interface GateState {
  onDuty: boolean;
  guardName: string | null;
  pin: string;
  pinError: string | null;

  screen: GateScreen;
  code: string;
  checking: boolean;
  result: VerifyResult | null;

  entries: EntryLogRow[];
  logFilter: "all" | "inside" | "turned_away";

  staff: StaffMember[];
  staffFilter: "all" | "inside" | "out";
  staffInside: Record<string, boolean>;

  parcels: Parcel[];
  parcelOpen: boolean;
  parcelUnit: string;
  courier: string;

  walkin: WalkinForm;
  walkinStage: WalkinStage;

  plateQuery: string;
  handoverNote: string;
  handoverDone: boolean;

  alertKind: AlertKind | null;
  holding: boolean;
  holdPct: number;
  alerts: GateAlert[];

  offline: boolean;
  toasts: GateToast[];
  log: GateLogEntry[];
}
