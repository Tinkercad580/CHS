import type { NavEntry } from "../lib/types";

/** Sidebar nav, grouped as NAV in the prototype, plus the audit log. `key`
 * doubles as the route segment (`dash` is `/`). Badges are not listed here:
 * the shell derives them from the API (see useNavBadges in AdminLayout). */
export const NAV: NavEntry[] = [
  { group: "Overview" },
  { key: "dash", label: "Dashboard" },
  { key: "flows", label: "User flows" },
  { group: "Society" },
  { key: "members", label: "Members & units" },
  { key: "users", label: "Users & access" },
  { key: "setup", label: "Society setup" },
  { group: "Money" },
  { key: "billing", label: "Billing" },
  { key: "payments", label: "Payments" },
  { key: "accounting", label: "Accounting" },
  { key: "recovery", label: "Recovery" },
  { group: "Operations" },
  { key: "helpdesk", label: "Helpdesk" },
  { key: "gate", label: "Gate & visitors" },
  { key: "staff", label: "Staff & help" },
  { key: "amenities", label: "Amenities" },
  { key: "vendors", label: "Vendors & assets" },
  { group: "Governance" },
  { key: "notices", label: "Notices" },
  { key: "meetings", label: "Meetings" },
  { key: "documents", label: "Documents" },
  { key: "requests", label: "Requests" },
  { key: "compliance", label: "Compliance" },
  { key: "audit", label: "Audit log" },
  { group: "Insight" },
  { key: "reports", label: "Reports" },
];
