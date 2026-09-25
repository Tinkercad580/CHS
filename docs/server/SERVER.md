# The API server

`backend/` is one Node.js process: an Express 5 HTTP API, a Socket.io
realtime gateway on the same port, and a job worker. In production you can
run several identical instances behind a load balancer. With `REDIS_URL` set,
jobs and realtime events are shared across them.

- Entry point: [backend/src/server.ts](../../backend/src/server.ts)
- App assembly: [backend/src/app.ts](../../backend/src/app.ts)
- Configuration: [backend/src/config/env.ts](../../backend/src/config/env.ts)

## Start-up and shutdown

1. **Environment.** `config/env.ts` validates every variable with zod. If a
   value is missing or malformed, the process exits with a message that names
   it. Production refuses to start without real secrets.
2. **Database.** A `SELECT 1` runs before the server listens, so a bad
   `DATABASE_URL` fails fast.
3. **HTTP and realtime.** `createApp()` builds the Express app. `startRealtime()` attaches
   Socket.io to the same HTTP server.
4. **Queue.** `startQueue()` connects BullMQ when `REDIS_URL` is set, and falls
   back to in-process jobs otherwise. `scheduleJobs()` registers the repeating
   jobs, unless `RUN_JOBS=false`. Set that on instances that should only serve HTTP.
5. **Listen.** The server listens on `HOST:PORT`, with keep-alive set longer
   than common load-balancer idle timeouts.

On `SIGTERM` or `SIGINT` the server shuts down in this order: stop accepting
connections, drain HTTP, close sockets, close the queue, disconnect Prisma.
If shutdown takes longer than 15 seconds, the process is forced to exit.

## The request pipeline

The middleware chain, in order, from `app.ts`:

| Step | What it does |
|---|---|
| Request id | Uses the client's `x-request-id` if it looks valid, else a UUID. Echoed in the response and in every log line. |
| `pino-http` | One structured log line per request (method, url, status, time). Health checks aren't logged. |
| `helmet` | Security headers: CSP, HSTS, no-sniff, frame-deny… |
| CORS | Origins from `CORS_ORIGINS`. Any localhost origin is allowed outside production. |
| `compression` | Compresses responses. |
| `express.json` | Parses bodies up to 8 MB (imports arrive as base64). Keeps the raw body for `/webhooks/*` so signatures can be checked. |
| `/api/v1/openapi.json` | The OpenAPI 3.1 document, built from the contract. |
| `/api/docs` | A browsable API reference (Scalar). Not in production. |
| `/api/v1/*` | `mountApi(bindings)`: every contract endpoint (below). |
| 404, error handler | Unknown path → `NOT_FOUND`; every error → the error envelope. |

Each contract endpoint then runs this binding, from [core/http/bind.ts](../../backend/src/core/http/bind.ts):

```
rate limit (bucket: default | auth | sensitive)
  → authenticate    Bearer access token → session is live, token version matches,
                    no password change pending (or a restricted token on an endpoint that allows it)
  → platform check  platform-admin endpoints only
  → params          every ":…Id" must be a UUID (else 404)
  → society         membership in :societyId exists, isn't suspended, the society isn't suspended,
                    GUARD surface rule, the endpoint's permission (records which permission was used)
  → validate        query and body through the endpoint's zod schemas
  → idempotency     a repeated Idempotency-Key replays the stored response
  → handler         runs inside an AsyncLocalStorage context (actor, society, IP, request id)
  → response        parsed through the response schema (drops undeclared fields), wrapped as { data, meta }
  → after success   publish buffered realtime events, start after-commit tasks (notifications)
```

If the handler throws, buffered events and after-commit tasks are dropped.
A rolled-back change never notifies anyone.

At startup `mountApi` refuses to run if a contract endpoint has no handler,
or if an endpoint is bound twice. Routes are registered with static path
segments before parameter segments, so `/units/bulk` is matched before
`/units/:unitId`.

### Handlers

A handler is one line in a module's `*.routes.ts`:

```ts
handle(api.billing.createRun, ({ body }, { society, actor }) => bills.createRun(society, actor.userId, body)),
```

`society` is the caller's `SocietyScope`: society id, role, user type,
permission set and access unit. `actor` is the user and session. Both throw
if used on an endpoint whose access kind doesn't provide them.

## Errors

A service throws `new AppError(code, message, details?)` from
[core/errors.ts](../../backend/src/core/errors.ts). Each code has a fixed HTTP status,
defined in [packages/contract/src/errors.ts](../../packages/contract/src/errors.ts). The error
handler in [core/http/error-handler.ts](../../backend/src/core/http/error-handler.ts) also maps:

| From | To |
|---|---|
| `ZodError` | `VALIDATION_FAILED` (400), with a list of issues (`path`, `message`) |
| Prisma P2025 | `NOT_FOUND` |
| Prisma P2002 (unique violation) | `CONFLICT` |
| Prisma P2003 (foreign key) | `CONFLICT` |
| Body too large / invalid JSON | `BAD_REQUEST` |
| Anything else | `INTERNAL` (500): logged with its stack, and a generic message sent to the client |

