import {
  FOCUS_UNIT_OWNER,
  FOCUS_UNIT_TENANT,
  FOCUS_UNIT_LET_OUT,
  staff,
  type EntryLogRow,
  type Parcel,
  type GateAlert,
  type DeliveryPreference,
  type AlertKind,
} from "@sahaj/shared";

/** Helper: today's date at a fixed hour/minute, so seed timestamps read naturally regardless of when the app is opened. */
function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Which of the shared staff register are on the premises right now, and since when — gate-app-local, since @sahaj/shared's StaffMember carries no attendance state. */
export const STAFF_SEED_STATUS: Record<string, { inside: boolean; sinceLabel: string }> = {
  [staff[0].passNo]: { inside: true, sinceLabel: "In 7:05am" }, // Sunita Kamble
  [staff[1].passNo]: { inside: true, sinceLabel: "In 6:30am" }, // Mahesh Jadhav
  [staff[2].passNo]: { inside: false, sinceLabel: "Not in today" }, // Vikram Singh
  [staff[3].passNo]: { inside: false, sinceLabel: "Left 11:20am" }, // Anita Rao
};

export const START_ENTRIES: EntryLogRow[] = [
  {
    id: "e1",
    method: "code",
    visitorName: "Meera Joshi",
    unit: FOCUS_UNIT_OWNER,
    purpose: "Guest",
    status: "inside",
    enteredAt: todayAt(16, 12),
    note: "code 4821",
  },
  {
    id: "e2",
    method: "code",
    visitorName: "Amazon Logistics",
    unit: FOCUS_UNIT_TENANT,
    purpose: "Delivery",
    status: "exited",
    enteredAt: todayAt(16, 2),
    exitedAt: todayAt(16, 9),
    note: "code 7093",
  },
  {
    id: "e3",
    method: "walk_in",
    visitorName: "Unknown walk-in",
    unit: FOCUS_UNIT_LET_OUT,
    purpose: "Asked for the flat",
    status: "turned_away",
    enteredAt: todayAt(15, 46),
    note: "resident did not answer",
  },
  {
    id: "e4",
    method: "code",
    visitorName: "Prakash Rao",
    unit: FOCUS_UNIT_LET_OUT,
    purpose: "Resident",
    status: "exited",
    enteredAt: todayAt(15, 20),
    exitedAt: todayAt(15, 21),
  },
];

export const START_PARCELS: Parcel[] = [
  { id: "q1", unit: FOCUS_UNIT_OWNER, courier: "Blue Dart", status: "held", loggedAt: todayAt(14, 40) },
  { id: "q2", unit: FOCUS_UNIT_TENANT, courier: "Amazon", status: "held", loggedAt: todayAt(13, 5) },
  {
    id: "q3",
    unit: "A-1203",
    courier: "Flipkart",
    status: "delivered",
    loggedAt: todayAt(9, 30),
    handedAt: todayAt(11, 20),
  },
];

export const START_ALERTS: GateAlert[] = [
  {
    id: "a1",
    kind: "Medical",
    raisedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
    note: "Ambulance reached in 9 minutes. Closed by secretary.",
  },
];

export const ALERT_KINDS: AlertKind[] = ["Medical", "Fire", "Security", "Other"];

export const UNIT_DELIVERY_PREFS: Record<string, DeliveryPreference> = {
  [FOCUS_UNIT_OWNER]: "Hand to security",
  [FOCUS_UNIT_TENANT]: "Call before delivery",
  [FOCUS_UNIT_LET_OUT]: "Leave at door",
  "A-1203": "Hand to security",
};

export const WALKIN_PURPOSES = ["Guest", "Delivery", "Cab", "Service", "Broker"] as const;
export type WalkinPurpose = (typeof WALKIN_PURPOSES)[number];

export const COURIERS = ["Blue Dart", "Amazon", "Flipkart", "Swiggy", "Zomato", "Other"] as const;
