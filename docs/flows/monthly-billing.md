# Flow: a month's billing

Actors: the treasurer or secretary (admin console, `billing.generate` /
`billing.publish`), then residents. Rules: [../modules/billing.md](../modules/billing.md).

```mermaid
sequenceDiagram
  participant Admin as Admin console
  participant API
  participant DB
  participant Jobs
  participant Residents as Resident apps
  Admin->>API: POST /bill-runs { period: "2026-10" }
  API->>DB: facts, rates, statutory values as of 1 Oct → draft bills + lines
  API-->>Admin: preview (by head, by building, >10% variances, exceptions)
  opt fix something (rate, area, occupancy)
    Admin->>API: change it, then POST /bill-runs/:id/recompute
  end
  Admin->>API: POST /bill-runs/:id/publish
  API->>DB: lock run · number bills (gapless) · ledger debits · apply advances · commit
  API->>Jobs: after commit: notify each unit's residents (push + email)
  API-->>Admin: published preview
  Jobs-->>Residents: "October bill is out — ₹3,898, due 15 Oct"
  Note over Residents: realtime billing.changed → dues and bills refetch
```

**Before publishing, check:**
- **Exceptions:** units with no carpet area (per-area heads), buildings without
  a construction cost (fund heads), units without a primary owner, a
  non-occupancy rate over the cap.
- **Variances:** a unit whose bill moved more than 10% usually means a changed
  area, occupancy or rate.
- **Interest:** only units with overdue principal carry an interest line, and
  its basis names the bills and days.

**After publishing:**
- The run's bills can't change. To correct one, cancel an unpaid bill
  (`billing.cancelBill`) or issue a credit note (`billing.creditNote`).
- Rates can no longer be set inside the published period. The next rate
  change starts after it.
- Residents see the bill with every line's basis, and pay it:
  [paying-dues.md](paying-dues.md).
- The bill register report for the period is available in Reports.
