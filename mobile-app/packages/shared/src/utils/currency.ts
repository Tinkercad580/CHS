/** Formats a rupee amount as the design specifies: "₹9,625". */
export function formatInr(amount: number): string {
  // The prototype formats money as `"₹" + x.toLocaleString("en-IN")`, which prints
  // no decimal part for a whole rupee amount — every figure in the design reads
  // "₹6,050", never "₹6,050.00". Paise appear in the design only in hardcoded
  // per-unit rates ("₹3.20 per unit"), never through this helper, so decimals are
  // rendered only when the value actually has them rather than always.
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const intPart = Math.trunc(abs);
  const digits = String(intPart);
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  const fraction = abs - intPart;
  const decimals = fraction ? String(Math.round(fraction * 100)).padStart(2, "0").replace(/0$/, "") : "";
  return `${sign}₹${grouped}${decimals ? "." + decimals : ""}`;
}
