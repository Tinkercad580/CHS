import {
  bills as billsSeed,
  notices as noticesSeed,
  notifications as notifsSeed,
  visitorPasses,
  tickets as ticketsSeed,
  amenities as amenitiesSeed,
  bookings as bookingsSeed,
  dailyHelp as dailyHelpSeed,
  attendanceSheets as attendanceSheetsSeed,
  utilities as utilitiesSeed,
  polls as pollsSeed,
  notificationPreferences,
  personalInfo,
} from "@sahaj/shared";
import type { AppResidentState } from "./types";

/** Deep-copies the shared mock seed into fresh state — README's "seeds from a constant and is deep-copied into state, so Reset restores it cleanly". */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createInitialState(): AppResidentState {
  return {
    screen: "home",
    stack: [],
    // Replaced by the signed-in account's own role and flat before any screen renders.
    role: "owner",
    unit: "",
    identity: null,
    language: "en",
    dark: false,

    bills: clone(billsSeed),
    activeBillId: "b1",
    dueFilter: "all",
    lastPaidBillId: null,

    notices: clone(noticesSeed),
    activeNoticeId: "n1",
    notifs: clone(notifsSeed),

    passes: clone(visitorPasses),
    newPassCode: null,
    guestForm: { name: "", purpose: "Guest", window: "2 hours" },

    tickets: clone(ticketsSeed),
    activeTicketId: "TKT-2291",
    ticketForm: { category: "Plumbing", issue: "", urgent: false },
    ticketFormError: false,
    submittingTicket: false,
    guestFormError: false,
    creatingPass: false,

    sheet: null,
    qrLeftSeconds: 600,
    qrState: "live",

    // Household, vehicles and tenancies are the society's records now — read from
    // the API's myHome (api/identity.ts), never seeded here.
    household: [],
    vehicles: [],
    deliveryPref: "Hand to security",
    editingPersonalDetails: false,
    me: clone(personalInfo),
    prefs: clone(notificationPreferences),

    amenities: clone(amenitiesSeed),
    bookDay: "Sat 20",
    bookSlot: 1,
    bookAmenityId: null,
    bookings: clone(bookingsSeed),

    votes: {},
    activePollId: "pl1",
    tenantAgreement: null,
    tenantAgreements: [],
    renewed: false,

    dailyHelp: clone(dailyHelpSeed),
    attendanceSheets: clone(attendanceSheetsSeed),
    activeHelpPassNo: "ST-1101",
    paidHelp: {},
    helpForm: { name: "", role: "Housekeeping", days: [true, true, true, true, true, true, false], window: "Morning", salary: "" },

    inviteType: "guest",
    utilities: clone(utilitiesSeed),
    polls: clone(pollsSeed),

    memberNameInput: "",
    relationInput: "Spouse",
    plateInput: "",
    vehicleTypeInput: "Car",

    sosKind: "Medical",
    holdingSos: false,
    sosPct: 0,
    sosSent: false,

    toasts: [],
    log: [],
  };
}
