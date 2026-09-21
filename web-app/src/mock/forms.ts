/**
 * FORMS — one data-driven field spec per screen's primary action, mirroring
 * FORMS in design-files/Admin Web.dc.html. `formFields()` zips the 5-entry
 * `meta` array against the page's own columns so a field's label is always
 * derived from the column it writes (README: "Field labels are derived from
 * the table, not authored alongside it").
 */
import type { FormField, FormSpec, PillKind } from "../lib/types";
import { PAGES } from "./pages";

export const K5 = ["a", "b", "c", "d", "e"] as const;

export const FORMS: Record<string, FormSpec> = {
  members: {
    key: "members",
    title: "Add member",
    blurb: "A unit with an owner. Occupancy is dated, never overwritten — the non-occupancy charge depends on it.",
    cta: "Add member",
    meta: [
      { ph: "A-1206", kind: "mono", req: true },
      { ph: "Full name as on the share certificate", req: true },
      { kind: "pick", opts: ["Self-occupied", "Family-occupied", "Tenanted", "Vacant"] },
      { ph: "14 Sep 2026", blank: "Just now" },
      { ph: "0", kind: "money" },
    ],
    pill: { opts: ["Clear", "Due", "Overdue", "Legal stage", "Data missing"], kinds: { Clear: "ok", Due: "warn", Overdue: "bad", "Legal stage": "bad", "Data missing": "info" } },
    blank: "—",
    done: (v) => `${v.b} added at ${v.a}.`,
  },
  users: {
    key: "users",
    title: "Add user",
    blurb: "Everyone who is not an admin is a user. What they see comes from the permission template you pick.",
    cta: "Create user",
    meta: [
      { ph: "+91 98220 00000", kind: "mono", req: true },
      { ph: "Full name", req: true },
      { kind: "pick", opts: ["OWNER", "TENANT", "ADMIN", "ACCOUNTANT", "GUARD"] },
      { ph: "A-1206", kind: "mono" },
      { ph: "Never" },
    ],
    pill: { opts: ["Active", "Read-write", "Gate app only", "Password not set", "Locked 15 min"], kinds: { Active: "ok", "Read-write": "ok", "Gate app only": "info", "Password not set": "warn", "Locked 15 min": "bad" } },
    blank: "Never",
    done: (v) => `${v.b} can sign in with ${v.a}.`,
  },
  setup: {
    key: "setup",
    title: "Statutory config key",
    blurb: "Add or correct one statutory key. Nothing bills until the required keys are set.",
    cta: "Save key",
    meta: [
      { ph: "INTEREST_RATE_PA", kind: "mono", req: true },
      { ph: "What this key controls", req: true },
      { ph: "21% simple p.a." },
      { ph: "Bye-law 68" },
      { ph: "01 Apr 2026", blank: "Just now" },
    ],
    pill: { opts: ["Verified", "Locked", "Re-verify", "Blocking"], kinds: { Verified: "ok", Locked: "info", "Re-verify": "warn", Blocking: "bad" } },
    blank: "—",
    done: (v) => `${v.a} saved.`,
  },
  payments: {
    key: "payments",
    title: "Record receipt",
    blurb: "For cash, cheque or a bank transfer that did not auto-match. It posts to accounting on save.",
    cta: "Record receipt",
    meta: [
      { ph: "RCP-2026-09-1205", kind: "mono", req: true },
      { ph: "A-1206", kind: "mono", req: true },
      { kind: "pick", opts: ["UPI", "Virtual account", "Cheque", "Bank credit", "Cash"] },
      { ph: "UTR 402318776214" },
      { ph: "12840.50", kind: "money", req: true },
    ],
    pill: { opts: ["Cleared", "In clearing", "Unmatched", "Refund raised"], kinds: { Cleared: "ok", "In clearing": "info", Unmatched: "warn", "Refund raised": "bad" } },
    done: (v) => `Receipt ${v.a} recorded against ${v.b}.`,
  },
  accounting: {
    key: "accounting",
    title: "New voucher",
    blurb: "Double entry. A fund withdrawal needs its general body resolution reference in the narration.",
    cta: "Post voucher",
    meta: [
      { ph: "JV-2026-0414", kind: "mono", req: true },
      { ph: "What this voucher is for", req: true },
      { ph: "Receivables" },
      { kind: "pick", opts: ["Journal", "Receipt", "Payment", "Contra"] },
      { ph: "48000", kind: "money", req: true },
    ],
    pill: { opts: ["Posted", "Draft", "Awaiting approval", "Needs resolution"], kinds: { Posted: "ok", Draft: "info", "Awaiting approval": "warn", "Needs resolution": "bad" } },
    done: (v) => `Voucher ${v.a} posted.`,
  },
  recovery: {
    key: "recovery",
    title: "Open a recovery case",
    blurb: "Every notice cites the rule it relies on and stores dispatch proof. That proof is what stands up at the registrar.",
    cta: "Open case",
    meta: [
      { ph: "REC-2026-032", kind: "mono", req: true },
      { ph: "B-0407", kind: "mono", req: true },
      { kind: "pick", opts: ["Notice", "Final notice", "Settlement", "Legal · Sec. 101"] },
      { ph: "RPAD 8841 · 02 Sep" },
      { ph: "43180", kind: "money", req: true },
    ],
    pill: {
      opts: ["Reminder 16 Sep", "Notice 18 Sep", "Escalate 02 Oct", "Hearing 24 Sep", "Instalment 25 Sep"],
      kinds: { "Reminder 16 Sep": "info", "Notice 18 Sep": "warn", "Escalate 02 Oct": "warn", "Hearing 24 Sep": "bad", "Instalment 25 Sep": "ok" },
    },
    done: (v) => `Case ${v.a} opened for ${v.b}.`,
  },
  gate: {
    key: "gate",
    title: "Log a visitor",
    blurb: "A manual entry for when the handset was offline. The guard's device normally writes this row itself.",
    cta: "Log entry",
    meta: [
      { ph: "11:42", req: true },
      { ph: "Name, and who they are from", req: true },
      { kind: "pick", opts: ["Delivery", "Pre-approved pass", "Cab", "Service visit", "Guest"] },
      { ph: "B-0902", kind: "mono", req: true },
      { ph: "4 min" },
    ],
    pill: { opts: ["Inside", "Exited", "Left at gate", "Overstay alert", "Denied by resident"], kinds: { Inside: "ok", Exited: "info", "Left at gate": "info", "Overstay alert": "warn", "Denied by resident": "bad" } },
    blank: "—",
    done: (v) => `${v.b} logged at ${v.a} for ${v.d}.`,
  },
  vendors: {
    key: "vendors",
    title: "Add vendor",
    blurb: "Service visits generate themselves from the contract frequency, so a missed visit raises an alert instead of a silent gap.",
    cta: "Add vendor",
    meta: [
      { ph: "AMC-2026-11", kind: "mono", req: true },
      { ph: "Registered business name", req: true },
      { ph: "3 lifts · Wing A, B" },
      { kind: "pick", opts: ["Monthly", "Quarterly", "Half-yearly", "Annual", "Continuous"] },
      { ph: "184000", kind: "money", req: true },
    ],
    pill: { opts: ["Active", "Renewed", "Expires in 21 d", "Quote pending", "Visit missed"], kinds: { Active: "ok", Renewed: "ok", "Expires in 21 d": "warn", "Quote pending": "info", "Visit missed": "bad" } },
    done: (v) => `${v.b} added under ${v.a}.`,
  },
  notices: {
    key: "notices",
    title: "Compose notice",
    blurb: "Delivery and acknowledgement are reported per member. That report is the society's proof of service.",
    cta: "Publish notice",
    meta: [
      { ph: "NTC/0089", kind: "mono", req: true },
      { ph: "What residents will read first", req: true },
      { kind: "pick", opts: ["All residents", "All owners", "Wing A", "Wing B", "Wing C"] },
      { kind: "pick", opts: ["Push", "Push · WA", "Push · WA · SMS", "Push · WA · SMS · Email"] },
      { ph: "0 / 248" },
    ],
    pill: { opts: ["Published", "Scheduled 12 Sep", "Ack pending"], kinds: { Published: "ok", "Scheduled 12 Sep": "info", "Ack pending": "warn" } },
    blank: "0 / 248",
    done: (v) => `"${v.b}" published to ${String(v.c || "").toLowerCase()}.`,
  },
  meetings: {
    key: "meetings",
    title: "Create meeting",
    blurb: "Notice period and quorum are checked against statutory config before the notice can go out.",
    cta: "Create meeting",
    meta: [
      { ph: "AGM/2026", kind: "mono", req: true },
      { ph: "Annual general meeting", req: true },
      { kind: "pick", opts: ["AGM", "SGM", "Committee", "Poll"] },
      { ph: "28 Sep 2026", blank: "Just now" },
      { ph: "— of 248" },
    ],
    pill: { opts: ["Notice due", "Voting open", "Concluded", "Minutes draft", "Minutes approved"], kinds: { "Notice due": "warn", "Voting open": "info", Concluded: "ok", "Minutes draft": "warn", "Minutes approved": "ok" } },
    blank: "—",
    done: (v) => `${v.b} scheduled.`,
  },
  documents: {
    key: "documents",
    title: "Upload document",
    blurb: "Versioned and access-controlled. Expiry reminders fire at 60, 30 and 7 days.",
    cta: "Upload",
    meta: [
      { ph: "DOC/0413", kind: "mono", req: true },
      { ph: "What this document is", req: true },
      { kind: "pick", opts: ["Registration", "Audits", "Insurance", "Contracts", "Land & conveyance", "Minutes"] },
      { ph: "v1", blank: "v1" },
      { ph: "None" },
    ],
    pill: { opts: ["All users", "Committee", "Admin only"], kinds: { "All users": "ok", Committee: "info", "Admin only": "warn" } },
    blank: "None",
    done: (v) => `${v.b} filed to ${v.c}.`,
  },
  requests: {
    key: "requests",
    title: "New request",
    blurb: "One engine: form, document checklist, fee, approval chain, then a serial-numbered PDF filed to the vault.",
    cta: "Raise request",
    meta: [
      { ph: "REQ/0113", kind: "mono", req: true },
      { kind: "pick", opts: ["NOC for renovation", "NOC for sale", "Tenancy approval", "Share transfer", "Parking allotment", "Name addition"] },
      { ph: "A-1206", kind: "mono", req: true },
      { ph: "14 Sep 2026", blank: "Just now" },
      { ph: "2500", kind: "money" },
    ],
    pill: { opts: ["Issued", "Committee approval", "Availability check", "Deposit pending", "SLA breached"], kinds: { Issued: "ok", "Committee approval": "info", "Availability check": "info", "Deposit pending": "warn", "SLA breached": "bad" } },
    done: (v) => `${v.b} raised for ${v.c}.`,
  },
  reports: {
    key: "reports",
    title: "Schedule report",
    blurb: "It runs in the background and arrives by email. Large exports do not block the console.",
    cta: "Schedule",
    meta: [
      { ph: "RPT-OUTSTANDING", kind: "mono", req: true },
      { ph: "Outstanding dues by unit", req: true },
      { kind: "pick", opts: ["Billing", "Recovery", "Accounting", "Governance"] },
      { kind: "pick", opts: ["PDF", "Excel", "PDF · Excel"] },
      { ph: "Never" },
    ],
    pill: { opts: ["Daily", "Weekly", "Monthly", "Quarterly", "On demand"], kinds: { Daily: "info", Weekly: "info", Monthly: "ok", Quarterly: "ok", "On demand": "warn" } },
    blank: "Never",
    done: (v) => `${v.b} scheduled ${String(v.pill ?? "").toLowerCase()}.`,
  },
};

/** Zips a form's 5-entry meta array against the page's own columns, so a
 * field's label is structurally tied to the column it writes. */
export function formFields(pageKey: string): FormField[] {
  const f = FORMS[pageKey];
  const p = PAGES[pageKey];
  if (!f || !p) return [];
  const fields: FormField[] = f.meta.map((m, i) => ({
    k: K5[i],
    label: p.cols[i].label,
    kind: m.kind ?? "text",
    ph: m.ph,
    req: m.req,
    opts: m.opts,
    blank: m.blank,
  }));
  if (f.pill) {
    fields.push({
      k: "pill",
      label: p.cols[5].label,
      kind: "pick",
      opts: f.pill.opts,
      kinds: f.pill.kinds as Record<string, PillKind>,
    });
  }
  return fields;
}
