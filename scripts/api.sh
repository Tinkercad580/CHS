#!/usr/bin/env bash
# The CHS API on http://localhost:4100/api/v1  (docs: http://localhost:4100/api/docs)
#
#   ./scripts/api.sh
#   ./scripts/api.sh --reseed        # also (re)load the demo society if missing
#   CHS_API_PORT=4200 ./scripts/api.sh
#
# Every run: installs if needed, applies pending migrations, loads the platform
# defaults and the demo society (both skip what already exists), frees the
# port, then starts the server with reload-on-save.
#
# First time on this machine, run ./scripts/db-setup.sh once.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PORT="${CHS_API_PORT:-4100}"

echo "1/4  dependencies"
if pgrep -f "^npm (install|ci)" >/dev/null 2>&1; then
  echo "     ✗ an npm install is already running — let it finish, then re-run this"
  exit 1
fi
if [ -x node_modules/.bin/tsx ] && [ -x node_modules/.bin/prisma ]; then
  echo "     already installed"
else
  npm install --no-audit --no-fund || { echo "     ✗ npm install failed"; exit 1; }
fi

echo "2/4  database"
if [ ! -f backend/.env ]; then
  echo "     ✗ backend/.env is missing — run ./scripts/db-setup.sh first"
  exit 1
fi
(cd backend && npx prisma generate >/dev/null) || { echo "     ✗ prisma generate failed"; exit 1; }
(cd backend && npx prisma migrate deploy 2>&1 | grep -E "applied|No pending|Error" | sed 's/^/     /') || true
(cd backend && npx prisma migrate status >/dev/null 2>&1) || {
  echo "     ✗ can't reach the database or migrations failed — is PostgreSQL running? (./scripts/db-setup.sh starts it)"
  exit 1
}
(cd backend && npx tsx prisma/seed/index.ts 2>&1 | sed 's/^/     /')

echo "3/4  port :$PORT"
holders() { ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u; }
for pid in $(holders); do kill "$pid" 2>/dev/null && echo "     stopped pid $pid"; done
for _ in $(seq 1 10); do [ -z "$(holders)" ] && break; sleep 1; done
for pid in $(holders); do kill -9 "$pid" 2>/dev/null; done
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "     ✗ something still holds :$PORT — check with: ss -ltnp | grep $PORT"
  exit 1
fi
echo "     free"

echo "4/4  server"
echo "     http://localhost:$PORT/api/v1   ·   docs http://localhost:$PORT/api/docs"
# tsx watch on /mnt/e: drvfs delivers no inotify events, so tell chokidar to poll.
cd backend && CHOKIDAR_USEPOLLING=1 PORT="$PORT" exec npx tsx watch --clear-screen=false src/server.ts
