import type {
  Bill, Notice, VisitorPass, Ticket, HouseholdMember, Vehicle, TenantAgreement,
  Poll, UtilityStatus, Amenity, Booking, DailyHelp, AttendanceSheet, DeliveryPreference, Role,
  AppNotification, NotificationPreference, PersonalInfo,
} from "./common";

export type Language = "en" | "mr" | "hi";
export type ResidentTab = "home" | "dues" | "notices" | "visitors" | "profile";
export type PaySheet = null | "pay" | "qr" | "app" | "success";
export type QrState = "live" | "expired";
export type InviteType = "guest" | "help";
export type SosKind = "Medical" | "Fire" | "Security" | "Other";

/**
 * Every screen the resident app can navigate to (README's `screen` field, section 3).
 * Tab roots plus every drill-down/sub-screen/modal-as-screen listed under "Screens".
 */
export type ResidentScreen =
  | "home" | "dues" | "bill" | "notices" | "notice" | "visitors" | "invite" | "passDone"
  | "helpdesk" | "newTicket" | "ticket" | "profile"
  | "personal" | "tenants" | "dailyHelp" | "household" | "vehicles" | "deliveries"
  | "notifPrefs" | "language" | "notifs"
  | "amenities" | "book" | "statement" | "polls" | "poll" | "utilities" | "sos";

export interface ResidentToast {
  id: string;
  message: string;
}

export interface ResidentLogEntry {
  id: string;
  at: string;
  message: string;
}

export interface GuestForm {
  name: string;
  purpose: "Guest" | "Delivery" | "Cab" | "Service";
  window: "2 hours" | "Today" | "This week";
}

export interface TicketForm {
  category: "Plumbing" | "Electrical" | "Lift" | "Housekeeping" | "Security" | "Other";
  issue: string;
  urgent: boolean;
}

export interface HelpForm {
  name: string;
  role: "Housekeeping" | "Cook" | "Driver" | "Nanny" | "Care giver";
  days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  window: "Morning" | "Twice daily" | "Full day" | "Evening";
  salary: string;
}

/**
 * Mirrors the resident prototype's state shape (README.md, "State management").
 * This is the shape to reproduce when translating to React/React Native state.
 */
export interface ResidentState {
  screen: ResidentScreen;
  stack: ResidentScreen[];
  role: Role;
  unit: string;
  language: Language;
  dark: boolean;

  bills: Bill[];
  activeBillId: string | null;
  dueFilter: "all" | "unpaid" | "paid";
  lastPaidBillId: string | null;

  notices: Notice[];
  activeNoticeId: string | null;
  /** In-app notification feed (README's `notifs[]`) — separate from `prefs[]`, the toggles that control it. */
  notifs: AppNotification[];

  passes: VisitorPass[];
  newPassCode: string | null;
  guestForm: GuestForm;

  tickets: Ticket[];
  activeTicketId: string | null;
  ticketForm: TicketForm;
  ticketFormError: boolean;
  submittingTicket: boolean;
  guestFormError: boolean;
  creatingPass: boolean;

  sheet: PaySheet;
  qrLeftSeconds: number;
  qrState: QrState;

  household: HouseholdMember[];
  vehicles: Vehicle[];
  deliveryPref: DeliveryPreference;
  editingPersonalDetails: boolean;
  /** README's `me { email, alt, emergency }` — the mobile number is set by the office and lives outside this. */
  me: PersonalInfo;
  /** README's `prefs[]` — the notification-preference toggles on the Notifications settings screen. */
  prefs: NotificationPreference[];

  amenities: Amenity[];
  bookDay: string | null;
  bookSlot: number | null;
  /** The amenity currently being booked (README's `amenity` field) — null when not on the Book screen. */
  bookAmenityId: string | null;
  bookings: Booking[];

  votes: Record<string, string>;
  activePollId: string | null;
  tenantAgreement: TenantAgreement | null;
  /** Full tenancy history for a let-out unit (active + ended agreements) — `tenantAgreement` above holds just the live one. */
  tenantAgreements: TenantAgreement[];
  /** README's `renewed` — whether a renewal request has been sent for the live agreement. */
  renewed: boolean;

  dailyHelp: DailyHelp[];
  /** One 30-day attendance grid per `dailyHelp` entry, keyed by `passNo` — see `AttendanceSheet`. */
  attendanceSheets: AttendanceSheet[];
  activeHelpPassNo: string | null;
  paidHelp: Record<string, boolean>;
  helpForm: HelpForm;

  inviteType: InviteType;
  utilities: UtilityStatus[];
  polls: Poll[];

  /** Scratch fields for the "Add a member" form on the Household screen. */
  memberNameInput: string;
  relationInput: "Spouse" | "Child" | "Parent";
  /** Scratch fields for the "Register a vehicle" form on the Vehicles screen. */
  plateInput: string;
  vehicleTypeInput: "Car" | "Two-wheeler";

  sosKind: SosKind | null;
  holdingSos: boolean;
  sosPct: number;
  sosSent: boolean;

  toasts: ResidentToast[];
  log: ResidentLogEntry[];
}
