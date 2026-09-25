# Architecture

How the CHS platform is put together, and why. Read this before changing the
backend or how the apps talk to it. `MASTER_SPEC.md` is the product; this is
the machine.

## The shape of the repo

```
packages/contract     @chs/contract   — every API endpoint, once. Zod schemas, access rule,
                                        cache invalidation, realtime events. No runtime deps but zod.
packages/api-client   @chs/api-client — typed client derived from the contract: fetch with token
                                        refresh, realtime socket, sign-in state machine, React hooks.
backend               @chs/backend    — Express 5 + Prisma 7 (PostgreSQL 16) + Socket.io + BullMQ.
web-app                               — admin console (Vite + React 19).
mobile-app                            — resident and gate apps (Expo 57), their own npm workspace.
infra                                 — Dockerfiles, nginx, ops scripts (backup, restore drill, migrate).
scripts                               — the local dev loop (api.sh, db-setup.sh, start.sh, mobile-web.sh, check.sh).
```

The repo root is an npm workspace for `backend` and `packages/*`. The web and
mobile apps keep their own installs (the mobile one has pinned overrides that
must not be disturbed) and link the two packages with `file:` dependencies.
Vite (`resolve.dedupe`) and Metro (`resolveRequest` in each `metro.config.js`)
are configured so a linked package always uses the app's single copy of React,
React Query and zod.

## Contract first: all APIs in one place

`packages/contract/src/endpoints.ts` is the API. Each entry declares:

| field | meaning |
|---|---|
| `method`, `path` | relative to `/api/v1`; `:param` segments are typed |
| `access` | `public` · `authenticated` · `society` (+ permission(s)) · `platform` |
| `query`, `body`, `response` | zod schemas — validation on the server, types on the client |
| `surface` | `gate` · `resident` · `admin` · `common`; guards are refused off `gate`/`common` |
| `invalidates` | which cached reads go stale when this succeeds |
| `idempotent` | honour an `Idempotency-Key` header |
| `rateLimit` | stricter bucket for auth and sensitive calls |

From that one object:

- **The server** binds a handler to each entry (`handle(api.users.list, …)`).
  The binding does authentication, the society/permission/surface check,
  zod validation of params, query and body, idempotency, the response
  envelope, and parses the handler's return value through the response
  schema — which also strips any field the contract doesn't declare, so a
  handler can't leak a column by returning a raw row. `mountApi` refuses to
  start if any contract endpoint has no handler.
- **The client** gets `api.users.list({ params, query })`, fully typed, with no
  generated code.
- **React** gets `useApiQuery(api.users.list, input)` and
  `useApiMutation(api.users.create)`; on success a mutation invalidates the
  reads its entry names.
- **OpenAPI 3.1** is generated from it at `/api/v1/openapi.json`, with a
  browsable reference at `/api/docs` outside production.
- **Tests** walk it: the cross-tenant test calls every society endpoint.

See `docs/API.md` for adding an endpoint and for the wire conventions.

## A request, end to end

```
x-request-id → pino-http log → helmet → CORS → compression → JSON body (8 MB)
  → rate limit (per IP, per bucket)
  → authenticate    access JWT → live session? token version matches? password change pending?
  → authorize       platform admin? / society membership, not suspended, society not suspended,
                    GUARD surface rule, permission from the endpoint (records which one was used)
  → validate        params (…Id must be a UUID → else 404), query, body (zod)
  → idempotency     replay a stored response for a repeated key
  → handler         runs inside AsyncLocalStorage context (actor, society, request id, IP)
  → response        parsed through the response schema, wrapped { data, meta: { requestId } }
  → events          published only after the handler succeeded (after commit)
errors → { error: { code, message, details, requestId } } with a fixed status per code
```

Layering inside the backend (checked by `scripts/check-boundaries.mjs` in CI):
`modules/*/…routes.ts` (binding, thin) → `…service.ts` (rules, transactions,
audit, events) → Prisma. Shared machinery is in `core/`. Money arithmetic
only in `core/money.ts`; raw SQL only in `core/`.

## Authentication (MASTER_SPEC A2)

Admin-provisioned, password-based, no OTP, no self-signup.

- **Lookup** decides the next screen: create password / enter password / not
  registered / locked.
- **Passwords**: argon2id (19 MiB, t=2), policy (8+, letter and digit, not the
  mobile, not a common password, not one of the last three).
- **Lockout**: 5 failures → 15 minutes, per account in the database (holds
  across instances); 10 failures per IP per hour → throttled.
- **Sessions**: 15-minute access JWT + 30-day refresh token, stored hashed,
  rotated on every use. Replaying a rotated-out refresh token revokes the
  session (reuse detection). Every request checks the session is live and
  the user's token version matches, so logout, suspension and password
  changes take effect on the next request — not when the JWT lapses.
