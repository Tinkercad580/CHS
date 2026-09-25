# @chs/backend

The CHS platform API — Express 5, Prisma 7 on PostgreSQL 16, Socket.io,
BullMQ. Design and rationale: `../docs/ARCHITECTURE.md`. Using and extending
the API: `../docs/API.md`.

```
../scripts/db-setup.sh        # once per machine: role, databases, .env
../scripts/api.sh             # install, migrate, seed, run with reload
npm test                      # unit + integration + compliance, real PostgreSQL (…_test database)
npm run db:migrate            # create a migration after editing prisma/schema.prisma
npm run build && npm start    # production bundle
```

```
src/
  config/env.ts          every setting, validated at start (production refuses dev secrets)
  core/
    http/                contract binding, authentication/authorization, rate limits, errors, OpenAPI
    auth/                argon2id passwords + policy, JWTs, sessions with rotation and reuse detection
    audit.ts events.ts   append-only audit trail; after-commit domain events
    realtime.ts          Socket.io gateway, server-assigned rooms
    queue.ts             BullMQ with an in-process fallback; messaging.ts (outbox)
    money.ts dates.ts numbering.ts statutory.ts tabular.ts crypto.ts
  modules/               auth · users · society · structure · members · notifications (inbox, push, email, notices) · billing · payments · reports · platform
  jobs/                  tenancy expiry, checkout expiry, daily/weekly report emails, housekeeping
prisma/
  schema/                data model, one file per area (identity, society, members, notifications, billing)
  migrations/            forward-only; *_integrity_constraints holds what Prisma can't express
  seed/                  platform defaults (statutory config) + the demo society
test/
  unit/ integration/ compliance/
```
