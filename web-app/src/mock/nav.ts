import type { NavEntry } from "../lib/types";

/** Sidebar nav, grouped exactly as NAV in the prototype. `key` doubles as the
 * route segment under /admin/. */
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
  { key: "payments", label: "Payments", badge: "6" },
  { key: "accounting", label: "Accounting" },
  { key: "recovery", label: "Recovery", badge: "31" },
  { group: "Operations" },
  { key: "helpdesk", label: "Helpdesk", badge: "31" },
  { key: "gate", label: "Gate & visitors" },
  { key: "staff", label: "Staff & help" },
  { key: "amenities", label: "Amenities" },
  { key: "vendors", label: "Vendors & assets" },
  { group: "Governance" },
  { key: "notices", label: "Notices" },
  { key: "meetings", label: "Meetings" },
  { key: "documents", label: "Documents" },
  { key: "requests", label: "Requests", badge: "4" },
  { key: "compliance", label: "Compliance" },
  { group: "Insight" },
  { key: "reports", label: "Reports" },
];
