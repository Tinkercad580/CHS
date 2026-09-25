import type { SocietyUser } from "@chs/contract";
import type { PillKind } from "./types";

/**
 * Turning wire values into the strings the admin design prints. The design's
 * mock rows are pre-formatted ("Today, 08:14", "98220 41155", "Self-occupied");
 * these produce the same forms from ISO timestamps, bare mobiles and enum codes.
 */

/** "9820011001" -> "98200 11001". */
export function formatMobile(m: string): string {
  const d = m.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : m;
}

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function time(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "01 Apr 2026" from an ISO date or datetime. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "Today, 08:14" / "Yesterday, 19:02" / "04 Sep 2026" — the design's last-login column. */
export function formatWhen(iso: string | null | undefined, never = "—"): string {
  if (!iso) return never;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return never;
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (days === 0) return `Today, ${time(d)}`;
  if (days === 1) return `Yesterday, ${time(d)}`;
  return formatDate(iso);
}

/** "25 Sep 2026, 14:02" — for audit trails, where the time always matters. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(iso)}, ${time(d)}`;
}

/** "14:32" if today, otherwise with the date. */
export function formatUntil(iso: string): string {
  const d = new Date(iso);
  return startOfDay(d) === startOfDay(new Date()) ? time(d) : formatDateTime(iso);
}

/** "SELF_OCCUPIED" -> "Self-occupied", "UNDER_RENOVATION" -> "Under renovation". */
export function enumLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const s = code.toLowerCase().replace(/_/g, " ");
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/^(Self|Family) occupied$/, "$1-occupied");
}

/**
 * The design's status pill for a user, from the API's account status.
 * INVITED means the number was added but no password exists yet — the
 * design's "Password not set". A guard is hard-restricted to the gate app
 * whatever their permissions say (MASTER_SPEC A1.2), which the design marks.
 */
export function userStatusPill(u: Pick<SocietyUser, "status" | "userType" | "lockedUntil">): { label: string; kind: PillKind } {
  switch (u.status) {
    case "SUSPENDED":
      return { label: "Suspended", kind: "mute" };
    case "LOCKED":
      return { label: u.lockedUntil ? `Locked until ${formatUntil(u.lockedUntil)}` : "Locked", kind: "bad" };
    case "INVITED":
      return { label: "Password not set", kind: "warn" };
    default:
      return u.userType === "GUARD" ? { label: "Gate app only", kind: "info" } : { label: "Active", kind: "ok" };
  }
}

const AUTH_EVENT: Record<string, string> = {
  ACTIVATED: "Created their password",
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILED: "Wrong password",
  LOCKED: "Locked after failed attempts",
  UNLOCKED: "Unlocked",
  PASSWORD_CHANGED: "Changed password",
  TEMP_PASSWORD_ISSUED: "Temporary password issued",
  SESSION_REVOKED: "Signed out a device",
  ALL_SESSIONS_REVOKED: "Signed out everywhere",
  REFRESH_REUSE_DETECTED: "Stolen session blocked",
  TWO_FACTOR_ENABLED: "Turned on two-factor",
  TWO_FACTOR_DISABLED: "Turned off two-factor",
  SUSPENDED: "Suspended",
  REACTIVATED: "Reactivated",
};

export function authEventLabel(type: string): string {
  return AUTH_EVENT[type] ?? enumLabel(type);
}

/** A short device description from a stored user agent: "Chrome · Windows". */
export function deviceLabel(s: { deviceName: string | null; userAgent: string | null; client: string }): string {
  const ua = s.userAgent ?? s.deviceName ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  const parts = [browser, os].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return s.deviceName || enumLabel(s.client);
}
