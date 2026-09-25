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

/** How the resident holds the flat they live in, from the membership's user type. */
export type HomeHolding = "owner" | "coOwner" | "family" | "tenant";

/** Another flat of the resident's: one they are a current owner-member of, let out or not. */
export interface OtherUnit {
  label: string;
  /** It has an active tenancy, so it is someone else's home and the resident is its landlord. */
  letOut: boolean;
}

export interface ResidentIdentity {
  userId: string;
  societyId: string;
  societyName: string;
  /** The flat the resident lives in — `/me`'s membership unit. */
  homeUnit: string;
  homeHolding: HomeHolding;
  /** Every other flat of theirs in myHome, in its order. Each gets its own ledger in the unit switcher. */
  otherUnits: OtherUnit[];
}

const HOLDING_BY_USER_TYPE: Partial<Record<SocietyMembership["userType"], HomeHolding>> = {
  OWNER: "owner",
  CO_OWNER: "coOwner",
  FAMILY: "family",
  TENANT: "tenant",
};

/**
 * Maps the real account onto the app's three viewing roles. Tenant comes from
 * the user type; "owner and landlord" needs myHome to show another flat of
 * theirs with an active tenancy, so an owner starts as plain owner and gains
 * the other ledgers when that data arrives. A second flat that isn't let out
 * (vacant, or lived in by family) is listed too, but doesn't make them a
 * landlord. A co-owner or family member keeps the owner role, which only
 * decides what they may do (vote, register household); how they hold the flat
 * is `homeHolding`, and that is what the app prints.
 */
export function deriveIdentity(me: Me, membership: SocietyMembership, home: MyHome | undefined): { identity: ResidentIdentity; role: Role } {
  const homeHolding = HOLDING_BY_USER_TYPE[membership.userType] ?? "owner";
  const base = { userId: me.id, societyId: membership.societyId, societyName: membership.societyName, homeUnit: membership.unitLabel ?? "", homeHolding };
  if (homeHolding === "tenant") return { identity: { ...base, otherUnits: [] }, role: "tenant" };
  const otherUnits: OtherUnit[] = (home?.units ?? [])
    .filter((u) => u.unit.id !== membership.unitId && u.currentMembers.some((m) => m.person.userId === me.id))
    .map((u) => ({ label: u.unit.label, letOut: u.activeTenancy !== null }));
  return { identity: { ...base, otherUnits }, role: otherUnits.some((u) => u.letOut) ? "owner_tenant" : "owner" };
}

/** How the flat they live in is held, as the app prints it. */
export const HOLDING_LABEL: Record<HomeHolding, string> = {
  owner: "Owner",
  coOwner: "Co-owner",
  family: "Family member",
  tenant: "Tenant",
};

/** Every flat the resident can view, the one they live in first. */
export function heldUnits(identity: ResidentIdentity | null): string[] {
  return identity ? [identity.homeUnit, ...identity.otherUnits.map((u) => u.label)] : [];
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
