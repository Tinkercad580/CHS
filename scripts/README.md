# scripts/

The local dev loop. The API is real (PostgreSQL, realtime, jobs); the apps
talk to it for sign-in, users, society setup and members, and still render
fixtures for the modules the backend doesn't have yet (billing onwards).

| | |
|---|---|
| `./scripts/db-setup.sh` | **Once per machine.** Starts the local PostgreSQL 16, creates the `chs_app` role and its `chs_app` / `chs_app_test` databases, writes `backend/.env`. Asks for sudo once; touches no other database. |
| `./scripts/api.sh` | API → http://localhost:4100/api/v1 · docs http://localhost:4100/api/docs. Installs, migrates, seeds the demo society, reloads on save. |
| `./scripts/start.sh` | Admin console (web-app) → http://localhost:5273 (proxies `/api` to the API) |
| `./scripts/mobile-web.sh [resident\|gate]` | Resident app → :8181 · Gate app → :8182 |
| `./scripts/bundle-grep.sh <app> <string>` | Is my change in the bundle, or is the tab stale? |
| `./scripts/check.sh [all\|api\|web\|mobile]` | Typecheck + lint + layering rules |
| `npm test` (repo root) | Backend tests — unit, integration, compliance — against `chs_app_test` |

Order on a fresh machine: `db-setup.sh`, then `api.sh` in one terminal, then
`start.sh` and/or `mobile-web.sh` in others.

## Demo accounts

`api.sh` loads Shanti Vihar CHS (248 units, buildings A–D) the first time. It
prints the accounts; the ones with a password use `Sahaj@2026`.

| mobile | who | |
|---|---|---|
| 9820011001 | Sunil Kulkarni | secretary — full admin |
| 9820011002 | Meera Joshi | treasurer — no password yet: first sign-in creates one |
| 9822041155 | Anita Deshpande | owner of A-1204 and C-0405 (let out) |
| 9812300702 | Vikram Sethi | tenant of B-0702 |
| 9890012345 | Ramesh Yadav | guard |
| 9000000001 | Platform Admin | platform console — first sign-in creates the password |

Five wrong passwords lock an account for 15 minutes; the secretary can unlock
it from Users & access.

## Ports

None of these are the tool defaults. Vite's 5173 and Metro's 8081 are already
taken by another project on this machine, and a port clash is not an error you
get told about: whichever server started first keeps answering, and you review
the wrong app while reading the right filenames. Each script frees its own port
before starting and refuses to continue if it cannot.

| | default | override |
|---|---|---|
| API | 4100 | `CHS_API_PORT` |
| admin console | 5273 | `CHS_WEB_PORT` |
| resident app | 8181 | `CHS_RESIDENT_PORT` |
| gate app | 8182 | `CHS_GATE_PORT` |

`bundle-grep.sh` reads the same variables, so an override stays consistent:

```
CHS_RESIDENT_PORT=9001 ./scripts/mobile-web.sh resident
CHS_RESIDENT_PORT=9001 ./scripts/bundle-grep.sh resident 'Pay now'
```

## What is real and what is a fixture

Real, from the API: sign-in (every path in MASTER_SPEC A2), users & access,
buildings and units, members, occupancy, tenancies, household, approvals,
billing (charge heads, runs, bills, ledger, credit notes), payments (dummy
gateway, desk receipts, cheques), notices, notifications and push, dashboard
and reports. Fixtures: accounting, recovery, helpdesk, gate visitors and
parcels, staff, meetings, documents, requests, amenities, vendors, compliance
calendar, and the admin console's society-setup screen. A number on one of
those came from `web-app/src/mock/*.ts` or an app fixture. Per-app detail:
[docs/apps/](../docs/apps/).

## The one failure mode worth knowing

This repo lives on `/mnt/e`, a Windows drive mounted through drvfs, which does
not deliver inotify events. Nothing here watches files the way it would on a
normal filesystem:

- **Vite** is configured to poll (`web-app/vite.config.ts`), so the admin
  console hot-reloads normally.
- **The API** (`api.sh`) runs `tsx watch` with polling on, so it restarts on save.
- **Metro has no such workaround.** Edit a mobile file and you must restart
  `mobile-web.sh`, *and then hard-reload the browser tab* (Ctrl-Shift-R).

Skipping the reload is worse than it sounds. A restart rebuilds what Metro
serves; it does nothing to the copy your tab already has. Old code then runs
against new fixtures, reads a field that no longer exists as `undefined`, and
quietly computes a wrong answer instead of crashing — which looks exactly like
a bug in the data. When a change seems not to have landed, ask the server
before you read any code:

```
./scripts/bundle-grep.sh resident 'Pay now'
```

A hit means the tab is stale. A miss means Metro never saw the edit.

## Known noise

`error while loading shared libraries: libnspr4.so` on mobile startup is React
Native DevTools failing to launch — an optional debugger this environment lacks
system libraries for. The preview is unaffected. `sudo apt install libnspr4`
silences it.