Messages are written for the person using the app. Clients show them
as-is and branch on `code`.

## Logging

[core/logger.ts](../../backend/src/core/logger.ts) uses pino. Logs are JSON in production and pretty-printed in
development. Credential-shaped fields are redacted wherever they appear
(`password`, `refreshToken`, `accessToken`, `tempPassword`, `totpSecret`,
the authorization header, cookies). Failures of 5xx are logged at error level,
refused requests at info, and 401/404 aren't logged.

## Rate limits

[core/http/rate-limit.ts](../../backend/src/core/http/rate-limit.ts) keeps fixed-window counters per IP and
bucket, in memory on each instance:

| Bucket | Window | Max | Used by |
|---|---|---|---|
| default | 1 min | 300 | everything else |
| auth | 15 min | 50 | lookup, activate, login, 2FA verify |
| sensitive | 15 min | 30 | refresh, forced change, password change, temp password, test notification, report email |

The account lockout and the per-IP login throttle are separate, and they
live in the database, so they hold across instances. See
[../SECURITY.md](../SECURITY.md).

## Configuration reference

Every variable, from [config/env.ts](../../backend/src/config/env.ts).

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | development | `production` enforces real secrets and hides `/api/docs` |
| `PORT`, `HOST` | 4100, 0.0.0.0 | Listen address |
| `APP_VERSION` | package version | Reported by `/health` |
| `CORS_ORIGINS` | the three dev ports | Comma-separated allowed origins |
| `TRUST_PROXY` | 0 | Proxy hops to trust for the client IP (1 behind nginx) |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `DATABASE_POOL_MAX` | 10 | Connections per instance |
| `REDIS_URL` | — | Enables BullMQ and the Socket.io Redis adapter |
| `JWT_ACCESS_SECRET` | dev value | Signs access tokens (required in production) |
| `JWT_RESTRICTED_SECRET` | dev value | Signs password-change and 2FA-challenge tokens (required in production) |
| `DATA_ENCRYPTION_KEY` | dev value | AES-256-GCM key for secrets at rest, such as TOTP seeds (required in production) |
| `ACCESS_TOKEN_TTL_SECONDS` | 900 | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | 30 | Refresh token lifetime (rotated on every use) |
| `LOGIN_IP_FAILURES_PER_HOUR` | 10 | Per-IP failed sign-ins before that IP is throttled |
| `LOG_LEVEL` | info | pino level |
| `RUN_JOBS` | true | Register repeating jobs on this instance |
| `MESSAGING_PROVIDER` | log | SMS/WhatsApp adapter (`log`, `none`); no live provider yet |
| `PUSH_PROVIDER` | log | `fcm` sends push; `log` only records it |
| `FIREBASE_SERVICE_ACCOUNT_FILE` | — | Service-account JSON for FCM (or the three variables below) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | — | Service account as separate variables |
| `MAIL_PROVIDER` | log | `smtp` sends email; `log` renders and logs it |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | —, 587, false | SMTP server |
| `MAIL_FROM` | `Sahaj <no-reply@localhost>` | From address |
| `PUBLIC_WEB_URL` | http://localhost:5273 | Base for links in emails |
| `PAYMENT_GATEWAY` | dummy | Payment gateway adapter |
| `PAYMENT_WEBHOOK_SECRET` | dev value | HMAC key for gateway webhooks (required in production) |

`GET /api/v1/health` returns `status` plus a check for each of database,
queue, redis, push and email (`ok` / `down` / `disabled`). When the status is
degraded it answers 503, so a load balancer takes the instance out of rotation.

## Code layout

```
backend/src/
  server.ts, app.ts
  config/env.ts
  core/                 shared machinery, no business rules
    http/               bind (contract → Express), authenticate, rate-limit, error-handler, openapi
    auth/               password (argon2id + policy), tokens (JWT), sessions (rotation, revocation)
    context.ts          AsyncLocalStorage request context, afterCommit()
    db.ts               Prisma client, transaction(), unique-violation helper
    audit.ts            append-only audit rows
    events.ts           in-process event bus (after-commit publishing)
    realtime.ts         Socket.io gateway
    queue.ts            BullMQ / in-process jobs
    push.ts, mail.ts, messaging.ts   FCM, SMTP, SMS/WhatsApp outbox
    money.ts, dates.ts, numbering.ts, statutory.ts, pagination.ts, tabular.ts, crypto.ts
  modules/<area>/       *.routes.ts (bindings) → *.service.ts (rules) → Prisma
  modules/billing/domain/  pure billing rules (no database)
  jobs/index.ts         repeating job schedule
  scripts/gen-docs.ts   regenerates docs/api and docs/database references
```

The layering rules are checked by
[scripts/check-boundaries.mjs](../../scripts/check-boundaries.mjs), which runs in CI:
- domain code imports no database or Express;
- route files don't write to the database;
- money arithmetic stays in `core/money.ts`;
- raw SQL stays in `core/`;
- billing code contains no statutory literals;
- the contract depends only on zod.
