import type { PillKind, Row } from "./types";

/** Formats a paise-free rupee integer with Indian digit grouping, e.g. 1646000 -> "₹16,46,000". */
export function money(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Formats with two decimal places, e.g. 12840.5 -> "₹12,840.50" — the ledger/receipt format. */
export function moneyDecimal(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

/** Strips everything but digits and dot, e.g. "₹12,840.50" -> 12840.5. */
export function numFrom(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export const PILL_TOKENS: Record<PillKind, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-wash,#E8F5EC)", fg: "var(--ok-ink,#14663A)" },
  warn: { bg: "var(--warn-wash,#FDF3E7)", fg: "var(--warn-ink,#8F4A0A)" },
  bad: { bg: "var(--bad-wash,#FCEDEC)", fg: "var(--bad-ink,#9B2B22)" },
  info: { bg: "var(--info-wash,#EAF0FE)", fg: "var(--info-ink,#12327A)" },
  mute: { bg: "var(--border-soft,#F1F4F3)", fg: "var(--ink-soft,#3D4A46)" },
};

/**
 * Maps a status word to a semantic pill kind for record-page section rows.
 * paid/ok/current/valid -> ok; due/pending/overdue -> warn (failed/missed -> bad);
 * legal/breach -> bad. See README, "Status words in table cells are mapped to
 * semantic pills by a single matcher".
 */
export function stateKind(value: string): PillKind {
  const t = value.toLowerCase();
  if (/paid|ok|current|valid/.test(t)) return "ok";
  if (/failed|missed/.test(t)) return "bad";
  if (/due|overdue|pending/.test(t)) return "warn";
  if (/legal|breach/.test(t)) return "bad";
  return "mute";
}

/** Two-letter mark from the first letters of up to two words, for avatar-like glyphs. */
export function markFrom(text: string): string {
  return text
    .split(/[\s·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Row search across every visible column, case-insensitive. */
export function rowMatches(r: Row, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [r.a, r.b, r.c, r.d, r.e, r.pill].join(" ").toLowerCase().includes(q);
}

/** Filter-chip match against occupancy/status/date-ish columns (b, c, d, pill). */
export function rowMatchesChip(r: Row, chipLabel: string): boolean {
  const want = chipLabel.toLowerCase().split(" ")[0];
  return [r.b, r.c, r.d, r.pill].join(" ").toLowerCase().includes(want);
}

const ROW_KEYS: (keyof Row)[] = ["a", "b", "c", "d", "e", "pill"];

/**
 * Sorts rows by column index. Currency/date columns sort numerically once a
 * parseFloat probe on both values succeeds; text columns sort alphabetically.
 * See README: "a single parseFloat probe decides which".
 */
export function sortRows(rows: Row[], colIndex: number, dir: 1 | -1): Row[] {
  const key = ROW_KEYS[colIndex];
  const asNum = (v: string): number | null => {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? null : n;
  };
  return rows.slice().sort((x, y) => {
    const nx = asNum(String(x[key]));
    const ny = asNum(String(y[key]));
    if (nx !== null && ny !== null) return (nx - ny) * dir;
    return String(x[key]).localeCompare(String(y[key])) * dir;
  });
}
