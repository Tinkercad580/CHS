#!/usr/bin/env bash
# The admin console (web-app) in a browser, on http://localhost:5173.
#
#   ./scripts/start.sh
#   ./scripts/start.sh --reinstall     # blow away node_modules and install clean
#   CHS_WEB_PORT=6000 ./scripts/start.sh
#
# Ports are deliberately off Vite's 5173 default: another project on this
# machine already owns it, and two dev servers fighting over one port is not a
# clash you get told about — whichever started first keeps serving, and you
# review the wrong app. Override with CHS_WEB_PORT if these collide too.
#
# The console talks to the API through Vite's proxy (/api → localhost:4100), so
# start ./scripts/api.sh first. Sign-in, Users & access and Members & units are
# live data; modules without a backend yet (billing onwards) still read
# web-app/src/mock/*.ts, and a number on those screens means nothing.
#
# It is a script rather than `npm run dev` because two steps are easy to forget
# and both fail in ways that look like broken code rather than a missing step:
#
#   1. Install. The repo arrived as a git bundle with no node_modules, so a
#      plain `npm run dev` dies with "vite: not found" — which reads as a
#      toolchain problem rather than "nobody has installed yet".
#   2. Killing the old server. On /mnt/e the watcher polls (see vite.config.ts),
#      and a stale process from a previous run keeps holding :5173 and serving
#      the build it started with. The tab loads, the app works, and your change
#      is simply absent.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PORT="${CHS_WEB_PORT:-5273}"

if [ "${1:-}" = "--reinstall" ]; then
  echo "     removing web-app/node_modules"
  rm -rf web-app/node_modules
fi

# ---------------------------------------------------------------- 1/3 deps --
echo "1/3  dependencies"

# Refuse to race a running install — see the note in mobile-web.sh. npm fills
# node_modules over minutes, so "the directory exists" and "the tools are
# there" are different questions, and only the second one matters.
# Anchored — see the note in mobile-web.sh. `pgrep -f "npm install"` is an unanchored substring match against
# whole command lines, so it also matches the shell that invoked this script
# whenever that invocation happens to contain the words — including this very
# check, quoted inside a wrapper. The guard then fires against itself and the
# script refuses to run with no install anywhere. Anchoring to the start of the
# command line matches the npm process (cmdline is exactly "npm install ...")
# and nothing that merely mentions it.
if pgrep -f "^npm install" >/dev/null 2>&1; then
  echo "     ✗ an npm install is already running — let it finish, then re-run this"
  exit 1
fi

if [ -x web-app/node_modules/.bin/vite ]; then
  echo "     already installed"
else
  [ -d web-app/node_modules ] \
    && echo "     node_modules exists but vite is missing — finishing the install"
  echo "     installing (first run — a few minutes)"
  npm install --prefix web-app || { echo "     ✗ install failed"; exit 1; }
  [ -x web-app/node_modules/.bin/vite ] \
    || { echo "     ✗ install finished but vite is still missing"; exit 1; }
fi

# ---------------------------------------------------------------- 2/3 port --
# Killed by the port it holds, never by a name pattern: `pkill -f vite` also
# matches the shell that invoked this script if the invocation mentioned it,
# which kills the caller. The port is the thing actually in the way.
echo "2/3  stopping any old server"
holders() { ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u; }
for pid in $(holders); do
  kill "$pid" 2>/dev/null && echo "     stopped pid $pid"
done
for _ in $(seq 1 10); do [ -z "$(holders)" ] && break; sleep 1; done
for pid in $(holders); do kill -9 "$pid" 2>/dev/null; done
sleep 1
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "     ✗ something still holds :$PORT — check with: ss -ltnp | grep $PORT"
  exit 1
fi

# --------------------------------------------------------------- 3/3 serve --
cat <<TXT
3/3  admin console

     console   http://localhost:$PORT
     phone     http://<this machine's LAN IP>:$PORT   (server.host is on)

     Not Vite's default 5173 — that port belongs to another project here.
     Override with CHS_WEB_PORT=... if 5273 is taken too.

     Needs the API (./scripts/api.sh) — sign in as 9820011001 / Sahaj@2026.
     Billing and later modules still show mock data until their backend lands.

     Edits hot-reload. If one seems not to have landed, hard-reload the tab
     (Ctrl-Shift-R) before reading any code: a tab left open across a restart
     keeps running the bundle it already has.

     Ctrl-C to stop.

TXT
exec npm run dev --prefix web-app -- --port "$PORT" --strictPort
