import type { Language } from "../types/resident";

const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/**
 * Localises interpolated counts to Devanagari numerals for mr/hi.
 * Currency stays in Latin digits with the ₹ symbol (Indian banking convention) —
 * do not run this over money strings. See README.md "Localisation".
 */
export function num(n: number, language: Language): string {
  if (language === "en") return String(n);
  return String(n)
    .split("")
    .map((ch) => (ch >= "0" && ch <= "9" ? DEVANAGARI_DIGITS[Number(ch)] : ch))
    .join("");
}
