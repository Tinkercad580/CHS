# Sahaj — society management for Maharashtra housing societies

Sahaj is a multi-tenant SaaS for co-operative housing societies. It serves the
committee, the residents and the guards on one platform. It runs the society's
billing to Maharashtra's rules, collects dues, tells residents what they need
to know, and keeps the records a society is legally required to keep.

| | For | Does |
|---|---|---|
| **Admin console** (web) | Secretary, treasurer, committee, society manager | Users & access; members, units and tenancies; charge heads and monthly bill runs; collections and receipts; notices with proof of service; dashboard and emailed reports |
| **Resident app** (Android/iOS) | Owners, co-owners, family, tenants | Sign in; see and pay dues; bills line by line; statement and receipts; society notices; notifications; household, vehicles, tenants |
| **Gate app** (Android/iOS) | Security guards | Handset sign-in and shift unlock; vehicle plate lookup; notices from the office; emergency alerts |

## What's live

The phases are MASTER_SPEC's.

| Phase | Area | Status |
|---|---|---|
| 0–1 | Foundation, auth & access control | **Live.** Admin-provisioned logins, no OTP, lockout, temporary passwords, admin 2FA, instant session revocation, per-society permissions, a guard hard-restriction. |
| 2 | Society setup | **Live (API).** Profile, settings, go-live checklist, buildings, units (bulk and import), parking, bank accounts, billing config, statutory config. The admin screen for setup is still a mock. |
| 3 | Members & occupancy | **Live.** Owners, occupancy, tenancies, household, approvals, unit 360, directory. |
| 4 | Billing engine | **Live.** Rule 106C-12 apportionment, simple interest, GST thresholds, previewed runs, gapless numbering, immutable bills, credit notes, supplementary bills, ledger. |
| 5 | Payments | **Live with a dummy gateway.** Online checkout (test mode), signed idempotent webhooks, cash, cheque and NEFT at the desk, allocation, advances, receipt cancellation. A real gateway (Razorpay or Cashfree) plugs into the same path. |
| 6 | Notifications & notices | **Live.** Inbox, Firebase push to the resident and gate apps, SMTP email, per-category preferences, quiet hours, notices with audiences and acknowledgement. |
| 7 | Dashboards & reports | **Live.** Dashboard; eight reports emailed as Excel or CSV; daily and weekly digests. |
| 8–12 | Helpdesk, gate & visitors, accounting & recovery, compliance, documents, requests, meetings, amenities, vendors | Not built. The apps show designed screens on mock data. |
| 13 | Production hardening | Partly done: CI, Docker, backups, security headers. Still to do: VAPT, Marathi, observability, deploy pipelines. |

> **Compliance.** Billing runs on statutory values (interest cap,
> non-occupancy percent, fund minimums, GST thresholds) that are still marked
> **unverified** against primary sources. See
> [docs/compliance/RULES_REGISTER.md](docs/compliance/RULES_REGISTER.md). The
> platform assists with compliance and isn't legal advice. Societies should
> confirm with a qualified advocate or the Registrar.

## How it's built

```
web-app (React 19)  ─┐
resident-app (Expo) ─┼─ @chs/api-client ── @chs/contract ── API server (Express 5, Node 20) ── PostgreSQL 16
gate-app (Expo)     ─┘   typed client,        every endpoint   HTTP · Socket.io · job worker   Redis (optional)
                         realtime, hooks      defined once                                     Firebase · SMTP · gateway
```

- **One API contract.** Every endpoint is declared once, with its schemas,
  permission, cache invalidation and realtime events. The server binds to it,
  and the apps' typed client and React hooks derive from it. There's no
  hand-written client code, and the two sides can't drift.
- **The database enforces the invariants.** One primary owner per unit;
  published bills, the ledger and the audit log can't change; bill numbers
  have no gaps.
- **Realtime by default.** When something changes, the server tells the
  screens that show it.

| Layer | Technology |
|---|---|
| API | Node.js 20, Express 5, TypeScript (strict), zod |
| Data | PostgreSQL 16, Prisma 7 |
| Jobs & scale-out | BullMQ + Redis (in-process fallback) |
| Realtime | Socket.io (Redis adapter across instances) |
| Push | Firebase Cloud Messaging (Admin SDK on the server, React Native Firebase in the apps) |
| Email | nodemailer over any SMTP server |
| Admin console | React 19, Vite, React Router 7, TanStack Query |
| Mobile | Expo SDK 57, React Native 0.86, expo-router |
| Auth | argon2id, JWT access and rotating refresh tokens, TOTP |
| Tests | Vitest + supertest against real PostgreSQL (248 tests: unit, integration, compliance) |
| Delivery | Docker, nginx, GitHub Actions |

## Quick start

```
./scripts/db-setup.sh          # once: local PostgreSQL role + databases, backend/.env
./scripts/api.sh               # API on :4100 (docs at /api/docs), migrates and seeds the demo society
./scripts/start.sh             # admin console on :5273
./scripts/mobile-web.sh resident   # resident app preview on :8181
./scripts/mobile-web.sh gate       # gate app preview on :8182
```

Sign in to the admin console as **9820011001 / Sahaj@2026** (the demo society
Shanti Vihar CHS: 248 units, with bills for August and September 2026). All
the demo accounts are listed in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
Push and email need Firebase and SMTP credentials; see
[docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md). Until they're set, both run in log mode.

## Repository

| Path | What |
|---|---|
| [backend/](backend) | The API server, database schema and migrations, jobs, tests |
| [packages/contract/](packages/contract) | Every endpoint, schema, permission, error code and realtime event |
| [packages/api-client/](packages/api-client) | Typed client, session state machine, realtime, React hooks |
| [web-app/](web-app) | Admin console |
| [mobile-app/](mobile-app) | Resident and gate apps, and their shared UI (`@sahaj/shared`) |
| [infra/](infra) | Dockerfiles, nginx, backup, restore-drill and migrate scripts |
| [scripts/](scripts) | The local development loop |
| [docs/](docs) | All documentation |
| [MASTER_SPEC.md](MASTER_SPEC.md) | The product specification |
| [project/](project), [chats/](chats) | The original UI design handoff ([docs/design-handoff.md](docs/design-handoff.md)) |

## Documentation

**[docs/README.md](docs/README.md)** is the index. The key documents:
- [Architecture](docs/ARCHITECTURE.md)
- [Local development](docs/DEVELOPMENT.md)
- [API conventions](docs/API.md) and [every endpoint](docs/api/ENDPOINTS.md)
- [Database](docs/DATABASE.md) and [every table](docs/database/TABLES.md)
- [Server](docs/server/SERVER.md), [jobs](docs/server/WORKERS_AND_JOBS.md) and [realtime](docs/server/REALTIME.md)
- [Security](docs/SECURITY.md) and [infrastructure](docs/INFRASTRUCTURE.md)
- Modules: [auth](docs/modules/auth.md), [users & access](docs/modules/users-and-access.md), [society & structure](docs/modules/society-and-structure.md), [members](docs/modules/members.md), [notices & notifications](docs/modules/notices-and-notifications.md), [billing](docs/modules/billing.md), [payments](docs/modules/payments.md), [reports & platform](docs/modules/reports-and-platform.md)
- [End-to-end flows](docs/flows/)
- Apps: [admin](docs/apps/admin-web.md), [resident](docs/apps/resident-app.md), [gate](docs/apps/gate-app.md)
