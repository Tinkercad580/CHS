import { api, type Approval, type Me, type SocietyMembership, type UnitOverview } from "@chs/contract";
import { useApiQuery, useMe, toLoadState, type LoadState } from "@chs/api-client/react";
import type { Role } from "@sahaj/shared";

/**
 * Who the signed-in resident is, and their home as the society records it.
 *
 * Identity (name, mobile, society, home flat) comes from `/me` and is on hand
 * the moment sign-in completes. Everything about the flats themselves —
 * members, family, vehicles, tenancies — comes from `members.myHome`, which is
 * one cached query every screen shares; realtime `members.changed` and
 * `approvals.changed` events refetch it, so nothing here polls.
 */

export type MyHome = { units: UnitOverview[]; pendingApprovals: Approval[] };

/**
 * The membership the resident app runs against. A person can hold several
 * (an admin who also lives in the society); the app is for the USER-role one
 * with a flat. None means this account has nothing to show here.
 */
export function residentMembership(me: Me): SocietyMembership | null {
  return me.memberships.find((m) => m.role === "USER" && m.unitId !== null && m.unitLabel !== null) ?? null;
}

export function useResidentAccount() {
  const me = useMe();
  const membership = residentMembership(me);
  const query = useApiQuery(api.members.myHome, { params: { societyId: membership?.societyId ?? "" } }, { enabled: membership !== null });
  const home: LoadState<MyHome> = toLoadState(query);
  return { me, membership, home, query };
}

/** One unit of `myHome`, by the label the app navigates with. */
export function unitByLabel(home: MyHome, label: string): UnitOverview | undefined {
  return home.units.find((u) => u.unit.label === label);
}

export interface ResidentIdentity {
  userId: string;
  societyId: string;
  societyName: string;
  /** The flat the resident lives in — `/me`'s membership unit. */
  homeUnit: string;
  /** A flat they own and have let out, which gets its own ledger and tenancy screens. */
  letOutUnit: string | null;
}

/**
 * Maps the real account onto the app's three viewing roles, which scope the
 * (still local) bills, polls and home cards. Tenant comes from the user type;
 * "owner and landlord" needs myHome to show another flat of theirs with an
 * active tenancy, so an owner starts as plain owner and gains the second
 * ledger when that data arrives.
 */
export function deriveIdentity(me: Me, membership: SocietyMembership, home: MyHome | undefined): { identity: ResidentIdentity; role: Role } {
  const homeUnit = membership.unitLabel ?? "";
  const base = { userId: me.id, societyId: membership.societyId, societyName: membership.societyName, homeUnit };
  if (membership.userType === "TENANT") return { identity: { ...base, letOutUnit: null }, role: "tenant" };
  const letOut =
    home?.units.find((u) => u.unit.id !== membership.unitId && u.activeTenancy !== null && u.currentMembers.some((m) => m.person.userId === me.id)) ?? null;
  return { identity: { ...base, letOutUnit: letOut?.unit.label ?? null }, role: letOut ? "owner_tenant" : "owner" };
}

/** Units where the resident is an owner-member and a tenancy exists or existed — the "My tenants" screen. */
export function landlordUnits(me: Me, home: MyHome): UnitOverview[] {
  return home.units.filter((u) => u.currentMembers.some((m) => m.person.userId === me.id) && (u.activeTenancy !== null || u.pastTenancies.length > 0));
}

export interface HouseholdRow {
  id: string;
  name: string;
  /** "Primary owner", "Co-owner", "Tenant", or the family relation as recorded ("Spouse"). */
  relation: string;
  you: boolean;
  /** Family records can be removed by the resident; members and tenancies only by the office. */
  familyId: string | null;
}

/**
 * Everyone the society has against the flat the resident lives in: its owner
 * members (or, for a tenant, the tenant), then family. The API keeps members and
 * family as separate records, so a co-owner who is also listed as a spouse would
 * appear twice; the family copy is dropped when a mobile or name matches.
 */
export function householdRows(me: Me, unit: UnitOverview, tenant: boolean): HouseholdRow[] {
  const people: HouseholdRow[] = tenant
    ? [{ id: "self", name: me.name, relation: "Tenant", you: true, familyId: null }]
    : unit.currentMembers.map((m) => ({
        id: m.id,
        name: m.person.name,
        relation: MEMBERSHIP_LABEL[m.kind] ?? m.kind,
        you: m.person.userId === me.id,
        familyId: null,
      }));
  const mobiles = new Set([...(tenant ? [me.mobile] : unit.currentMembers.map((m) => m.person.mobile))].filter(Boolean));
  const names = new Set(people.map((p) => p.name.toLowerCase()));
  const family = unit.family
    .filter((f) => !(f.mobile && mobiles.has(f.mobile)) && !names.has(f.name.toLowerCase()))
    .map((f) => ({ id: f.id, name: f.name, relation: f.relation, you: false, familyId: f.id }));
  return [...people, ...family];
}

export function pendingFor(home: MyHome, unitId: string, kind: Approval["kind"]): Approval[] {
  return home.pendingApprovals.filter((a) => a.status === "PENDING" && a.kind === kind && a.unitId === unitId);
}

// ---- Formatting -------------------------------------------------------------

/** "9822041155" → "+91 98220 41155", the way the design prints a number. */
export function formatMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : mobile;
}

/** "MH12KJ4471" → "MH 12 KJ 4471". The API stores plates without spaces; the gate and the design read them spaced. */
export function formatPlate(plate: string): string {
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(plate);
  if (!m) return plate;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2019-03-01" → "March 2019". */
export function monthYear(isoDate: string): string {
  const [y, m] = isoDate.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}

/** "2025-04-01" → "1/4/2025" — the same en-IN short form the tenancy cards already used. Parsed as a calendar date, not a UTC instant. */
export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN");
}

export const OCCUPANCY_LABEL: Record<string, string> = {
  SELF_OCCUPIED: "Self-occupied",
  FAMILY_OCCUPIED: "Family-occupied",
  TENANTED: "Tenanted",
  VACANT: "Vacant",
  LOCKED: "Locked",
  UNDER_RENOVATION: "Under renovation",
};

export const MEMBERSHIP_LABEL: Record<string, string> = {
  PRIMARY: "Primary owner",
  CO_OWNER: "Co-owner",
  ASSOCIATE: "Associate member",
};
