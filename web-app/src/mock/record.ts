/**
 * RECORD — per-source builders that turn a table row into a record-page
 * context (README, "A record opens as a full page"). Mirrors RECORD /
 * RECORD_FALLBACK in design-files/Admin Web.dc.html. Every number here is
 * *derived from the row*, never a separately authored fact — see README's
 * "derive, never duplicate" discussion for why that discipline matters.
 */
import type { ColSpec, RecordContext, Row } from "../lib/types";
import { numFrom } from "../lib/format";

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export const RECORD: Record<string, (r: Row & { _carve?: number }) => RecordContext> = {
  members: (r) => {
    const owed = numFrom(r.e);
    const clear = owed === 0;
    const demo = r.a === "A-1204";
    const dues: string[][] = [];
    let rest = Math.max(0, owed - (r._carve ?? 0));
    if (rest > 0) {
      const v = Math.min(rest, 4850);
      dues.push(["Maintenance — September", inr(v), "due", "01 Sep 2026"]);
      rest -= v;
    }
    if (rest > 0) {
      const v = Math.min(rest, 1200);
      dues.push(["Parking — Q3", inr(v), "due", "01 Sep 2026"]);
      rest -= v;
    }
    if (rest > 0) dues.push(["Arrears carried forward", inr(rest), "overdue", "01 Aug 2026"]);
    const paidRows = [
      ["Maintenance — August", "₹4,850.00", "paid", "04 Aug 2026"],
      ["Maintenance — July", "₹4,850.00", "paid", "03 Jul 2026"],
      ["Maintenance — June", "₹4,850.00", "paid", "02 Jun 2026"],
    ];
    const paidTotal = 14550;
    const billsTotal = 6;
    const billsPaid = billsTotal - dues.length;
    const occupancy = r.c.split(" · ")[0];
    return {
      kind: "Member",
      code: r.a,
      meta: ["+91 98220 41155", "Joined " + r.d],
      chips: [
        [clear ? "Active" : r.pill, clear ? "ok" : "warn"],
        [occupancy, "info"],
        ...(clear ? [] : ([[r.e + " outstanding", "bad"]] as [string, "bad"][])),
      ],
      actions: [
        [clear ? "Send statement" : "Record payment", "primary"],
        ["App access", "ghost"],
        ["Edit", "ghost"],
        ["Make inactive", "warn"],
      ],
      tiles: [
        { label: "Occupancy", value: occupancy, sub: "Since " + r.d, accent: "var(--accent,#0E6B5C)" },
        { label: "Carpet area", value: demo ? "1,180 sq ft" : "Not on file", sub: demo ? "₹3.20 per sq ft" : "Needed for billing", accent: demo ? "var(--info,#1D4ED8)" : "var(--warn,#B45309)" },
        { label: "Paid this FY", value: inr(paidTotal), sub: billsPaid + " of " + billsTotal + " bills settled", accent: "var(--ok,#167A3C)" },
        { label: "Outstanding", value: clear ? "Nil" : r.e, sub: clear ? "Nothing due" : "Due 17 Sep", accent: clear ? "var(--ok,#167A3C)" : "var(--bad,#C0342B)" },
      ],
      alert: clear ? null : { label: "Outstanding", value: r.e, sub: "Due 17 Sep · interest starts 18 Sep", cta: "Receive " + r.e },
      left: [
        { h: "Ledger", sub: dues.length ? dues.length + " unpaid · " + paidRows.length + " settled this FY" : "All " + paidRows.length + " entries settled this FY", action: "Add charge", type: "table", head: ["Entry", "Amount", "Status", "When"], rows: dues.concat(paidRows) },
        { h: "Helpdesk", sub: demo ? "1 open · 2 resolved this year" : "Nothing open", action: "Raise ticket", type: "table", head: ["Ticket", "Issue", "State", "Raised"], rows: demo ? [["TKT/1182", "Lift B grinding between 6 and 9", "In progress", "07 Sep 2026"], ["TKT/1104", "Corridor light out, 12th floor", "Resolved", "07 Aug 2026"], ["TKT/0987", "Water pressure low, morning", "Resolved", "19 Jun 2026"]] : [["TKT/1149", "Seepage on the balcony wall", "Resolved", "28 Aug 2026"]] },
        { h: "Amenity bookings", sub: demo ? "2 upcoming · 1 completed" : "None upcoming", action: "Book", type: "table", head: ["Amenity", "When", "State", "Charge"], rows: demo ? [["Clubhouse hall", "Sun 21 Sep · 2pm – 6pm", "Confirmed", "₹2,000"], ["Badminton court", "Fri 19 Sep · 7pm – 8pm", "Confirmed", "₹150"], ["Clubhouse hall", "12 Aug 2026 · 6pm – 10pm", "Completed", "₹2,000"]] : [["Terrace garden", "04 Aug 2026 · evening", "Completed", "₹1,200"]] },
        { h: "Gate activity", sub: "Visitors and passes for this unit", action: "Issue pass", type: "table", head: ["Visitor", "Purpose", "Code", "When"], rows: demo ? [["Rohit Sharma", "Guest · expected 7:00pm", "4417", "Today"], ["Blue Dart", "Delivery · standing", "9021", "Standing"], ["Meera Joshi", "Guest · entered 4:12pm", "3380", "11 Sep 2026"]] : [["Amazon Logistics", "Delivery", "8890", "12 Sep 2026"]] },
        demo
          ? { h: "Household", sub: "3 people", action: "Add person", type: "people", rows: [["Anita Deshpande", "Spouse", "+91 98812 07744"], ["Rajesh Deshpande", "Father · emergency contact", "+91 98220 41156"], ["Ira Deshpande", "Daughter", "9 years"]] }
          : { h: "Household", sub: "Not recorded for this unit", action: "Add person", type: "people", rows: [[r.b, "Primary member", occupancy]] },
      ],
      right: [
        { h: "Profile details", type: "grid", rows: [["Unit", r.a], ["Wing", r.a[0] + " wing"], ["Member since", r.d], ["Occupancy", r.c], ["Share certificate", demo ? "SC/0412" : "Not on file"], ["Carpet area", demo ? "1,180 sq ft" : "Not on file"], ["Parking slots", demo ? "B-42, T-18" : "None allotted"], ["Status", r.pill]] },
        demo ? { h: "Vehicles", sub: "2 registered", action: "Add", type: "list", rows: [["MH 12 KJ 4471", "Honda City · white", "B-42"], ["MH 12 AB 9902", "Activa · grey", "T-18"]] } : { h: "Vehicles", sub: "None registered", action: "Add", type: "list", rows: [] },
        demo ? { h: "Daily help", sub: "2 with standing passes", action: "Register", type: "list", rows: [["Lakshmi Bai", "Housekeeping · 6 days", "In since 7:05am"], ["Ganesh Pawar", "Driver · 6 days", "In since 8:40am"]] } : { h: "Daily help", sub: "None registered", action: "Register", type: "list", rows: [] },
        { h: "Requests", sub: demo ? "2 raised, both approved" : "None raised", action: "Raise", type: "list", rows: demo ? [["REQ-2026-0104", "NOC for renovation", "Approved"], ["REQ-2026-0061", "Parking allotment", "Approved"]] : [] },
        { h: "App users", sub: demo ? "2 signed up" : "1 signed up", type: "list", rows: demo ? [["+91 98220 41155", r.b + " · Owner", "Today, 08:14"], ["+91 98812 07744", "Anita Deshpande · Owner", "12 Sep 2026"]] : [["+91 98220 41155", r.b + " · " + occupancy, "Never"]] },
        { h: "Notices", sub: "Acknowledgement for this unit", type: "list", rows: [["Water supply off Thursday", "Urgent", "Read"], ["Annual general meeting", "AGM", "Acknowledged"], ["Clubhouse closed", "Facility", "Not opened"]] },
        { h: "Documents", sub: "Filed against this unit", action: "Upload", type: "list", rows: demo ? [["Share certificate SC/0412", "Statutory", "Current"], ["Tenancy agreement", "Contracts", "Expires 31 Mar 2027"]] : [["Share certificate", "Statutory", "Not on file"]] },
      ],
    };
  },

  users: (r) => {
    const role = (r.c || "").toUpperCase();
    const guard = role === "GUARD";
    const acct = role === "ACCOUNTANT" || role === "ADMIN";
    const resident = !guard && !acct;
    const unit = r.d && r.d !== "—" ? r.d : null;
    const locked = /^Locked/.test(r.pill || "");
    const used = Boolean(r.e && r.e !== "—" && r.e !== "Never" && r.pill !== "Password not set" && r.pill !== "Never logged in");
    const full = unit === "A-1204";
    const seed = unit ? unit.replace(/\D/g, "").slice(-3) || "000" : "000";

    const tickets = !used ? [] : full ? [["TKT/1182", "Lift B grinding between 6 and 9", "In progress", "07 Sep 2026"], ["TKT/1104", "Corridor light out, 12th floor", "Resolved", "07 Aug 2026"], ["TKT/0987", "Water pressure low, morning", "Resolved", "19 Jun 2026"]] : [["TKT/0" + seed, "Seepage on the balcony wall", "Resolved", "28 Aug 2026"]];
    const bookings = !used ? [] : full ? [["Clubhouse hall", "Sun 21 Sep · 2pm – 6pm", "Confirmed", "₹2,000"], ["Badminton court", "Fri 19 Sep · 7pm – 8pm", "Confirmed", "₹150"], ["Clubhouse hall", "12 Aug 2026 · 6pm – 10pm", "Completed", "₹2,000"]] : [];
    const passes = !used ? [] : full ? [["Rohit Sharma", "Guest · expected 7:00pm", "4417", "Today"], ["Blue Dart", "Delivery · standing", "9021", "Standing"], ["Meera Joshi", "Guest · entered 4:12pm", "3380", "11 Sep 2026"]] : [["Amazon Logistics", "Delivery", "8" + seed, "12 Sep 2026"]];
    const requests = !used || !full ? [] : [["REQ-2026-0104", "NOC for renovation", "Approved"], ["REQ-2026-0061", "Parking allotment", "Approved"]];
    const helpStaff = !used || !full ? [] : [["Lakshmi Bai", "Housekeeping · ST-0441", "In since 7:05am"], ["Ganesh Pawar", "Driver · ST-0288", "In since 8:40am"]];
    const notices = !used ? [] : [["Water supply off Thursday", "Urgent", full ? "Read" : "Not opened", "11 Sep 2026"], ["Annual general meeting", "AGM", full ? "Acknowledged" : "Not opened", "10 Sep 2026"], ["Clubhouse closed for flooring", "Facility", "Not opened", "08 Sep 2026"]];

    const openT = tickets.filter((t) => t[2] !== "Resolved").length;
    const upcoming = bookings.filter((b) => b[2] === "Confirmed").length;
    const created = full ? "01 Apr 2026" : "Not on file";

    const shifts = [["Today", "2pm – 10pm", "Main gate", "On duty"], ["13 Sep 2026", "2pm – 10pm", "Main gate", "Handed over"], ["12 Sep 2026", "6am – 2pm", "Main gate", "Handed over"]];
    const gateWork = [["Visitors verified", "63", "Today"], ["Walk-ins approved", "7", "Today"], ["Parcels logged", "11", "Today"], ["Alerts raised", "0", "This month"]];
    const finWork = [["JV-2026-0413", "Sinking fund transfer", "Posted", "12 Sep 2026"], ["RCP-2026-09-1204", "Receipt · A-1204", "Matched", "13 Sep 2026"], ["Bill run — September", "248 units published", "Done", "01 Sep 2026"]];

    return {
      kind: "User",
      code: r.a,
      meta: [r.c, guard ? r.d : unit ? "Unit " + unit : "No unit"],
      chips: [[r.pill, r.k], [r.c, "info"], ...(used ? [] : ([["Never signed in", "warn"]] as [string, "warn"][]))],
      actions: [[used ? "Reset password" : "Send invite", "primary"], ["Change template", "ghost"], ["Edit", "ghost"], ...(used ? ([[locked ? "Unlock" : "Lock account", "warn"]] as ["Unlock" | "Lock account", "warn"][]) : [])],
      tiles: resident
        ? [
            { label: "Open tickets", value: used ? String(openT) : "—", sub: used ? tickets.length - openT + " resolved" : "Never signed in", accent: openT ? "var(--warn,#B45309)" : "var(--ink-muted,#8A9995)" },
            { label: "Amenity bookings", value: used ? String(upcoming) : "—", sub: used ? (upcoming ? "Upcoming this month" : "None upcoming") : "Never signed in", accent: "var(--accent,#0E6B5C)" },
            { label: "Visitor passes", value: used ? String(passes.length) : "—", sub: used ? (full ? "1 standing, 2 one-time" : "One-time") : "Never signed in", accent: "var(--info,#1D4ED8)" },
            { label: "Last sign-in", value: used ? r.e : "Never", sub: used ? "Android 14 · Pune" : "Invite not accepted", accent: used ? "var(--ok,#167A3C)" : "var(--warn,#B45309)" },
          ]
        : guard
        ? [
            { label: "On duty", value: "2pm – 10pm", sub: "Main gate · shift 2", accent: "var(--accent,#0E6B5C)" },
            { label: "Verified today", value: "63", sub: "7 were walk-ins", accent: "var(--ok,#167A3C)" },
            { label: "Parcels held", value: "4", sub: "11 logged today", accent: "var(--warn,#B45309)" },
            { label: "Shifts this month", value: "18", sub: "No missed handovers", accent: "var(--info,#1D4ED8)" },
          ]
        : [
            { label: "Role", value: r.c, sub: "Permission template", accent: "var(--accent,#0E6B5C)" },
            { label: "Vouchers posted", value: "34", sub: "This financial year", accent: "var(--info,#1D4ED8)" },
            { label: "Receipts matched", value: "212", sub: "6 unmatched pending", accent: "var(--ok,#167A3C)" },
            { label: "Last sign-in", value: r.e, sub: "Chrome · Pune", accent: "var(--ink-muted,#8A9995)" },
          ],
      alert: resident && !used ? { label: "Never signed in", value: "Invite not accepted", sub: unit ? "Dues for " + unit + " sit on the member record, not here" : "No unit attached", cta: "Resend invite" } : null,
      left: resident
        ? [
            { h: "Helpdesk", sub: used ? (openT ? openT + " open · " + (tickets.length - openT) + " resolved" : "Nothing open") : "Nothing — never signed in", action: "Raise for them", type: "table", head: ["Ticket", "Issue", "State", "Raised"], rows: tickets },
            { h: "Amenity bookings", sub: used ? (upcoming ? upcoming + " upcoming" : "None booked") : "Nothing — never signed in", action: "Book for them", type: "table", head: ["Amenity", "When", "State", "Charge"], rows: bookings },
            { h: "Visitor passes", sub: used ? passes.length + " issued" : "Nothing — never signed in", action: "Issue pass", type: "table", head: ["Visitor", "Purpose", "Code", "When"], rows: passes },
            { h: "Notices", sub: used ? (full ? "2 of 3 opened" : "0 of 3 opened") : "Nothing delivered — never signed in", type: "table", head: ["Notice", "Kind", "State", "Published"], rows: notices },
          ]
        : guard
        ? [
            { h: "Shifts", sub: "Last three", action: "Roster", type: "table", head: ["Day", "Hours", "Post", "State"], rows: shifts },
            { h: "Gate work", sub: "What this guard handled", type: "people", rows: gateWork },
            { h: "Handover notes", sub: "Written at shift close", type: "trail", rows: [["Lift B out of service, OTIS due 6pm", "13 Sep 2026"], ["Visitor parking full from 7pm", "12 Sep 2026"], ["Gate 2 barrier sticking", "11 Sep 2026"]] },
          ]
        : [
            { h: "Recent finance work", sub: "Posted by this user", type: "table", head: ["Reference", "What", "State", "When"], rows: finWork },
            { h: "Approvals pending", sub: "Waiting on this user", type: "people", rows: [["JV-2026-0414", "Lift AMC · ₹48,000", "Unapproved"], ["REQ-2026-0112", "NOC for renovation", "Fee unpaid"]] },
          ],
      right: [
        { h: "Profile details", type: "grid", rows: [["Mobile", r.a], ["Name", r.b], ["Type", r.c], [guard ? "Posted at" : "Unit", r.d], ["Created", created], ["Template", guard ? "Guard" : acct ? "Accountant" : "Owner"], ["Language", "English"], ["Notifications", used ? "All on" : "Not set"]] },
        ...(resident && unit ? [{ h: "Money", sub: "The unit owns the ledger, not the login", type: "list" as const, rows: [[unit, "Open the member record for dues and receipts", "Member record"]] }] : []),
        ...(resident ? [{ h: "Daily help", sub: helpStaff.length ? "Registered by this user" : "None registered", action: "Add", type: "list" as const, rows: helpStaff }] : []),
        ...(resident ? [{ h: "Requests", sub: requests.length ? requests.length + " raised" : "None raised", type: "list" as const, rows: requests }] : []),
        { h: "Modules visible", sub: "From the permission template", type: "list", rows: guard ? [["Gate", "Verify, log, parcels", "Full"], ["Staff", "Mark in and out", "Full"]] : acct ? [["Billing", "Generate and publish", "Full"], ["Payments", "Record and reconcile", "Full"], ["Accounting", "Vouchers", "Full"], ["Reports", "All", "Read"]] : [["Own dues", "Bills and receipts", "Read"], ["Notices", "Society notices", "Read"], ["Requests", "Raise and track", "Full"], ["Amenities", "Book and cancel", "Full"]] },
        { h: "Access", sub: used ? "Sessions and security" : "No session ever opened", type: "list", rows: used ? [["Android 14", "Pune · app v2.4.1", r.e], ["Two-factor", "Not enforced for this role", "Off"]] : [["No device", "Invite sent, never accepted", "—"], ["Two-factor", "Not enforced for this role", "Off"]] },
      ],
    };
  },

  payments: (r) => ({
    kind: "Receipt",
    code: r.a,
    meta: ["Unit " + r.b, r.c, r.d],
    chips: [[r.pill, r.k], [r.c, "info"]],
    actions: [["Email receipt", "primary"], ["Print", "ghost"], ["Re-allocate", "ghost"], ["Reverse", "warn"]],
    tiles: [
      { label: "Amount", value: r.e, sub: "Received " + r.d, accent: "var(--ok,#167A3C)" },
      { label: "Mode", value: r.c, sub: "HDFC-XXXX4471", accent: "var(--accent,#0E6B5C)" },
      { label: "Against", value: r.b, sub: "Anjali Deshpande", accent: "var(--info,#1D4ED8)" },
      { label: "Posted", value: "Yes", sub: "Journal JV-2026-0411", accent: "var(--ok,#167A3C)" },
    ],
    alert: null,
    left: [
      { h: "Allocation", sub: "Across charge heads", type: "table", head: ["Head", "Amount", "State", "Period"], rows: [["Service charges", "₹2,500.00", "paid", "Sep 2026"], ["Property tax", "₹1,548.39", "paid", "Sep 2026"], ["Water charges", "₹600.00", "paid", "Sep 2026"], ["Sinking fund", "₹354.00", "paid", "Sep 2026"], ["Common electricity", "₹300.00", "paid", "Sep 2026"], ["Interest on arrears", "₹73.00", "paid", "Aug 2026"]] },
    ],
    right: [
      { h: "Receipt details", type: "grid", rows: [["Receipt no.", r.a], ["Unit", r.b], ["Mode", r.c], ["Received", r.d], ["Amount", r.e], ["Value date", "11 Sep 2026"], ["Bank", "HDFC-XXXX4471"], ["Matched by", "Auto · exact narration"]] },
      { h: "Activity", sub: "Receipt history", type: "trail", rows: [["Emailed to member", "11 Sep 2026"], ["Posted to accounting", "11 Sep 2026"], ["Auto-matched", "11 Sep 2026"], ["Credit received", "11 Sep 2026"]] },
    ],
  }),

  recovery: (r) => ({
    kind: "Recovery case",
    code: r.a,
    meta: [r.b, "Open since " + r.d],
    chips: [[r.pill, r.k], [r.c, "warn"]],
    actions: [["Send notice", "primary"], ["Settlement plan", "ghost"], ["Case file", "ghost"], ["Escalate to Sec. 101", "warn"]],
    tiles: [
      { label: "Outstanding", value: r.e, sub: "Including interest", accent: "var(--bad,#C0342B)" },
      { label: "Stage", value: r.c, sub: r.pill, accent: "var(--warn,#B45309)" },
      { label: "Age", value: "214 days", sub: "Since " + r.d, accent: "var(--info,#1D4ED8)" },
      { label: "Interest accrued", value: "₹4,180", sub: "21% p.a. · bye-law 68", accent: "var(--bad,#C0342B)" },
    ],
    alert: { label: "Outstanding", value: r.e, sub: "Legal stage · registrar filing prepared", cta: "Receive " + r.e },
    left: [
      { h: "Ageing", sub: "By bucket", type: "table", head: ["Bucket", "Amount", "State", "Share"], rows: [["0–30 days", "₹4,850", "current", "11%"], ["31–60 days", "₹9,700", "overdue", "22%"], ["61–90 days", "₹9,700", "overdue", "22%"], ["Over 90 days", "₹18,930", "legal", "45%"]] },
      { h: "Notices served", sub: "3 served · all with proof", action: "Send next", type: "people", rows: [["Final notice", "RPAD 8841 · delivered", "02 Sep 2026"], ["Second reminder", "WhatsApp + SMS", "02 Aug 2026"], ["First reminder", "WhatsApp + SMS", "16 Jul 2026"]] },
    ],
    right: [
      { h: "Case details", type: "grid", rows: [["Case", r.a], ["Member", r.b], ["Stage", r.c], ["Due since", r.d], ["Outstanding", r.e], ["Interest rate", "21% p.a."], ["Authority", "Bye-law 68"], ["Next hearing", "Not listed"]] },
      { h: "Activity", sub: "Case history", type: "trail", rows: [["Bundle generated for Sec. 101", "05 Sep 2026"], ["Final notice delivered", "04 Sep 2026"], ["Second reminder sent", "02 Aug 2026"], ["Case opened", "16 Jul 2026"]] },
    ],
  }),

  vendors: (r) => ({
    kind: "Contract",
    code: r.a,
    meta: [r.c, "Expires " + r.d],
    chips: [[r.pill, r.k], [r.c, "info"]],
    actions: [["Renew contract", "primary"], ["Log a visit", "ghost"], ["Edit", "ghost"], ["Blacklist", "warn"]],
    tiles: [
      { label: "Annual value", value: r.e, sub: "Paid quarterly", accent: "var(--accent,#0E6B5C)" },
      { label: "Expires", value: r.d, sub: "Renewal reminder sent", accent: "var(--warn,#B45309)" },
      { label: "Assets covered", value: "3", sub: "Lifts A1, B1, A2", accent: "var(--info,#1D4ED8)" },
      { label: "Visits this year", value: "11", sub: "1 missed", accent: "var(--ok,#167A3C)" },
    ],
    alert: null,
    left: [
      { h: "Service history", sub: "Last 6 visits", type: "table", head: ["Visit", "Asset", "Result", "When"], rows: [["Routine service", "Lift A1", "ok", "18 Aug 2026"], ["Breakdown call", "Lift B1", "ok", "07 Aug 2026"], ["Routine service", "Lift B1", "ok", "18 Jul 2026"], ["Routine service", "Lift A2", "missed", "18 Jun 2026"], ["Annual inspection", "All lifts", "ok", "02 Apr 2026"], ["Routine service", "Lift A1", "ok", "18 Mar 2026"]] },
    ],
    right: [
      { h: "Contract details", type: "grid", rows: [["Contract", r.a], ["Vendor", r.b], ["Scope", r.c], ["Expires", r.d], ["Value p.a.", r.e], ["Frequency", "Monthly"], ["Response SLA", "4 hours"], ["GST", "27AABCO1234M1Z5"]] },
      { h: "Compliance", sub: "Documents on file", type: "list", rows: [["Lift licence", "Valid", "18 Oct 2026"], ["Technician certification", "Valid", "On file"], ["Insurance", "Valid", "31 Mar 2027"]] },
      { h: "Activity", sub: "Contract history", type: "trail", rows: [["Renewal reminder sent", "08 Sep 2026"], ["Contract signed", "01 Apr 2026"], ["Vendor onboarded", "14 Feb 2024"]] },
    ],
  }),
};

