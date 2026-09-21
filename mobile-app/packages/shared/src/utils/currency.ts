/** Formats a rupee amount as the design specifies: "₹9,625.00". */
export function formatInr(amount: number): string {
  const [intPart, decPart = "00"] = amount.toFixed(2).split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = intPart.replace("-", "");
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  return `${sign}₹${grouped}.${decPart}`;
}
