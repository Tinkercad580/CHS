# scripts/

Four scripts, all for the same job: **look at the UI and confirm it still
compiles.** There is no backend in this repo yet, and per `MASTER_SPEC.md` the
backend is Phase 0–1 work that has not started. Every screen you see here
renders fixtures.

| | |
|---|---|
| `./scripts/start.sh` | Admin console (web-app) → http://localhost:5273 |
| `./scripts/mobile-web.sh [resident\|gate]` | Resident app → :8181 · Gate app → :8182 |
| `./scripts/bundle-grep.sh <app> <string>` | Is my change in the bundle, or is the tab stale? |
| `./scripts/check.sh [all\|web\|mobile]` | Typecheck + lint everything |

First run of either server installs dependencies (web ~1 min, mobile ~4 min).
Both mobile apps can run at once — they are on different ports on purpose.

## Ports

None of these are the tool defaults. Vite's 5173 and Metro's 8081 are already
taken by another project on this machine, and a port clash is not an error you
get told about: whichever server started first keeps answering, and you review
the wrong app while reading the right filenames. Each script frees its own port
before starting and refuses to continue if it cannot.

| | default | override |
|---|---|---|
| admin console | 5273 | `CHS_WEB_PORT` |
| resident app | 8181 | `CHS_RESIDENT_PORT` |
| gate app | 8182 | `CHS_GATE_PORT` |

`bundle-grep.sh` reads the same variables, so an override stays consistent:

```
CHS_RESIDENT_PORT=9001 ./scripts/mobile-web.sh resident
CHS_RESIDENT_PORT=9001 ./scripts/bundle-grep.sh resident 'Pay now'
```

## What you are reviewing

Layout, copy, empty states, and flow. **Not data.** Any number on screen came
from `web-app/src/mock/*.ts` or a fixture in the app and means nothing. Anything
that would hit an API — sign-in, a payment confirming, a live visitor approval —
stops at the screen.

The admin console has no login and boots straight into the shell. That is the
current state of the build, not a bug.

## The one failure mode worth knowing

This repo lives on `/mnt/e`, a Windows drive mounted through drvfs, which does
not deliver inotify events. Nothing here watches files the way it would on a
normal filesystem:

- **Vite** is configured to poll (`web-app/vite.config.ts`), so the admin
  console hot-reloads normally.
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
