# Local development

## Prerequisites

- Node.js 20.19 or newer, and npm 10.
- PostgreSQL 16 on the machine. On WSL/Ubuntu it's usually already installed,
  and `db-setup.sh` starts it.
- Optional: Redis, only to try BullMQ and multi-instance realtime locally.
- Optional: Android Studio or Xcode, for native mobile builds (push needs one).

## First time

```
./scripts/db-setup.sh        # starts PostgreSQL, creates role chs_app + databases chs_app / chs_app_test, writes backend/.env
./scripts/api.sh             # installs, migrates, seeds the demo society, runs the API with reload
```

`db-setup.sh` asks for your sudo password once, through sudo itself. It
touches no other database, and it refuses to reset a `chs_app` role it didn't
create.

## Every day

Run each in its own terminal:

| Command | What | URL |
|---|---|---|
| `./scripts/api.sh` | API with reload on save | http://localhost:4100/api/v1 · docs http://localhost:4100/api/docs |
| `./scripts/start.sh` | Admin console (proxies `/api` to the API) | http://localhost:5273 |
| `./scripts/mobile-web.sh resident` | Resident app, web preview | http://localhost:8181 |
| `./scripts/mobile-web.sh gate` | Gate app, web preview | http://localhost:8182 |
| `./scripts/check.sh` | Typecheck + lint + layering, everything | |
| `npm test` | Backend tests | |
| `npm run docs -w backend` | Regenerate the [endpoint](api/ENDPOINTS.md) and [table](database/TABLES.md) references | |

Ports can be overridden with `CHS_API_PORT`, `CHS_WEB_PORT`,
`CHS_RESIDENT_PORT` and `CHS_GATE_PORT`. More detail, including the `/mnt/e`
file-watching caveat, is in [../scripts/README.md](../scripts/README.md).

## Demo accounts

The password is `Sahaj@2026` for each account marked ✓.

| Mobile | Who | Use it for |
|---|---|---|
| 9820011001 ✓ | Sunil Kulkarni, secretary (full admin) | admin console |
| 9820011002 | Meera Joshi, treasurer | first sign-in (create password) |
| 9822041155 ✓ | Anita Deshpande, owner of A-1204 and C-0405 (let out) | resident app, multi-unit |
| 9812300702 ✓ | Vikram Sethi, tenant of B-0702 | resident app, tenant view, overdue bills |
| 9890012345 ✓ | Ramesh Yadav, guard | gate app |
| 9000000001 | Platform admin | platform console (create password on first sign-in) |

Five wrong passwords lock an account for 15 minutes. The secretary can unlock
it from Users & access.

## Working on the backend

- Add an endpoint by following [API.md](API.md#adding-an-endpoint): contract,
  then service, then binding, then test.
- Change the data model with [DATABASE.md](DATABASE.md#migrations): edit
  `prisma/schema/*.prisma`, then run `npm run db:migrate -w backend -- --name …`.
- Push and email run in log mode locally. To send for real, see
  [NOTIFICATIONS.md](NOTIFICATIONS.md).
- Payments use the dummy gateway: the resident app's checkout marked "Test mode".

## Working on the apps

- The apps import the API only through `@chs/contract` and `@chs/api-client`.
  See [packages.md](packages.md).
- Loading states follow [LOADING_AND_MOTION.md](LOADING_AND_MOTION.md).
- Each app has its own doc: [admin web](apps/admin-web.md),
  [resident](apps/resident-app.md), [gate](apps/gate-app.md).
- The design source is the `project/` folder. Its handoff README is at the
  bottom of the root README.
