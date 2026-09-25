# Infrastructure and deployment

## Components

```
                 ┌──────────── web (nginx) ─────────────┐
 browser ───────►│ admin console static files           │
                 │ /api/*      ─┐                        │
                 │ /realtime/* ─┼──► api (Node) ×N ──┬──► PostgreSQL 16
                 └──────────────┘        │  │        └──► Redis (BullMQ + Socket.io adapter)
 resident / gate apps ──── HTTPS + WSS ──┘  │
                                            ├──► Firebase Cloud Messaging (push)
                                            ├──► SMTP server (email)
                                            └──► payment gateway (dummy today)
```

| Piece | Image / source | Notes |
|---|---|---|
| API | [infra/docker/Dockerfile.api](../infra/docker/Dockerfile.api) | Multi-stage build. Runtime has production dependencies only, runs as the `node` user with `tini` as PID 1. Runs `prisma migrate deploy` before starting. Healthcheck on `/api/v1/health`. |
| Admin console | [infra/docker/Dockerfile.web](../infra/docker/Dockerfile.web) | Vite build served by nginx 1.27 |
| nginx | [infra/docker/nginx.conf](../infra/docker/nginx.conf) | Serves the SPA; proxies `/api` and `/realtime` (with websocket upgrade) to the API, so production is one origin. Assets are cached immutably and `index.html` is never cached. Security headers. 10 MB body limit. |
| PostgreSQL | managed, or `postgres:16-alpine` | Required |
| Redis | managed, or `redis:7-alpine` (AOF on) | Optional for one instance; required for several (shared jobs and realtime) |

## Running everything in containers

```
cp .env.example .env         # fill in POSTGRES_PASSWORD and the secrets (openssl rand -base64 48)
docker compose up -d --build
open http://localhost:8080
```

[docker-compose.yml](../docker-compose.yml) runs postgres, redis, the API and the web container.
`./secrets` is mounted read-only into the API container at `/run/secrets`,
which is where the Firebase service account goes. Push and email stay in log
mode until you set `PUSH_PROVIDER`, `MAIL_PROVIDER` and the SMTP variables in
`.env`.

> **Not yet verified:** the Docker images and the compose file were written
> without Docker available on the development machine. The CI workflow builds
> both images, and its first run is the check.

## Environments

local → dev → staging → production (MASTER_SPEC E6).

| | Local | Production |
|---|---|---|
| Database | the machine's PostgreSQL (`scripts/db-setup.sh`) | managed PostgreSQL, India region |
| Redis | none (in-process jobs) | managed Redis |
| Push / email | `log` | `fcm` / `smtp` |
| Secrets | generated into `backend/.env` | the platform's secret store; never in images |
| Docs UI | `/api/docs` | off |

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on every push to `main` and every PR:

| Job | Steps |
|---|---|
| API · contract · client | `npm ci` → Prisma generate → typecheck (all workspaces) → lint + layering rules → tests against a PostgreSQL service (unit, integration, compliance) → build |
| Admin console | install → `tsc -b` → oxlint → `vite build` |
| Mobile apps | install → typecheck shared, resident, gate |
| Docker images | build both images (no push) |

The compliance tests are a required gate (MASTER_SPEC E4).

## Deploying the API

1. Build the image with `--build-arg APP_VERSION=<git sha>`.
2. Provide the environment: see [server/SERVER.md](server/SERVER.md#configuration-reference).
   Production requires `JWT_ACCESS_SECRET`, `JWT_RESTRICTED_SECRET`,
   `DATA_ENCRYPTION_KEY` and `PAYMENT_WEBHOOK_SECRET`.
3. Start it. Migrations run first; if they fail, the container exits and
   nothing serves on a half-migrated schema.
4. Put at least one instance behind the load balancer with `RUN_JOBS=true`.
   Scale HTTP with more instances, which also need `REDIS_URL`.
5. Use `/api/v1/health` for the load balancer's health check. It answers 503
   when degraded.

For a shared or multi-instance deployment, set `TRUST_PROXY` to the number
of proxies in front, so client IPs, and therefore rate limits and audit
logs, are right.

## Backups and restore (MASTER_SPEC E5)

- [infra/scripts/backup.sh](../infra/scripts/backup.sh): `pg_dump -Fc`, encrypted with
  AES-256 using a passphrase file, SHA-256 sidecar, 35-day retention. Run it
  daily and ship the directory off-site (India region).
- [infra/scripts/restore-drill.sh](../infra/scripts/restore-drill.sh): restores a backup
  into a database whose name must contain drill, restore or scratch. It then
  checks migrations and row counts and prints the elapsed time as the RTO.
  Run it quarterly.
- [infra/scripts/migrate.sh](../infra/scripts/migrate.sh): the pre-deploy migration step on its own.

Targets are RPO 1 hour (add WAL archiving or managed point-in-time recovery
for that; daily dumps alone give 24 hours) and RTO 4 hours.

## Mobile releases

The apps are Expo prebuild projects. Push needs a native build with the
Firebase config files; see [NOTIFICATIONS.md](NOTIFICATIONS.md). Store identifiers are
set in each app's `app.config.ts`: `in.sahaj.resident` and `in.sahaj.gate` by
default. Choose them before the first release.

## What isn't set up yet

- Terraform or any infrastructure-as-code.
- Staging and production deploy workflows. CI builds, but doesn't deploy.
- Sentry or other error tracking.
- Uptime monitoring and job dashboards.
- WAL archiving.
- EAS build profiles for the mobile apps.
