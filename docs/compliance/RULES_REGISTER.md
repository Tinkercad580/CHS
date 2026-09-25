# Rules register

One row per statutory obligation the platform implements — MASTER_SPEC B1.
**Status today: the research pass has not been done.** Every value below comes
from MASTER_SPEC v2.0 or is a placeholder, and every `statutory_config` row is
seeded with `verified_on = NULL`. Billing (Phase 4) must not start until the
rows it depends on are verified against primary sources and this table says so.

| # | Obligation (plain English) | Rule reference | Config key | Current value | Source | Verified | Code |
|---|---|---|---|---|---|---|---|
| 1 | Interest on defaulted dues is simple, ≤ 12% p.a., rate set by the general body | MCS Rules 2026, 106C-12 | `interest_cap_percent` | 12 | MASTER_SPEC B2/B3.1 | ✗ | `society.service.ts` updateBillingConfig |
| 2 | Non-occupancy charge ≤ 10% of service charges, only when TENANTED | 106C-12 | `non_occupancy_percent`, `non_occupancy_base` | 10, SERVICE_CHARGES | MASTER_SPEC B3.2 | ✗ | occupancy model (billing pending) |
| 3 | Sinking fund ≥ 0.25% p.a. of construction cost | 106C-12 | `sinking_fund_min_percent` | 0.25 | MASTER_SPEC B2 | ✗ | `core/statutory.ts` (min bound) |
| 4 | Repair & maintenance fund ≥ 0.75% p.a. of construction cost | 106C-12 | `repair_fund_min_percent` | 0.75 | MASTER_SPEC B2 | ✗ | `core/statutory.ts` |
| 5 | Education & training fund ≥ ₹10 per member or government rate | 106C-12 | `education_fund_min_amount_paise` | 1000 | MASTER_SPEC B2 | ✗ | — |
| 6 | GST only above both thresholds (member ₹7,500/month, turnover ₹20 lakh/yr) | CGST — verify | `gst_member_threshold_paise`, `gst_turnover_threshold_paise` | 750000, 200000000 | MASTER_SPEC B3.6 | ✗ | — |
| 7 | GST rate | CGST — verify | `gst_rate_percent` | 18 (placeholder) | — | ✗ | — |
| 8 | Transfer premium cap | Bye-laws — verify | `transfer_premium_cap_paise` | 25,000 ₹ (placeholder) | — | ✗ | — |
| 9 | AGM / SGM notice periods | Bye-laws — verify | `agm_notice_days`, `sgm_notice_days` | 14, 14 (placeholders) | — | ✗ | — |
| 10 | AGM deadline, audit deadline, quorum | MCS Act — verify | `agm_deadline_rule`, `audit_deadline_rule`, `quorum_rule` | placeholders | — | ✗ | — |
| 11 | Structural and fire audit periodicity | Bye-laws / Fire Act 2006 — verify | `structural_audit_intervals`, `fire_audit_frequency` | placeholders | — | ✗ | — |
| 12 | Visitor PII retained ≤ 90 days then anonymised | MASTER_SPEC B3.12, DPDP | `visitor_data_retention_days` | 90 | MASTER_SPEC | ✗ | `society.service.ts` updateSettings |
| 13 | One primary owner per unit; tenants don't vote | C3 | — | — | MASTER_SPEC C3 | n/a | DB index `memberships_one_primary_per_unit` |
| 14 | Lift charges follow the building, not the floor | 106C-12 | — | — | MASTER_SPEC B3.3 | ✗ | `units.lift_served` follows `buildings.lift_present` |

## Needs legal confirmation

All of rows 1–12. Also: MASTER_SPEC A2's "found and no password → create
password" lets anyone who knows an invited number activate it first
(mitigated, not solved — see docs/ARCHITECTURE.md › Authentication).

## How a row becomes verified

Research the primary source (Gazette, Sahakar Ayukta, CBIC). Record it in
`SOURCES.md`. Insert a new effective-dated `statutory_config` row with
`source_reference`, `rule_citation` and `verified_on` (never edit the old
one). Log the change in `CHANGELOG_COMPLIANCE.md`. Tick the row here.
