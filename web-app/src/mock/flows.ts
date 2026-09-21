/** User-flows screen seed (README section 2, "flows" nav item). */
export type FlowTag = "web" | "app" | "gate" | "both";

export interface Flow {
  surface: string;
  name: string;
  note: string;
  tag: FlowTag;
  steps: string[];
  guard: string;
}

export const TAGS: Record<FlowTag, { bg: string; fg: string }> = {
  web: { bg: "var(--accent-wash,#E6F2EF)", fg: "var(--accent-ink,#0A5749)" },
  app: { bg: "var(--info-wash,#EAF0FE)", fg: "var(--info-ink,#12327A)" },
  gate: { bg: "var(--warn-wash,#FDF3E7)", fg: "var(--warn-ink,#7C3D06)" },
  both: { bg: "var(--border-soft,#F1F4F3)", fg: "var(--ink-soft,#3D4A46)" },
};

export const FLOWS: Flow[] = [
  { surface: "Admin web", name: "Onboard a society and go live", note: "Target: under 30 minutes for 500 units", tag: "web", steps: ["Society profile & registration", "Buildings, floors, units", "Excel import with dry-run", "Charge heads & rates", "Opening balances", "Go-live gate"], guard: "Go-live is blocked until there is one admin, one unit, billing config, a bank account, charge heads and opening balances." },
  { surface: "Both", name: "First login — no OTP anywhere", note: "Admin provisions, resident activates", tag: "both", steps: ["Admin adds mobile + permissions", "Resident enters mobile", "Number found, no password", "Create password + accept terms", "Landed on home"], guard: "An unknown number gets one message: contact the society office. No self-signup, no OTP, no back door." },
  { surface: "Admin web", name: "Bill run to published bills", note: "1,000 units in under 2 minutes", tag: "web", steps: ["Snapshot unit attributes", "Compute by apportionment", "Preview totals & variance", "Resolve exceptions", "Approve", "Publish + notify"], guard: "Published bills are immutable. Corrections go through a credit note or cancel-and-reissue, both retained on record." },
  { surface: "Resident app", name: "Pay dues", note: "Receipt visible within 10 seconds", tag: "app", steps: ["Dues card on home", "Bill detail with per-head reason", "Choose amount & method", "Gateway or UPI QR", "Receipt + WhatsApp copy"], guard: "A receipt is issued only on confirmed success. Cheques stay provisional until cleared; a bounce reverses and posts a charge." },
  { surface: "Gate app", name: "Walk-in visitor approval", note: "Entry logged in under 30 seconds", tag: "gate", steps: ["Guard captures visitor + photo", "Push to unit occupants", "Allow / Deny / Call, 45 s", "No response → guard call", "Entry logged, pass issued"], guard: "Guards call residents through a proxy number. Real phone numbers are never shown, online or offline." },
  { surface: "Both", name: "Complaint to resolution", note: "SLA timers pause outside working hours", tag: "both", steps: ["Resident raises in ≤4 taps", "Auto-assign by category", "Staff acknowledges & starts", "Resolve with proof photo", "Resident confirms & rates"], guard: "No confirmation in 72 hours auto-closes the ticket. Reopening stays available for 72 hours after that." },
  { surface: "Admin web", name: "Dues recovery ladder", note: "Payment at any stage de-escalates", tag: "web", steps: ["Watch 1–30 days", "Reminder 30–60", "Demand notice 60–90", "Final notice 90–120", "Legal bundle 120+"], guard: "Every notice cites its rule, attaches a ledger extract and interest computation, and stores RPAD or courier dispatch proof." },
  { surface: "Both", name: "AGM end to end", note: "Produces a Registrar-ready record pack", tag: "both", steps: ["Agenda & resolutions", "Notice period validated", "RSVP, proxy, QR check-in", "Live quorum & voting", "Minutes approved & locked"], guard: "A notice below the statutory lead time cannot be published without an explicit override and a recorded reason." },
];