- **Temporary passwords**: 10 characters without look-alikes, argon2id-hashed,
  single use, 24 hours, superseded by a newer one. Logging in with one yields
  a *restricted* token signed with a separate key that opens only the forced
  change. An admin can't reset the login of someone who administers another
  society they don't. The plain value is shown to the admin once, sent to
  the user once, never stored and deliberately not idempotent (a replay would
  require storing it).
- **Admin TOTP**: optional, RFC 6238, secret AES-256-GCM encrypted at rest.
- Every auth event is recorded (`auth_events`) with IP and user agent.

Known trade-off, inherited from the spec: a registered number that hasn't set
a password yet can be activated by whoever types it first. Mitigation in
place: activation is announced in realtime to the society's admins and
recorded; the admin sees the account flip from INVITED to ACTIVE. A stricter
option (an activation code handed over by the office) is a small change if
you want it.

## Access control (MASTER_SPEC A1)

Two roles, `ADMIN` and `USER`, per society membership (`society_users`). What
anyone can do is the set of permission strings on that membership; `user_type`
is a label. Rules enforced in the users service:

- a USER can't hold admin permissions;
- you can only grant permissions you hold yourself;
- you can't change your own role or permissions, or suspend yourself;
- the last admin who can manage users can't be removed.

Guards are restricted by *surface*, not only permission: a GUARD token is
refused on any endpoint not marked `gate` or `common`, whatever was toggled.

## Multi-tenancy

`society_id` on every business table. Society endpoints carry `:societyId`;
the binding resolves the caller's membership there before the handler runs,
and every service query filters by the scope's society id (ids from another
society are "not found" even inside your own path). The isolation test walks
every society endpoint in the contract with another society's admin token.

## Data rules the database enforces itself

`prisma/migrations/*_integrity_constraints`: one current primary owner per
unit, one open occupancy and one open tenancy per unit, unique live plate per
society, date-order CHECKs, nominee share bounds, mobile format, and an
append-only trigger on `audit_logs` (UPDATE/DELETE raise). These hold even
for a script or a console session that bypasses the API.

## Realtime

Socket.io at `/realtime`. The handshake carries the access token; the server
joins the socket to `user:<id>`, `session:<id>`, `society:<id>`,
`society:<id>:admins` and `unit:<id>` rooms from the database — clients never
choose rooms. Services raise typed events (`packages/contract/src/events.ts`);
each event lists the reads it invalidates, and the client's `ApiProvider`
refetches exactly those. Revoking a session pushes `session.revoked` and
disconnects its sockets. With `REDIS_URL` the Redis adapter fans events out
across instances.

## Jobs

`core/queue.ts`: BullMQ when `REDIS_URL` is set (durable, retried with
exponential backoff, repeatable jobs scheduled once cluster-wide), otherwise
the same handlers in-process with the same retry policy. Jobs are idempotent.
Today: outbound message delivery, tenancy expiry reminders and auto-suspend
(C3), housekeeping. Outbound SMS/WhatsApp/email go through
`outbound_messages` first; providers are ports (`log` adapter in development).

## Money, dates, numbering, statutory values

- Money is integer paise: `BIGINT` in PostgreSQL, a JSON integer on the wire,
  `bigint` in the backend; conversion only at `core/money.ts`.
- Calendar dates are `date` columns, `YYYY-MM-DD` on the wire, UTC-midnight
  in memory; instants are `timestamptz`.
- Gapless per-FY numbering (`core/numbering.ts`) increments under a row lock
  inside the caller's transaction.
- Statutory numbers come from `statutory_config`, effective-dated, platform
  default with society overrides bounded by rule (a cap can't be raised, a
  minimum can't be lowered, some need a general body resolution). Resolved
  as of a date — billing will ask as of the billing period. Every seeded
  value is marked unverified until the compliance research pass (B1).

## Testing

`backend/test`: `unit/`, `integration/`, `compliance/` (the release gate from
MASTER_SPEC E4). Tests run against a real PostgreSQL database (never mocks),
the `…_test` database, wiped per file. Compliance coverage today: auth (items
8), interest cap (4), cross-tenant isolation (5), immutability of the audit
log (6, partially — bills and receipts arrive with billing).

## Deployment

- `infra/docker/Dockerfile.api` — multi-stage; migrations (`prisma migrate
  deploy`, forward only) run before the server starts; tini as PID 1;
  healthcheck on `/api/v1/health` (503 when degraded).
- `infra/docker/Dockerfile.web` — static build behind nginx, which proxies
  `/api` and `/realtime` so production is one origin.
- `docker-compose.yml` — PostgreSQL, Redis, API, web.
- `.github/workflows/ci.yml` — typecheck, lint + layering, tests against a
  PostgreSQL service, build, image builds.
- `infra/scripts/backup.sh` / `restore-drill.sh` — encrypted dumps, 35-day
  retention, verified restores into a scratch database.

The process shuts down gracefully on SIGTERM (drains HTTP, closes sockets,
queue and pool) and validates its whole environment at start.
