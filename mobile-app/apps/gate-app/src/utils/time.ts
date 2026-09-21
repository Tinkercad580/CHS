/**
 * Small time-formatting helpers used throughout the gate app.
 * Mirrors the prototype's `now()` / `stamp()` helpers (see design-files/Gate Prototype.dc.html).
 */

/** "14:07" — the 24h clock shown top-left of the handset. */
export function clockLabel(d: Date = new Date()): string {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/** "4:12pm" — used for entry/exit timestamps and toasts. */
export function stamp(d: Date = new Date()): string {
  let h = d.getHours();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return h + ":" + String(d.getMinutes()).padStart(2, "0") + ap;
}

/** Initials from a full name, max 2 characters, e.g. "Rohan Deshpande" -> "RD". */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** "Until 9:41pm today" for a still-valid pass, from an ISO timestamp. */
export function validUntilLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `Until ${stamp(d)} today` : `Until ${stamp(d)}, ${d.toLocaleDateString()}`;
}

/** "Just now" / "2 days ago" — a plain relative label, derived fresh from an ISO timestamp. */
export function relativeLabel(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "Expired 40 minutes ago" — derived from now vs. an ISO timestamp, never stored. */
export function expiredAgoLabel(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return `Expired ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  return `Expired ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}
