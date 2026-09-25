import type { Me, SocietyMembership } from "@chs/contract";
import { useMe } from "@chs/api-client/react";

/**
 * Who is holding the handset, as the API knows them.
 *
 * A guard is a USER-role member of one society with the GUARD user type (the
 * server hard-restricts that type to the gate and common surfaces). The gate
 * app also admits anyone granted `gate.operate` — a society that has a
 * supervisor cover a shift — since that is the permission the gate endpoints
 * check. Anyone else signing in here has nothing to do at a gate.
 */
export function guardMembership(me: Me): SocietyMembership | null {
  return me.memberships.find((m) => m.userType === "GUARD") ?? me.memberships.find((m) => m.permissions.includes("gate.operate")) ?? null;
}

/** The signed-in guard and the society whose gate this is. Only for trees SessionGate mounts after checking `guardMembership`. */
export function useGuard(): { me: Me; membership: SocietyMembership; societyId: string } {
  const me = useMe();
  const membership = guardMembership(me);
  if (!membership) throw new Error("useGuard() needs a guard account");
  return { me, membership, societyId: membership.societyId };
}

/** "9890012345" → "98900 12345" — the national number in two groups of five, with +91 drawn separately. */
export function groupMobile(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** What the guard typed, the way the API stores plates: no spaces or dashes, upper case. The API matches it as a substring. */
export function normalizePlate(text: string): string {
  return text.replace(/[\s-]/g, "").toUpperCase();
}

/** "MH12KJ4471" → "MH 12 KJ 4471", the way the design and a number plate print it. */
export function formatPlate(plate: string): string {
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(plate);
  if (!m) return plate;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}