/** Pages without a hand-written RECORD builder fall back to the full row
 * plus a trail, per README, "Pages without hand-written context fall back
 * to the full row plus a trail." */
export function recordFallback(r: Row, cols: [ColSpec, ColSpec, ColSpec, ColSpec, ColSpec, ColSpec]): RecordContext {
  const vals = [r.a, r.b, r.c, r.d, r.e];
  return {
    kind: "Record",
    code: r.a,
    meta: [r.c, r.d].filter((x) => x && x !== "—"),
    chips: [[r.pill, r.k]],
    actions: [["Edit", "primary"], ["Export", "ghost"]],
    tiles: cols.slice(1, 5).map((c, i) => ({
      label: c.label,
      value: vals[i] || "—",
      sub: "",
      accent: ["var(--accent,#0E6B5C)", "var(--info,#1D4ED8)", "var(--ok,#167A3C)", "var(--warn,#B45309)"][i],
    })),
    alert: null,
    left: [
      {
        h: "Full record",
        sub: "Every stored field",
        type: "table",
        head: ["Field", "Value", "State", "Source"],
        rows: cols.slice(0, 5).map((c, i) => [c.label, vals[i] || "—", "ok", "This record"]),
      },
    ],
    right: [
      { h: "Details", type: "grid", rows: cols.slice(0, 5).map((c, i) => [c.label, vals[i] || "—"]) },
      { h: "Activity", sub: "Record history", type: "trail", rows: [["Last updated", "Today"], ["Created", r.d && r.d !== "—" ? r.d : "Earlier this year"]] },
    ],
  };
}

