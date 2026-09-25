# Dashboard, reports and the platform console

**Code:** [modules/reports/](../../backend/src/modules/reports), [modules/platform/](../../backend/src/modules/platform).
**Endpoints:** `reports.*`, `platform.*`, `health.live`.

## Dashboard (MASTER_SPEC C18)

`reports.dashboard` returns the following for the society, in one call:

| Field | Meaning |
|---|---|
| `billedThisMonthPaise`, `collectedThisMonthPaise` | Published bills dated in this calendar month; successful payments paid in it |
| `billedFyPaise`, `collectedFyPaise`, `collectionEfficiencyBps` | The same for the financial year, and collected ÷ billed |
| `outstandingPaise`, `ageing` | Open balances. `notYetDue`, then by days past due: 0–30, 31–60, 61–90, 90+. |
| `monthly` | Six months, oldest first, of billed vs collected, for the chart |
| `topDefaulters` | Ten units with the most overdue: owner name, amount, oldest due date |
| `occupancy` | Units by current occupancy status |
| `pendingApprovals`, `activeUsers`, `invitedUsers`, `noticesThisMonth` | Counts |

## Reports

`reports.get /reports/:type` returns `{ title, subtitle, columns, rows, totals }`,
where each column has a `kind` (text, money, date or number). The admin console
renders it; `reports.email` sends it.

| Type | Params | Rows |
|---|---|---|
| `collections` | from, to (default: last 30 days) | Each successful or cancelled payment: date, receipt, unit, mode, status, amount. Totals overall and by mode. |
| `defaulters` | — | Units with an overdue balance: owner, mobile, bill count, oldest due, days overdue, outstanding |
| `bill-register` | period | Every bill in the period: number, unit, payer, dates, charges, interest, GST, total, balance, status |
| `receipt-register` | from, to | Receipts by number, with mode, reference, amount, status |
| `member-ledger` | unitId | The unit's ledger with a running balance |
| `occupancy` | — | Every unit: owner, occupancy, since, area |
| `tenant-register` | — | Active tenancies, soonest expiry first: tenant, mobile, dates, police intimation, bill payer |
| `notice-delivery` | noticeId | Proof of service: per recipient push and email status, read, acknowledged |

**Email** (`reports.email { format: xlsx|csv, …params }`):
- It needs an email on the caller's account; without one it returns
  `EMAIL_REQUIRED`, and the apps prompt the user to add one.
- It validates the parameters in the request, then queues `reports.email`.
- The attachment:
  - **Excel:** title and subtitle rows, a styled header, a frozen pane, and ₹ number formats.
  - **CSV:** UTF-8 with a BOM, so Excel opens it cleanly.

**Scheduled** (see [../server/WORKERS_AND_JOBS.md](../server/WORKERS_AND_JOBS.md)):
- **Daily, 20:00 IST:** the day's collections, to people who record payments. Skipped on days with no collections.
- **Mondays, 08:00 IST:** defaulters plus last week's collections, to administrators.

Only people with an email who haven't turned REPORT email off receive them.

## Platform console

Platform admins (`users.is_platform_admin`) are Sahaj's own staff, not
society members.

| Endpoint | Does |
|---|---|
| `platform.societies` | Lists every society, with unit and user counts |
| `platform.createSociety { name, code, type, city, firstAdmin: { name, mobile } }` | Creates the society (DRAFT), copies the default permission templates into it, and provisions the first admin with the SECRETARY template. That admin signs in and creates a password like anyone else. |

Seeding creates the platform admin login `9000000001` with no password. See
[../flows/onboarding-a-society.md](../flows/onboarding-a-society.md).

## Health

`health.live` (`GET /api/v1/health`, public) returns status, version,
uptime, and checks for database, queue, redis, push and email. It answers 503
when degraded.
