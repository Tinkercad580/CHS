# Database

PostgreSQL 16, accessed through Prisma 7 with the `pg` driver adapter.

- Every table and column: [database/TABLES.md](database/TABLES.md) (generated)
- Schema, one file per area: [backend/prisma/schema/](../backend/prisma/schema)
- Migrations: [backend/prisma/migrations/](../backend/prisma/migrations)

## Conventions (MASTER_SPEC E2)

| Rule | How |
|---|---|
| Keys | UUID v7 (`@default(uuid(7))`). Time-ordered, so inserts stay index-friendly and cursors sort sensibly. |
| Tenancy | `society_id` on every business table, indexed with the columns it's queried by. Every query filters by it. |
| Money | `BIGINT` paise, never floats. A JSON integer on the wire. Converted only in `core/money.ts`. |
| Rates | `NUMERIC(18,4)` for charge rates (paise per sq ft can be fractional). Basis points for percentages. |
| Dates | `date` for calendar dates (bill dates, tenancy dates, effective dates); `timestamptz(3)` for instants, stored in UTC. |
| Timestamps | `created_at`, and `updated_at` wherever a row changes. |
| Soft delete | `deleted_at` on people, household records, society users and buildings. Members, units and financial records are never hard-deleted. |
| Effective dating | `statutory_config`, `charge_rates`, `occupancies`, `memberships` (admission/cessation), `tenancies`, `unit_charges`: history is kept, never overwritten. |
| Naming | snake_case tables and columns (`@@map`/`@map`), camelCase in TypeScript. |

## The data model by area

```
Identity & access    users ─┬─ society_users ── permission_templates
                            ├─ sessions, password_history, temp_passwords, auth_events
                            └─ device_tokens, notifications, notification_preferences
                     login_attempts, audit_logs, idempotency_keys, outbound_messages

Society & structure  societies ─┬─ buildings ── units ── parking_slots
                                ├─ bank_accounts, billing_configs, numbering_series
                                └─ statutory_config (society overrides; NULL society = platform default)
                     import_jobs

Members              persons ─┬─ memberships ── nominees
                              └─ tenancies
                     units ─┬─ occupancies, family_members, vehicles, pets
                            └─ member_approvals

Notices              notices ── notice_recipients        notifications ── notification_deliveries

Billing              charge_heads ── charge_rates;  unit_charges
                     bill_runs ── bills ── bill_lines;   ledger_entries;  credit_notes

Payments             payments ─┬─ receipts
                               └─ allocations (→ bills);   gateway_events
```

Key relationships:
- A **user** is a login: one row per mobile number, across all societies.
  A **society_user** is that login's access to one society, carrying the
  role, user type, permissions and access unit.
- A **person** is someone the society records: an owner, tenant or nominee,
  with or without a login (`persons.user_id` links them). **Memberships**
  (owners) and **tenancies** hang off persons. That's how the platform knows
  which units a login acts for.
- **Occupancy** is effective-dated per unit, and it drives the
  non-occupancy charge. The current row is the one with `effective_to IS NULL`.
- A **bill** belongs to a unit, and to a run when it's a regular bill.
  **Bill lines** carry how each amount was computed. **Allocations** record
  which part of each payment settled which bill, split into interest,
  principal or advance. A bill's paid columns are the sum of its allocations.
- **Ledger entries** are the unit's statement: bill debits, payment and
  credit-note credits, and reversals.

## Rules the database enforces itself

Some rules live in the database, so no code path can break them: not a bug,
not a script, not a console session. They're in hand-written migrations,
because Prisma can't express them:

| Rule | Where |
|---|---|
| One current primary owner per unit | partial unique index `memberships_one_primary_per_unit` |
| One open occupancy row, one open tenancy per unit | `occupancies_one_open_per_unit`, `tenancies_one_open_per_unit` |
| A plate registered once per society | `vehicles_plate_per_society` |
| One person record per mobile per society | `persons_mobile_per_society` |
| Date order (effective_to > effective_from, end > start, cessation ≥ admission) | CHECK constraints |
| Nominee shares 1–10000 bps; interest ≥ 0; generation/due day 1–28; mobile format | CHECK constraints |
| Audit log is append-only | trigger `audit_logs_append_only` |
| One live bill run per society per period | `bill_runs_one_live_per_period` |
| Bill and credit-note numbers unique per society | partial unique indexes |
| Paid amounts within a bill's bounds; positive payments and receipts; ledger rows one-sided | CHECK constraints |
| A published bill's amounts, number, unit and dates never change; its lines never change | triggers `bills_immutable_once_published`, `bill_lines_immutable_once_published` |
| Ledger is append-only | trigger `ledger_entries_append_only` |

Services also check these rules, so the user gets a friendly error. The
database is the backstop. `prisma migrate diff` confirms Prisma doesn't try
to drop these objects.

## Gapless numbers

Bills, receipts and credit notes are numbered per society, per series, per
financial year, with no gaps. `core/numbering.ts` increments
`numbering_series` under a row lock, inside the same transaction that uses the
number. If that transaction rolls back, the increment rolls back too.
Formats come from `billing_configs` (`{CODE}/{FY}/{SEQ}`).

## Statutory configuration

`statutory_config` holds every legal number: interest cap, non-occupancy
percent, fund minimums, GST thresholds, notice periods, and so on. Each value is
effective-dated, with its source, citation and verification date. A row with
`society_id` NULL is the platform default; a society row overrides it from its
date, within the bounds `core/statutory.ts` allows. Code resolves values as
of a date, and billing resolves them as of the billing period.
See [compliance/RULES_REGISTER.md](compliance/RULES_REGISTER.md).

## Migrations

- **Forward only.** Never edit an applied migration; add a new one.
- **Creating one:** edit `prisma/schema/*.prisma`, then run `npm run db:migrate -w backend -- --name <what>`.
  For something Prisma can't express, add a hand-written `migration.sql` in a
  new timestamped folder, named so it sorts after the tables it touches.
- **Applying:** `npm run db:deploy -w backend`. The API Docker image runs this before
  the server starts, and so do `infra/scripts/migrate.sh` and `scripts/api.sh`.
- **Checking for drift:** `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script`
  should print an empty migration.

## Seed data

`npm run db:seed -w backend` ([prisma/seed/index.ts](../backend/prisma/seed/index.ts)):
- **Platform defaults** (safe to run anytime): statutory config (all marked
  unverified) and the platform admin login (9000000001, no password).
- **Demo society** (refused when `NODE_ENV=production`): Shanti Vihar CHS, with:
  - 4 buildings and 248 units;
  - owners, tenants, household members, parking and vehicles;
  - a bank account and billing config;
  - 8 charge heads that follow Rule 106C-12;
  - bills for August and September 2026, with most of August paid;
  - three notices;
  - the demo logins listed in [DEVELOPMENT.md](DEVELOPMENT.md).

  It's built through the real services, so the data is exactly what the product produces.

`-- --base` seeds the platform defaults only.

## Backups

`infra/scripts/backup.sh` writes an encrypted `pg_dump` and keeps 35 days.
`restore-drill.sh` restores into a scratch database and checks it. See
[INFRASTRUCTURE.md](INFRASTRUCTURE.md).
