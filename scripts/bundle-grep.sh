#!/usr/bin/env bash
# Ask the running preview what code it is actually serving.
#
#   ./scripts/bundle-grep.sh resident 'Pay now'
#   ./scripts/bundle-grep.sh gate 'Blacklist'
#
# For the one question that wastes the most time in this loop: "is my change
# in the bundle, or is my browser tab just old?" A hit means Metro rebuilt and
# the tab is stale — hard-reload it. A miss means the edit genuinely did not
# reach the bundle, and the place to look is the script header, not the code.
#
# It exists because the URL is not guessable. Expo serves expo-router's entry,
# not ./index, and a bare /index.bundle returns a 404 whose body reads
# "Unable to resolve module ./index" — which looks like the app is broken
# rather than the URL being wrong. The query string matters too: transform
# options are part of the cache key, so the wrong ones rebuild from scratch
# instead of answering.
set -uo pipefail

APP="${1:-}"
NEEDLE="${2:-}"
if [ -z "$APP" ] || [ -z "$NEEDLE" ]; then
  echo "usage: $0 [resident|gate] <string>"; exit 2
fi

case "$APP" in
  resident|resident-app) PORT=8081 ;;
  gate|gate-app)         PORT=8082 ;;
  *) echo "usage: $0 [resident|gate] <string>"; exit 2 ;;
esac

if ! ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "✗ nothing serving on :$PORT — start it with ./scripts/mobile-web.sh $APP"
  exit 1
fi

Q='platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable'
URL="http://localhost:$PORT/node_modules/expo-router/entry.bundle?$Q"

# A cold bundle takes about half a minute to build; the default timeout would
# report that as a miss, which is the exact wrong answer.
COUNT=$(curl -s -m 400 "$URL" | grep -c -- "$NEEDLE")

if [ "$COUNT" -gt 0 ]; then
  echo "✓ found $COUNT time(s) in the $APP bundle"
  echo "  Metro has your change. If the screen disagrees, the TAB is stale —"
  echo "  hard-reload it (Ctrl-Shift-R)."
else
  echo "✗ not in the $APP bundle"
  echo "  Metro never picked the edit up. Restart cold:"
  echo "    ./scripts/mobile-web.sh $APP --clear"
fi
