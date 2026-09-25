import {
  visitorPasses,
  tickets as ticketsSeed,
  amenities as amenitiesSeed,
  bookings as bookingsSeed,
  dailyHelp as dailyHelpSeed,
  attendanceSheets as attendanceSheetsSeed,
  utilities as utilitiesSeed,
  polls as pollsSeed,
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

    // Bills, notices and notifications are read from the API; these only say which one is open.
    activeBillId: null,
    dueFilter: "all",
    activeNoticeId: null,

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
    payTarget: null,
    qrLeftSeconds: 600,
    qrState: "live",

    deliveryPref: "Hand to security",
    editingPersonalDetails: false,
    // Alternate phone and emergency contact have no API field; they start empty
    // rather than as the fixture's (another resident's) numbers. Email is /me's.
    me: { email: "", alt: "", emergency: "" },
    emailPromptDismissed: false,

    amenities: clone(amenitiesSeed),
    bookDay: "Sat 20",
    bookSlot: 1,
    bookAmenityId: null,
    bookings: clone(bookingsSeed),

    votes: {},
    activePollId: "pl1",
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

    toasts: [],
  };
}
