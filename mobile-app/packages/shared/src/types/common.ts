/**
 * Shared domain types for the Sahaj mock data model.
 * The same flats, people, bills, passes and tickets must appear consistently
 * across the resident app and the gate app — see project/design_handoff_sahaj/README.md.
 */

export type Role = "owner" | "tenant" | "owner_tenant";

export interface Society {
  id: string;
  name: string;
  shortCode: string;
  city: string;
  unitCount: number;
}

export interface Unit {
  code: string; // e.g. "A-1204"
  building: string;
  floor: number;
  carpetAreaSqft: number;
}

export interface Person {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export type BillCategory = "maintenance" | "parking" | "facility" | "other";
export type BillStatus = "unpaid" | "paid";

export interface BillLineItem {
  label: string;
  basis?: string; // e.g. "1,180 sq ft × ₹3.20"
  amount: number;
}

export interface Bill {
  id: string;
  unit: string;
  title: string;
  period: string;
  category: BillCategory;
  status: BillStatus;
  amount: number;
  dueDate: string; // ISO date
  lineItems: BillLineItem[];
  paidOn?: string;
  receiptNo?: string;
  paymentMethod?: string;
}

export type NoticeTag = "Urgent" | "AGM" | "Facility" | "Billing";

export interface Notice {
  id: string;
  tag: NoticeTag;
  title: string;
  blurb: string;
  body: string;
  postedAt: string;
  unread: boolean;
  acked: boolean;
  /** Whether this notice shows an "I have read this" acknowledgement action at all (urgent/AGM notices do; routine ones don't). */
  ackable: boolean;
}

export type PassKind = "guest" | "standing";
export type PassState = "expected" | "inside" | "standing" | "expired" | "cancelled";
export type VisitorPurpose = "Guest" | "Delivery" | "Cab" | "Service";

export interface VisitorPass {
  id: string;
  code: string; // 4-digit mono code
  kind: PassKind;
  unit: string;
  name: string;
  purpose: VisitorPurpose;
  state: PassState;
  issuedAt: string;
  validUntil?: string;
}

export type HelpRole = "Housekeeping" | "Cook" | "Driver" | "Nanny" | "Care giver";
export type HelpWindow = "Morning" | "Twice daily" | "Full day" | "Evening";

export interface DailyHelp {
  passNo: string; // ST-nnnn
  unit: string;
  name: string;
  role: HelpRole;
  days: boolean[]; // 7, Mon..Sun
  window: HelpWindow;
  monthlySalary: number;
  perDayRate: number;
}

export type AttendanceState = "present" | "absent" | "off" | "unrecorded";

export interface AttendanceSheet {
  personId: string; // pass number
  /** one entry per calendar day of the month */
  days: AttendanceState[];
}

export type TicketPriority = "normal" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketCategory = "Plumbing" | "Electrical" | "Lift" | "Housekeeping" | "Security" | "Other";

export interface Ticket {
  id: string; // TKT/nnnn, keyed per-unit
  unit: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  lastUpdate: string;
  timeline: { at: string; note: string }[];
}

export interface Amenity {
  id: string;
  name: string;
  capacity: number;
  hours: string;
  rate: number;
  deposit: number;
  open: boolean;
}

export type BookingStatus = "confirmed" | "pending";

export interface Booking {
  id: string;
  amenityId: string;
  unit: string;
  day: string; // ISO date
  slot: number; // 0..2
  status: BookingStatus;
  charge: number;
}

export interface Vehicle {
  id: string;
  unit: string;
  plate: string;
  type: "Car" | "Two-wheeler";
  ownerName: string;
  slot?: string;
  /** Optional cosmetic descriptor, e.g. "Honda City · white" — shown by the gate app's plate lookup. */
  model?: string;
}

export interface HouseholdMember {
  id: string;
  unit: string;
  name: string;
  relation: string;
}

export interface TenantAgreement {
  unit: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  policeVerified: boolean;
  nonOccupancyCharge: number;
}

export interface PollOption {
  key: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  totalUnits: number;
}

export type UtilityState = "normal" | "degraded" | "down";

export interface UtilityStatus {
  id: string;
  name: string;
  state: UtilityState;
  cause?: string;
  updatedAt: string;
}

export type StaffRole = "guard" | "housekeeping" | "plumber" | "electrician" | "gardener";

export interface StaffMember {
  passNo: string; // ST-nnnn
  name: string;
  role: StaffRole;
  flatsServed: string[];
  phone: string;
  policeVerified: boolean;
  monthlySalary: number;
  perDayRate: number;
}

export type EntryStatus = "inside" | "exited" | "turned_away";
export type EntryMethod = "code" | "walk_in";

export interface EntryLogRow {
  id: string;
  method: EntryMethod;
  visitorName: string;
  unit: string;
  purpose: string;
  status: EntryStatus;
  enteredAt: string;
  exitedAt?: string;
  note?: string; // e.g. "walk-in, resident approved"
}

export type ParcelStatus = "held" | "delivered";
export type DeliveryPreference = "Hand to security" | "Call before delivery" | "Leave at door";

export interface Parcel {
  id: string;
  unit: string;
  courier: string;
  status: ParcelStatus;
  loggedAt: string;
  handedAt?: string;
}

export type AlertKind = "Medical" | "Fire" | "Security" | "Other";

export interface GateAlert {
  id: string;
  kind: AlertKind;
  raisedAt: string;
  note?: string;
}

export interface Guard {
  id: string;
  name: string;
  dutyPin: string;
}

/** In-app notification feed item (resident app "Notifications" screen — distinct from the toggle-based preferences below). */
export type NotificationKind = "warn" | "info" | "ok";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  when: string;
  unread: boolean;
}

/** A single toggleable notification preference row (README's `prefs[]`). */
export interface NotificationPreference {
  key: string;
  label: string;
  detail: string;
  on: boolean;
}

export type LedgerEntryKind = "charge" | "payment" | "credit" | "interest";

/** One row of the resident Statement screen's year ledger. Amount is signed: charges/interest positive, payments/credits negative. */
export interface LedgerEntry {
  id: string;
  unit: string;
  label: string;
  when: string;
  note: string;
  amount: number;
  kind: LedgerEntryKind;
}

/** Editable personal-contact fields (README's `me { email, alt, emergency }`) — the mobile number itself is set by the office and is not part of this editable set. */
export interface PersonalInfo {
  email: string;
  alt: string;
  emergency: string;
}
