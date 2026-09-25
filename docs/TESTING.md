# Testing

```
npm test                         # all backend tests (repo root)
npm run test:watch -w backend    # watch mode
./scripts/check.sh               # typecheck + lint + layering rules for everything
```

## Backend tests

The tests are in [backend/test/](../backend/test) and use Vitest with supertest. They
run against a **real PostgreSQL database**, never mocks, so constraints,
triggers, transactions and queries behave exactly as in production.

- **Database:** the test database is `TEST_DATABASE_URL`, or `DATABASE_URL`
  with the name suffixed `_test`. The suite refuses to run against a database
  whose name doesn't end in `_test`, because it's wiped.
- **Global setup** applies migrations once per run.
- **Each file** calls `resetDb()`, which truncates every table and restores the
  platform statutory defaults. Files run one at a time.
- **Environment:** tests run with `NODE_ENV=test`, jobs off, push, email and
  messaging in log/none mode, and rate limits off. Send `x-test-rate-limit: on` to test them.

| Folder | What it covers |
|---|---|
| `unit/core.test.ts` | money rounding and formatting, TOTP RFC vectors, field encryption, temp-password alphabet, FY labels, numbering format, contract integrity (unique ids, invalidations and events point at real endpoints, OpenAPI covers everything) |
| `unit/billing-domain.test.ts` | one test per apportionment method, family-occupied non-occupancy, lift-less building, fund minimums, non-occupancy cap, interest integration and simple-not-compound, rounding, quiet hours |
| `integration/members.test.ts` | memberships, the DB-level primary-owner rule, tenancy → occupancy → suspension, approvals, household, gate plate lookup, bulk units, CSV imports |
| `integration/billing.test.ts` | charge-head rules, runs (preview, publish, gapless numbers), immutability triggers, no rates into billed periods, historical reproducibility, dummy checkout, webhook signature and idempotency, cheques, receipt cancellation, interest, advances, credit notes, dashboard, reports, bill filters |
| `integration/notifications.test.ts` | device registration, mandatory preferences, notice audiences, push/email per preferences, acknowledgement, proof of service, immutability and correction, inbox |
| `integration/realtime.test.ts` | socket auth, events after commit only, isolation between societies, revocation disconnects |
| `compliance/auth.test.ts` | MASTER_SPEC E4 item 8: no self-signup, policy, reuse, lockout, temporary passwords (single use, 24 h, forced change), refresh reuse detection, instant revocation, admin 2FA |
| `compliance/authorization.test.ts` | permissions, the guard surface restriction, grant rules, suspension, audit log contents and append-only, idempotency, gate sign-in limited to guards, guards and financial data |
| `compliance/statutory.test.ts` | E4 item 4: the interest cap and resolution requirement, effective-dated resolution, override bounds, go-live gate, masking, format validation |
| `compliance/tenancy-isolation.test.ts` | E4 item 5: every society endpoint refuses another society's admin |

The helpers in [test/helpers.ts](../backend/test/helpers.ts) are:
- `makeSociety()` creates a society with an admin and units;
- `addUser()` adds a user from a template;
- `login()` signs in;
- `call(endpoint, input, token)` calls through the contract, exactly as clients do.

## Writing a test

- Use `call(api.area.thing, { params, query, body }, token)`, not raw URLs. The
  contract's typing then catches drift.
- Assert on `body.error.code`, not on messages.
- For money, assert exact paise with `bigint`, and compute expected values with
  the same `core/money` helpers the engine uses.
- Dates should be relative to today (`day(-30)`) wherever "current" matters,
  so tests don't age.
- Background delivery is asynchronous, so poll for the state change (see
  `settle()` in the notifications test).

## Frontend

The apps have no automated UI tests yet. They're checked by typecheck and
lint (`./scripts/check.sh web|mobile`), and by browser flows driven with
Playwright during development. Adding Vitest + React Testing Library to the
web app, and Jest + React Native Testing Library to the mobile apps, is next
(MASTER_SPEC E4).
