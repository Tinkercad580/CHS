import {
  FOCUS_UNIT_OWNER,
  bills as billsSeed,
  notices as noticesSeed,
  notifications as notifsSeed,
  visitorPasses,
  tickets as ticketsSeed,
  household as householdSeed,
  vehicles as vehiclesSeed,
  amenities as amenitiesSeed,
  bookings as bookingsSeed,
  tenantAgreements as tenantAgreementsSeed,
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
    role: "owner",
    unit: FOCUS_UNIT_OWNER,
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

    household: clone(householdSeed),
    vehicles: clone(vehiclesSeed),
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
    tenantAgreements: clone(tenantAgreementsSeed),
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
