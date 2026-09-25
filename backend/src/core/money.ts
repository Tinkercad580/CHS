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
