#!/usr/bin/env bash
# The admin console (web-app) in a browser, on http://localhost:5173.
#
#   ./scripts/start.sh
#   ./scripts/start.sh --reinstall     # blow away node_modules and install clean
#
# This is a UI review loop, not the product. There is no backend yet: every
# screen reads from web-app/src/mock/*.ts, so what you are checking is layout,
# copy, states and flow — not data. A number on screen came from a fixture and
# means nothing.
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

PORT=5173

if [ "${1:-}" = "--reinstall" ]; then
  echo "     removing web-app/node_modules"
  rm -rf web-app/node_modules
fi

# ---------------------------------------------------------------- 1/3 deps --
echo "1/3  dependencies"
if [ -d web-app/node_modules ]; then
  echo "     already installed"
else
  echo "     installing (first run — a few minutes)"
  npm install --prefix web-app || { echo "     ✗ install failed"; exit 1; }
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

     There is no login screen and no API. The app boots straight into the
     admin shell against mock data — that is the current state of the build,
     not a bug. Auth is Phase 1 in MASTER_SPEC.md and has not been built.

     Edits hot-reload. If one seems not to have landed, hard-reload the tab
     (Ctrl-Shift-R) before reading any code: a tab left open across a restart
     keeps running the bundle it already has.

     Ctrl-C to stop.

TXT
exec npm run dev --prefix web-app -- --port "$PORT" --strictPort
