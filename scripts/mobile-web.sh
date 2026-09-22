#!/usr/bin/env bash
# A mobile app in a desktop browser, through react-native-web.
#
#   ./scripts/mobile-web.sh                 # resident app, http://localhost:8181
#   ./scripts/mobile-web.sh gate            # gate app,     http://localhost:8182
#   ./scripts/mobile-web.sh resident --clear
#   ./scripts/mobile-web.sh --reinstall     # clean install of the whole workspace
#   CHS_RESIDENT_PORT=9001 ./scripts/mobile-web.sh
#
# Off Metro's 8081 default on purpose: another project on this machine already
# uses it. A port clash here does not announce itself — Expo will happily
# attach to whatever is already listening, or silently pick another port, and
# either way you end up reviewing an app that is not this one. Override with
# CHS_RESIDENT_PORT / CHS_GATE_PORT.
#
# Same React Native code Expo would ship to a phone, run in a browser. It is a
# development preview, not a client — nothing deploys it. What it buys is a UI
# change seen in seconds instead of a device build, and it is the fastest way
# to review the screens before any backend exists.
#
# The two apps get different ports on purpose so both can run side by side —
# reviewing the gate flow usually means checking what the resident sees at the
# same moment, and Metro will happily start on a port the other one holds and
# then serve you the wrong app.
#
# It is a script rather than `npm run resident` because three things fail
# silently otherwise:
#
#   1. Install. Fresh clone, no node_modules: `expo start` is not on PATH and
#      the error names expo rather than the missing install.
#   2. A restart. /mnt/e is a Windows drive over drvfs with no inotify, so
#      Metro never sees an edit — it serves the previous bundle and the change
#      looks like it did not work. Killing the old one first is the whole
#      reason this is not two words of npm.
#   3. --clear after touching app.json or metro.config.js. Expo caches the
#      resolved config, so a plain restart keeps serving the old one. Handled
#      below by comparing mtimes, so it is not something to remember.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

APP="resident"
CLEAR=""
REINSTALL=""

for arg in "$@"; do
  case "$arg" in
    resident|resident-app) APP="resident" ;;
    gate|gate-app)         APP="gate" ;;
    --clear)               CLEAR="--clear" ;;
    --reinstall)           REINSTALL="1" ;;
    *) echo "usage: $0 [resident|gate] [--clear] [--reinstall]"; exit 2 ;;
  esac
done

case "$APP" in
  resident) DIR="mobile-app/apps/resident-app"; PORT="${CHS_RESIDENT_PORT:-8181}"; LABEL="Sahaj — resident" ;;
  gate)     DIR="mobile-app/apps/gate-app";     PORT="${CHS_GATE_PORT:-8182}";     LABEL="Sahaj Gate — guard" ;;
esac

if [ -n "$REINSTALL" ]; then
  echo "     removing mobile-app node_modules"
  rm -rf mobile-app/node_modules mobile-app/apps/*/node_modules mobile-app/packages/*/node_modules
fi

# ---------------------------------------------------------------- 1/3 deps --
# One install at mobile-app/ covers both apps and @sahaj/shared: it is an npm
# workspace root. Installing inside an app instead splits the tree and Metro
# resolves two copies of react-native, which fails as a blank screen.
echo "1/3  dependencies"

# Refuse to race a running install. npm creates node_modules early and fills it
# over several minutes, so a concurrent run sees a directory that exists, calls
# it installed, and hands Metro a half-populated tree. The symptom is
# "sh: 1: expo: not found", which reads as a broken PATH rather than "wait".
# Anchored. `pgrep -f "npm install"` is an unanchored substring match against
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

# Tested by the binary that is about to be executed, not by the directory that
# contains it: `[ -d node_modules ]` is true from the first second of an
# install to the last, which is exactly the window in which it is a lie.
if [ -x mobile-app/node_modules/.bin/expo ]; then
  echo "     already installed"
else
  [ -d mobile-app/node_modules ] \
    && echo "     node_modules exists but expo is missing — finishing the install"
  echo "     installing the workspace (first run — several minutes)"
  npm install --prefix mobile-app || { echo "     ✗ install failed"; exit 1; }
  [ -x mobile-app/node_modules/.bin/expo ] \
    || { echo "     ✗ install finished but expo is still missing"; exit 1; }
fi

# ---------------------------------------------------------------- 2/3 port --
# By port, not by name: `pkill -f "expo start"` matches any command line
# containing those words, including the shell that started this script.
echo "2/3  stopping any old preview on :$PORT"
holders() { ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u; }
for pid in $(holders); do
  kill "$pid" 2>/dev/null && echo "     stopped pid $pid"
done
for _ in $(seq 1 10); do [ -z "$(holders)" ] && break; sleep 1; done
# Metro is a node process with children; a survivor still owns the socket.
for pid in $(holders); do kill -9 "$pid" 2>/dev/null; done
sleep 1
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "     ✗ something still holds :$PORT — check with: ss -ltnp | grep $PORT"
  exit 1
fi

# -------------------------------------------------------------- 3/3 bundle --
# app.json and metro.config.js are read at start and the result is cached, so a
# change to either needs a cold start. Comparing against a stamp means the
# answer is derived rather than remembered.
STAMP="$DIR/.expo/.sahaj-last-start"
if [ -z "$CLEAR" ] && { [ ! -f "$STAMP" ] \
     || [ "$DIR/app.json" -nt "$STAMP" ] \
     || [ "$DIR/metro.config.js" -nt "$STAMP" ]; }; then
  CLEAR="--clear"
  echo "3/3  config changed since the last run — starting cold"
else
  echo "3/3  bundling${CLEAR:+ (cold)}"
fi
mkdir -p "$(dirname "$STAMP")" && touch "$STAMP"

cat <<TXT

     $LABEL
     preview   http://localhost:$PORT

     Narrow the browser window to about 400px, or use the device toolbar in
     devtools, or the layout you review is not the layout anyone gets.

     There is no backend. Every screen renders fixtures, so the flows are real
     and the data is not. Anything that would call an API — sign-in, payment
     confirmation, a live visitor approval — is a mock and stops at the screen.

     The other app runs at the same time:
       resident  ./scripts/mobile-web.sh resident   :${CHS_RESIDENT_PORT:-8181}
       gate      ./scripts/mobile-web.sh gate       :${CHS_GATE_PORT:-8182}

     Not Metro's default 8081 — that port belongs to another project here.
     Override with CHS_RESIDENT_PORT / CHS_GATE_PORT.

     Edit a file and this has to be restarted — see the header. Ctrl-C to stop.

     ...AND THEN HARD-RELOAD THE BROWSER TAB (Ctrl-Shift-R).

     A restart rebuilds the bundle Metro serves; it does nothing to the copy
     your tab already has. A tab left open across a restart keeps running the
     previous build, and the failure is not that the screen looks stale — it is
     that old code runs against new fixtures, reads a field that no longer
     exists as undefined, and quietly computes a wrong answer rather than
     crashing. It looks exactly like a bug in the data.

     A red "error while loading shared libraries: libnspr4.so" line at startup
     is React Native DevTools failing to launch. It is an optional debugger
     this environment has no system libraries for; the preview is unaffected.
     Install libnspr4 to silence it, or ignore it.

     If a change seems not to have landed, curl the bundle before reading any
     code. The entry is expo-router's, not ./index — a bare index.bundle 404s
     with "Unable to resolve module ./index", which reads as a broken app:
       ./scripts/bundle-grep.sh $APP 'your new string'

TXT

cd "$DIR"
exec npx expo start --web --port "$PORT" $CLEAR
