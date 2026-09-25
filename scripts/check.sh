#!/usr/bin/env bash
# Typecheck and lint everything that exists today.
#
#   ./scripts/check.sh              # everything
#   ./scripts/check.sh api          # backend + packages/* + layering rules
#   ./scripts/check.sh web          # just the admin console
#   ./scripts/check.sh mobile       # shared + both apps
#
# This is what to run before saying a change is done. It catches the class of
# mistake that a browser hides: a prop that no longer exists, an import that
# resolves to undefined, a fixture whose shape drifted from the type that
# describes it. Those render fine and are wrong.
#
# It does not run the backend's tests — they need the database and take a
# couple of minutes: `npm test` at the repo root.
#
# Every package is checked even after one fails, and the failures are counted
# and reported together at the end. Stopping at the first one turns a single
# pass into as many passes as there are broken packages.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

TARGET="${1:-all}"
case "$TARGET" in
  all|api|web|mobile) ;;
  *) echo "usage: $0 [all|api|web|mobile]"; exit 2 ;;
esac

FAILED=()

run() { # run <label> <dir> <command...>
  local label="$1" dir="$2"; shift 2
  printf '\n── %s\n' "$label"
  # packages/* and the backend install into the repo-root workspace.
  local installed=no
  [ -d "$dir/node_modules" ] || [ -d "${dir%%/apps/*}/node_modules" ] && installed=yes
  case "$dir" in packages/*|backend|.) [ -x node_modules/.bin/tsc ] && installed=yes ;; esac
  if [ "$installed" = no ]; then
    echo "   skipped — not installed (./scripts/api.sh, start.sh or mobile-web.sh installs)"
    FAILED+=("$label (not installed)")
    return
  fi
  ( cd "$dir" && "$@" ) && echo "   ok" || FAILED+=("$label")
}

if [ "$TARGET" = all ] || [ "$TARGET" = api ]; then
  # The contract first: the backend and all three apps compile against it.
  run "@chs/contract · typecheck"   packages/contract    npx tsc -p .
  run "@chs/api-client · typecheck" packages/api-client  npx tsc -p .
  run "backend · typecheck"         backend              sh -c "npx prisma generate >/dev/null 2>&1 && npx tsc -p ."
  run "backend · lint"              backend              npx oxlint src test
  run "layering rules"              .                    node scripts/check-boundaries.mjs
fi

if [ "$TARGET" = all ] || [ "$TARGET" = web ]; then
  # tsc -b, not tsc --noEmit: web-app/tsconfig.json is a solution file with no
  # files of its own, so --noEmit checks nothing and exits 0. noEmit is already
  # set inside tsconfig.app.json, so -b writes nothing.
  run "web-app · typecheck" web-app npx tsc -b
  run "web-app · lint"      web-app npx oxlint
fi

if [ "$TARGET" = all ] || [ "$TARGET" = mobile ]; then
  # Shared first: both apps import it, so a break here reports three times and
  # only the first report is the cause.
  run "@sahaj/shared · typecheck"  mobile-app/packages/shared    npx tsc --noEmit
  run "resident-app · typecheck"   mobile-app/apps/resident-app  npx tsc --noEmit
  run "gate-app · typecheck"       mobile-app/apps/gate-app      npx tsc --noEmit
fi

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✓ all checks passed"
else
  echo "✗ ${#FAILED[@]} failed:"
  printf '    %s\n' "${FAILED[@]}"
  exit 1
fi
