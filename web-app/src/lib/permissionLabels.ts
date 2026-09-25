import { isAdminPermission, type Permission, type PermissionTemplate, type SocietyUser } from "@chs/contract";

/**
 * Permission strings grouped into the modules the admin design talks about
 * ("Modules visible · From the permission template"). The grouping is
 * presentation only; access is decided server-side from the raw strings.
 */
const MODULE: Record<string, string> = {
  society: "Society setup",
  members: "Members & units",
  users: "Users & access",
  billing: "Billing",
  bills: "Billing",
  payments: "Payments",
  // The member's own ledger, distinct from the society accounts below.
  ledger: "Ledger",
  accounts: "Accounting",
  recovery: "Recovery",
  helpdesk: "Helpdesk",
  gate: "Gate & visitors",
  visitor: "Gate & visitors",
  staff: "Staff & help",
  amenities: "Amenities",
  notices: "Notices",
  meetings: "Meetings",
  documents: "Documents",
  requests: "Requests",
  compliance: "Compliance",
  reports: "Reports",
  audit: "Audit log",
};

const VERB: Record<string, string> = {
  configure: "configure",
  manage: "manage",
  generate: "generate",
  publish: "publish",
  record: "record",
  close: "close year",
  notice: "send notices",
  approve: "approve",
  view: "view",
  pay: "pay",
  create: "raise",
  resolve: "resolve",
  operate: "operate",
  vote: "vote",
  book: "book",
  raise: "raise",
  edit: "edit",
  attendance: "attendance",
};

export function permissionModule(p: string): string {
  return MODULE[p.split(".")[0]] ?? p.split(".")[0];
}

export function permissionVerb(p: string): string {
  const v = p.split(".")[1] ?? p;
  return VERB[v] ?? v;
}

/** One row per module: [module, "view, pay", "Manage" | "Use"]. */
export function moduleRows(permissions: readonly string[]): string[][] {
  const by = new Map<string, { verbs: string[]; admin: boolean }>();
  for (const p of permissions) {
    const m = permissionModule(p);
    const e = by.get(m) ?? { verbs: [], admin: false };
    e.verbs.push(permissionVerb(p));
    e.admin ||= isAdminPermission(p);
    by.set(m, e);
  }
  return [...by.entries()].map(([m, e]) => [m, e.verbs.join(", "), e.admin ? "Manage" : "Use"]);
}

/** The template a user's access matches exactly, if any — the API does not record which one was applied. */
export function matchingTemplate(u: Pick<SocietyUser, "role" | "permissions">, templates: readonly PermissionTemplate[]): PermissionTemplate | null {
  const mine = new Set<string>(u.permissions);
  return (
    templates.find((t) => t.role === u.role && t.permissions.length === mine.size && t.permissions.every((p) => mine.has(p))) ?? null
  );
}

export function modulesSummary(permissions: readonly Permission[]): string {
  const mods = [...new Set(permissions.map(permissionModule))];
  return mods.length > 4 ? `${mods.slice(0, 3).join(", ")} and ${mods.length - 3} more` : mods.join(", ");
}