/** Section-add quick-modal metadata, keyed by section heading. */
export const LIST_COLS: Record<string, string[]> = {
  Household: ["Name", "Relationship", "Phone or age"],
  Vehicles: ["Registration", "Vehicle", "Slot"],
  "Daily help": ["Name", "Role and days", "State"],
  Requests: ["Reference", "Type", "State"],
  Documents: ["File", "Folder", "Validity"],
  "Gate work": ["What", "Count", "When"],
  "Approvals pending": ["Reference", "What", "State"],
};

export const QUICK_PH: Record<string, string[]> = {
  Ledger: ["Maintenance — October", "4850.00", "due", "01 Oct 2026"],
  Helpdesk: ["TKT/1190", "What is wrong", "Open", "Today"],
  "Amenity bookings": ["Clubhouse hall", "Sat 27 Sep · 2pm – 6pm", "Confirmed", "₹2,000"],
  "Gate activity": ["Visitor name", "Guest", "4 digits", "Today"],
  "Visitor passes": ["Visitor name", "Guest", "4 digits", "Today"],
  Household: ["Full name", "Spouse", "+91 "],
  Vehicles: ["MH 12 XX 0000", "Make and colour", "B-00"],
  "Daily help": ["Full name", "Housekeeping · 6 days", "Not yet in"],
  Requests: ["REQ-2026-0120", "NOC for renovation", "Awaiting approval"],
  Documents: ["file-name.pdf", "Statutory", "Current"],
  Shifts: ["Tomorrow", "6am – 2pm", "Main gate", "Rostered"],
};

export const QUICK_SEED: Record<string, string[]> = {
  Ledger: ["", "", "due", ""],
  Helpdesk: ["", "", "Open", "Today"],
  "Amenity bookings": ["", "", "Confirmed", ""],
  "Gate activity": ["", "Guest", "", "Today"],
  "Visitor passes": ["", "Guest", "", "Today"],
  Requests: ["", "", "Awaiting approval"],
  Documents: ["", "Statutory", "Current"],
};

export const QUICK_BLURB: Record<string, string> = {
  Ledger: "Posts against this unit immediately. A charge raised here appears on the member's next bill.",
  Helpdesk: "Raised on the member's behalf, with the admin's name on it. They are notified in the app.",
  "Amenity bookings": "Booked for them, charged to their next maintenance bill.",
  "Gate activity": "The gate sees this pass the moment you save it.",
  "Visitor passes": "The gate sees this pass the moment you save it.",
  Household: "Household members can be given app access separately.",
  "Daily help": "A standing pass is issued and the gate's in-and-out becomes their attendance.",
};
