/**
 * Money is integer paise — MASTER_SPEC E1. The database holds BIGINT; the wire
 * carries a JSON number. This module is the only place the two meet, and the
 * only place money arithmetic is allowed (A4.1 rule 3).
 */

export type Paise = bigint;

/** DB → wire. Refuses values a JSON number can't hold exactly. */
export function toWire(p: bigint | null | undefined): number | null {
  if (p === null || p === undefined) return null;
  if (p > BigInt(Number.MAX_SAFE_INTEGER) || p < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`Amount ${p} paise exceeds the safe integer range`);
  }
  return Number(p);
}

/** Wire → DB. */
export function fromWire(n: number | null | undefined): bigint | null {
  if (n === null || n === undefined) return null;
  if (!Number.isSafeInteger(n)) throw new RangeError(`Amount ${n} is not a whole number of paise`);
  return BigInt(n);
}

export function add(...values: Paise[]): Paise {
  return values.reduce((a, b) => a + b, 0n);
}

/**
 * `amount × bps / 10000`, rounded half away from zero. Basis points keep rates
 * integral: 1200 bps = 12%.
 */
export function applyBps(amount: Paise, bps: number): Paise {
  if (!Number.isInteger(bps)) throw new RangeError("Rate must be whole basis points");
  const num = amount * BigInt(bps);
  const q = num / 10_000n;
  const r = num % 10_000n;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice >= 10_000n) return num < 0n ? q - 1n : q + 1n;
  return q;
}

/** Format for display: ₹1,23,456.78 (Indian digit grouping). */
export function formatInr(p: Paise | number): string {
  const v = typeof p === "bigint" ? p : BigInt(p);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const rupees = (abs / 100n).toString();
  const paise = (abs % 100n).toString().padStart(2, "0");
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}₹${rest ? `${rest},` : ""}${last3}.${paise}`;
}

const SCALE_RATE = 10_000n; // rates carry up to 4 decimals
const SCALE_QTY = 100n; // quantities (sq ft) carry up to 2 decimals

/** Parse a non-negative decimal string into an integer scaled by 10^dp, exactly. */
export function scaleDecimal(value: string | number, dp: number): bigint {
  const s = typeof value === "number" ? value.toFixed(dp) : value.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new RangeError(`Not a non-negative decimal: ${value}`);
  const [int, frac = ""] = s.split(".");
  if (frac.length > dp && /[1-9]/.test(frac.slice(dp))) throw new RangeError(`${value} has more than ${dp} decimals`);
  return BigInt(int!) * 10n ** BigInt(dp) + BigInt((frac + "0".repeat(dp)).slice(0, dp) || "0");
}

/** num / den rounded half away from zero. */
export function divRound(num: bigint, den: bigint): Paise {
  if (den === 0n) throw new RangeError("Division by zero");
  const neg = num < 0n !== den < 0n;
  const n = num < 0n ? -num : num;
  const d = den < 0n ? -den : den;
  const q = n / d;
  const r = n % d;
  const out = r * 2n >= d ? q + 1n : q;
  return neg ? -out : out;
}

/** A rate (paise, up to 4 dp) × a quantity (up to 2 dp) × whole months → paise. */
export function rateTimes(rate: string, quantity: string | number, months = 1): Paise {
  return divRound(scaleDecimal(rate, 4) * scaleDecimal(quantity, 2) * BigInt(months), SCALE_RATE * SCALE_QTY);
}

/** amount × num / den, rounded once at the end. */
export function prorate(amount: Paise, num: bigint, den: bigint): Paise {
  return divRound(amount * num, den);
}

/**
 * Simple interest: principal × bps × days / (10000 × 365). Simple, never
 * compound — callers pass principal only, never interest (MASTER_SPEC B3.1).
 */
export function simpleInterest(principal: Paise, bps: number, days: number): Paise {
  if (principal <= 0n || days <= 0 || bps <= 0) return 0n;
  return divRound(principal * BigInt(bps) * BigInt(days), 10_000n * 365n);
}

export function roundToRupee(amount: Paise, rule: "NEAREST_RUPEE" | "UP_RUPEE" | "NONE"): Paise {
  if (rule === "NONE") return amount;
  const rem = ((amount % 100n) + 100n) % 100n;
  if (rem === 0n) return amount;
  if (rule === "UP_RUPEE") return amount + (100n - rem);
  return rem >= 50n ? amount + (100n - rem) : amount - rem;
}

export const max = (a: Paise, b: Paise): Paise => (a > b ? a : b);
export const min = (a: Paise, b: Paise): Paise => (a < b ? a : b);
export const sub = (a: Paise, b: Paise): Paise => a - b;
export const isPositive = (a: Paise): boolean => a > 0n;
export const ZERO: Paise = 0n;

/** "₹3.20" from a paise rate string like "320". */
export function formatRate(paise: string): string {
  const scaled = scaleDecimal(paise, 4); // paise × 10^4
  const rupees = Number(scaled) / 1_000_000;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 4 })}`;
}
