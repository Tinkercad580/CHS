/** Billing bill-run screen seed — head-wise totals, wing variance and
 * exceptions for the September bill run preview step. See MASTER_SPEC.md
 * Part B for the apportionment methods these mirror. */
export interface ChargeHead {
  name: string;
  method: string;
  total: string;
  units: string;
}

export const CHARGE_HEADS: ChargeHead[] = [
  { name: "Service charges", method: "EQUAL_PER_UNIT", total: "₹6,20,000.00", units: "248 units × ₹2,500" },
  { name: "Property tax", method: "AUTHORITY_FIXED", total: "₹3,84,000.00", units: "as fixed by PMC" },
  { name: "Water charges", method: "PER_WATER_INLET", total: "₹1,48,800.00", units: "by sanctioned inlets" },
  { name: "Lift maintenance", method: "BUILDING_SCOPED_EQUAL", total: "₹1,92,000.00", units: "192 flats in A + B" },
  { name: "Non-occupancy", method: "PERCENT_OF_HEAD · 10%", total: "₹15,250.00", units: "61 tenanted units" },
  { name: "Sinking fund", method: "PERCENT_OF_CONSTRUCTION_COST", total: "₹1,68,000.00", units: "0.25% p.a." },
  { name: "Repair & maintenance fund", method: "PERCENT_OF_CONSTRUCTION_COST", total: "₹5,04,000.00", units: "0.75% p.a." },
  { name: "Interest on defaults", method: "INTEREST_SIMPLE · 12% cap", total: "₹13,950.00", units: "31 units in arrears" },
];

export interface WingVariance {
  wing: string;
  pct: number;
  label: string;
  color: string;
  fg: string;
}

export const WING_VARIANCE: WingVariance[] = [
  { wing: "Wing A", pct: 22, label: "+1.2%", color: "#6FB3A1", fg: "var(--ok,#167A3C)" },
  { wing: "Wing B", pct: 68, label: "+7.4%", color: "#B45309", fg: "var(--warn,#B45309)" },
  { wing: "Wing C", pct: 14, label: "+0.6%", color: "#6FB3A1", fg: "var(--ok,#167A3C)" },
];

export const BILLING_EXCEPTIONS: { title: string; body: string }[] = [
  { title: "C-0101 · no carpet area recorded", body: "Insurance and lease rent apportion by carpet area. Bill held until the value is entered." },
  { title: "A-0805 · occupancy changed mid-period", body: "Tenanted from 18 Oct. Non-occupancy pro-rated for 14 days. Confirm before publishing." },
];

export const BILL_RUN_STEPS = ["Snapshot", "Compute", "Preview", "Approve", "Publish"];
