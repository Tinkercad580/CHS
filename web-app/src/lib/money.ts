import { schemas, type ApportionmentMethod } from "@chs/contract";

/**
 * Money on the wire is integer paise; admins read and type rupees. These are
 * the only conversions the console does, and they are done on digit strings,
 * never through a float, so "12840.50" is 1284050 paise exactly.
 */

/** "₹12,840.50" — the ledger and receipt format; whole rupees drop the ".00" only when asked. */
export function inr(paise: number, opts: { whole?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const head = rupees.toLocaleString("en-IN");
  const body = opts.whole && p === 0 ? head : `${head}.${String(p).padStart(2, "0")}`;
  return `${neg ? "−" : ""}₹${body}`;
}

/** "₹8,24,48,100" rounded to the rupee — for dashboard figures, where paise are noise. */
export function inrRound(paise: number): string {
  return `${paise < 0 ? "−" : ""}₹${Math.round(Math.abs(paise) / 100).toLocaleString("en-IN")}`;
}

/** "₹8.24 Cr" / "₹16.5 L" — short form for a stat card's note. */
export function inrShort(paise: number): string {
  const r = paise / 100;
  if (Math.abs(r) >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (Math.abs(r) >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return inrRound(paise);
}

/**
 * What an admin typed in a rupee field, as paise. `null` for anything that
 * is not a plain non-negative amount with at most two decimals.
 */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, "");
  const m = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Paise as the plain rupee string a field is pre-filled with: 1284050 -> "12840.50", 180000 -> "1800". */
export function paiseToInput(paise: number): string {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return p ? `${r}.${String(p).padStart(2, "0")}` : String(r);
}

/** Shifts a decimal string's point `places` to the right (or left, when negative), without floats. */
function shift(value: string, places: number): string {
  const [int, frac = ""] = value.split(".");
  let digits = int + frac;
  let point = int.length + places;
  if (point < 0) {
    digits = "0".repeat(-point) + digits;
    point = 0;
  }
  if (point > digits.length) digits = digits.padEnd(point, "0");
  const a = digits.slice(0, point).replace(/^0+(?=\d)/, "") || "0";
  const b = digits.slice(point).replace(/0+$/, "");
  return b ? `${a}.${b}` : a;
}

// ─── Rates ──────────────────────────────────────────────────────────────────

/**
 * How the rate field reads for each apportionment method. The API's number
 * is paise or basis points (RATE_UNITS); the admin types rupees or a percent.
 */
export type RateKind = "rupees" | "percent" | "byType" | "manual";

export function rateKind(method: ApportionmentMethod): RateKind {
  if (method === "PERCENT_OF_HEAD" || method === "PERCENT_OF_CONSTRUCTION_COST") return "percent";
  if (method === "FIXED_PER_UNIT_TYPE") return "byType";
  if (method === "MANUAL") return "manual";
  return "rupees";
}

/** What the admin's number means, in their units — shown beside the rate field. */
export const RATE_FIELD_UNIT: Record<ApportionmentMethod, string> = {
  EQUAL_PER_UNIT: "₹ per unit per month",
  PER_CARPET_AREA: "₹ per sq ft per month",
  PER_WATER_INLET: "₹ per inlet per month",
  BUILDING_SCOPED_EQUAL: "₹ per lift-served unit per month",
  PER_PARKING_SLOT: "₹ per allotted slot per month",
  PERCENT_OF_HEAD: "% of the base head",
  PERCENT_OF_CONSTRUCTION_COST: "% a year of the building's construction cost",
  PER_MEMBER_FIXED_OR_MIN: "₹ per member per year",
  FIXED_PER_UNIT_TYPE: "₹ per month, by unit type",
  MANUAL: "set per unit",
};

/**
 * The admin's input as the wire's rate string, or an error to show under the
 * field. Rupee rates carry up to 4 decimals of paise (so 6 of rupees);
 * percentages are whole basis points (so 2 decimals of percent).
 */
export function rateFromInput(method: ApportionmentMethod, input: string): { rate: string } | { error: string } {
  const s = input.replace(/[₹,%\s]/g, "");
  const kind = rateKind(method);
  if (kind === "percent") {
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return { error: "Enter a percentage with up to two decimals, for example 0.25." };
    return { rate: shift(s, 2) };
  }
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(s)) return { error: "Enter an amount in rupees, for example 1800 or 3.20." };
  return { rate: shift(s, 2) };
}

/** The wire's rate as the admin typed it: "180000" paise -> "1800", "25" bps -> "0.25". */
export function rateToInput(method: ApportionmentMethod, rate: string): string {
  return rateKind(method) === "manual" ? "" : shift(rate, -2);
}

/** "₹1,800 per unit per month" / "0.25% a year of construction cost" — how a rate reads in a table. */
export function rateLabel(method: ApportionmentMethod, rate: string | null, rateByType?: Record<string, number> | null): string {
  if (rate === null) return "No rate set";
  const kind = rateKind(method);
  if (kind === "manual") return "Set per unit";
  if (kind === "byType") {
    const parts = Object.entries(rateByType ?? {}).map(([t, p]) => `${t.charAt(0) + t.slice(1).toLowerCase()} ${inr(p, { whole: true })}`);
    return parts.length ? parts.join(" · ") : "By unit type";
  }
  const shown = shift(rate, -2);
  if (kind === "percent") return `${shown}% ${method === "PERCENT_OF_HEAD" ? "of base head" : "a year of construction cost"}`;
  const [int, frac] = shown.split(".");
  const rupees = `₹${Number(int).toLocaleString("en-IN")}${frac ? `.${frac.padEnd(2, "0")}` : ""}`;
  return `${rupees} ${RATE_FIELD_UNIT[method].replace(/^₹ /, "")}`;
}

/** The contract's own wording of the rate unit, for a tooltip or hint. */
export function wireRateUnit(method: ApportionmentMethod): string {
  return schemas.billing.RATE_UNITS[method];
}

// ─── Periods ────────────────────────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" -> "October 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : period;
}

/** "2026-10" -> "Oct 2026". */
export function periodShort(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1].slice(0, 3)} ${y}` : period;
}

/** The month after "2026-09": "2026-10". */
export function nextPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Today's date in India, as YYYY-MM-DD — the society's calendar, whatever the browser's zone. */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** The India date of a timestamp as `YYYY-MM-DD` — "2026-09-30T20:00:00Z" is 1 October in Pune. */
export function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** "+12.4%" from basis points. */
export function bpsChange(bps: number): string {
  return `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;
}

/**
 * "FY 2026-27" for today in India, given the month the society's financial
 * year starts (society.fyStartMonth, 4 for April). A January start is a
 * calendar year and reads "FY 2026".
 */
export function fyLabel(fyStartMonth: number, today = todayIso()): string {
  const [y, m] = today.split("-").map(Number);
  const start = m >= fyStartMonth ? y : y - 1;
  return fyStartMonth === 1 ? `FY ${start}` : `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
