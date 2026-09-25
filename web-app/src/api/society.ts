import { api, ADMIN_PERMISSIONS, type Me, type Permission, type SocietyMembership } from "@chs/contract";
import { useApiQuery, useSession } from "@chs/api-client/react";
import { useAdminStore } from "../store/AdminStore";

/**
 * Who is signed in and which society the console is pointed at.
 *
 * The session carries the `me` it signed in with, but realtime events
 * (`me.changed`, `account.suspended`) invalidate the `me.get` query, not the
 * session. Reading `me` through the query, seeded from the session, is what
 * lets a membership change reach the sidebar without a reload.
 */
export function useConsoleMe(): Me {
  const s = useSession();
  const seed = s.status === "signedIn" ? s.me : undefined;
  const q = useApiQuery(api.me.get, undefined, { initialData: seed, enabled: s.status === "signedIn" });
  if (q.data) return q.data;
  if (!seed) throw new Error("useConsoleMe() needs a signed-in session");
  return seed;
}

/** Only admin memberships belong in the console; a resident login elsewhere is not a society to manage here. */
export function adminMemberships(me: Me): SocietyMembership[] {
  return me.memberships.filter((m) => m.role === "ADMIN");
}

/** The society every API-backed screen reads. `null` only for a platform admin with no society of their own. */
export function useCurrentSociety(): { society: SocietyMembership | null; societies: SocietyMembership[] } {
  const me = useConsoleMe();
  const { state } = useAdminStore();
  const societies = adminMemberships(me);
  // A stored choice from another account, or a society this user has since
  // lost, falls back to their first rather than pointing at nothing.
  const society = societies.find((m) => m.societyId === state.societyId) ?? societies[0] ?? null;
  return { society, societies };
}

/** Whether the membership holds at least one of these permissions — mirrors the contract's `access` rule, for hiding what the server would refuse. */
export function holds(m: SocietyMembership, ...any: Permission[]): boolean {
  return any.some((p) => m.permissions.includes(p));
}

/** Two-letter mark for a society tile: "Shanti Vihar CHS" -> "SV". */
export function societyMark(name: string): string {
  const words = name.replace(/\b(CHS|Ltd|Co-op|Society)\b\.?/gi, "").split(/\s+/).filter(Boolean);
  return (words.length ? words : [name]).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const TITLE: Record<string, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  FAMILY: "Family",
  TENANT: "Tenant",
  GUARD: "Guard",
  STAFF: "Staff",
  ACCOUNTANT: "Accountant",
  AUDITOR: "Auditor",
  COMMITTEE: "Committee",
  MANAGER: "Manager",
};

export function userTypeLabel(t: string): string {
  return TITLE[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");
}

/** "Committee · full access" / "Committee · 9 admin permissions" — what the sidebar says about the signed-in admin. */
export function accessSummary(m: SocietyMembership): string {
  const held = ADMIN_PERMISSIONS.filter((p) => m.permissions.includes(p)).length;
  const scope = held === ADMIN_PERMISSIONS.length ? "full access" : `${held} admin permission${held === 1 ? "" : "s"}`;
  return `${userTypeLabel(m.userType)} · ${scope}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
