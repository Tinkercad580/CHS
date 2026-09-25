/**
 * Platform defaults for statutory_config — MASTER_SPEC B4.
 *
 * `verifiedOn` is null on every row: nothing here has been checked against a
 * primary source yet. Values the spec states are marked as coming from it;
 * the rest are conservative placeholders. The compliance research pass (B1)
 * verifies each one, records it in docs/compliance/RULES_REGISTER.md and
 * adds a new effective-dated row — this file is never edited to change a
 * value in force. TODO(compliance): all rows.
 */

const SPEC = "MASTER_SPEC v2.0 — not yet verified against the primary source";
const PLACEHOLDER = "Placeholder default — TODO(compliance): verify before use";
const R106C12 = "MCS (Amendment) Rules 2026, Rule 106C-12";

export interface StatutorySeed {
  key: string;
  value: string;
  unit: string;
  sourceReference: string;
  ruleCitation: string | null;
}

export const STATUTORY_SEED: StatutorySeed[] = [
  { key: "interest_cap_percent", value: "12", unit: "% p.a. simple", sourceReference: SPEC, ruleCitation: R106C12 },
  { key: "non_occupancy_percent", value: "10", unit: "% of service charges", sourceReference: SPEC, ruleCitation: R106C12 },
  { key: "non_occupancy_base", value: "SERVICE_CHARGES", unit: "charge head", sourceReference: SPEC, ruleCitation: R106C12 },
  { key: "sinking_fund_min_percent", value: "0.25", unit: "% p.a. of construction cost", sourceReference: SPEC, ruleCitation: R106C12 },
  { key: "repair_fund_min_percent", value: "0.75", unit: "% p.a. of construction cost", sourceReference: SPEC, ruleCitation: R106C12 },
  { key: "education_fund_min_amount_paise", value: "1000", unit: "paise per member", sourceReference: SPEC, ruleCitation: R106C12 },
  { key: "gst_member_threshold_paise", value: "750000", unit: "paise per member per month", sourceReference: SPEC, ruleCitation: "CGST notification — verify current" },
  { key: "gst_turnover_threshold_paise", value: "200000000", unit: "paise per year", sourceReference: SPEC, ruleCitation: "CGST Act s.22 — verify current" },
  { key: "gst_rate_percent", value: "18", unit: "%", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "transfer_premium_cap_paise", value: "2500000", unit: "paise", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "agm_notice_days", value: "14", unit: "clear days", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "sgm_notice_days", value: "14", unit: "clear days", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "agm_deadline_rule", value: "BEFORE_30_SEPTEMBER", unit: "rule", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "audit_deadline_rule", value: "WITHIN_4_MONTHS_OF_FY_END", unit: "rule", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "quorum_rule", value: "LESSER_OF_TWO_THIRDS_OR_20", unit: "rule", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "structural_audit_intervals", value: "AGE_15_TO_30:5Y;AGE_OVER_30:3Y", unit: "rule", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "fire_audit_frequency", value: "HALF_YEARLY", unit: "rule", sourceReference: PLACEHOLDER, ruleCitation: null },
  { key: "visitor_data_retention_days", value: "90", unit: "days", sourceReference: SPEC, ruleCitation: "MASTER_SPEC B3.12; DPDP Act 2023" },
];
