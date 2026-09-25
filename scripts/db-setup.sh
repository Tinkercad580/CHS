#!/usr/bin/env bash
# One-time: give the CHS API its own database on this machine's PostgreSQL.
#
#   ./scripts/db-setup.sh
#
# What it does, and what it leaves alone:
#
#   - Starts the local PostgreSQL 16 cluster if it's stopped (WSL has no
#     systemd, so nothing starts it at boot). This is the one step that needs
#     sudo; you'll be asked for your password by sudo itself.
#   - Creates a login role `chs_app` and two databases it owns: `chs_app` (the
#     app) and `chs_app_test` (wiped by the test suite on every run). The role
#     is not a superuser and gets no rights on any other database — existing
#     roles and databases on this server are not touched, read or altered. If
#     a `chs_app` role already exists that this script didn't create (no
#     matching backend/.env), it stops rather than reset that role's password.
#   - Writes backend/.env with the connection string and fresh random secrets.
#
# Safe to re-run: existing role, databases and .env are kept as they are.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=backend/.env
PGVER=16
CLUSTER=main
PORT=5432

echo "1/4  PostgreSQL cluster"
status=$(pg_lsclusters --no-header 2>/dev/null | awk -v v="$PGVER" -v c="$CLUSTER" '$1==v && $2==c {print $4}')
if [ -z "$status" ]; then
  echo "     ✗ no PostgreSQL $PGVER/$CLUSTER cluster found (pg_lsclusters)."
  exit 1
fi
PORT=$(pg_lsclusters --no-header | awk -v v="$PGVER" -v c="$CLUSTER" '$1==v && $2==c {print $3}')
if [ "$status" != "online" ]; then
  echo "     starting $PGVER/$CLUSTER (sudo will ask for your password)"
  sudo pg_ctlcluster "$PGVER" "$CLUSTER" start
fi
pg_isready -h 127.0.0.1 -p "$PORT" -q || { echo "     ✗ PostgreSQL isn't accepting connections on :$PORT"; exit 1; }
echo "     online on :$PORT"

echo "2/4  password"
ROLE_EXISTS=$(sudo -u postgres psql -p "$PORT" -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'chs_app'")
if [ -f "$ENV_FILE" ] && grep -q '^DATABASE_URL=postgresql://chs_app:' "$ENV_FILE"; then
  DB_PASSWORD=$(sed -nE 's#^DATABASE_URL=postgresql://chs_app:([^@]+)@.*#\1#p' "$ENV_FILE")
  echo "     reusing the one in $ENV_FILE"
elif [ "$ROLE_EXISTS" = "1" ]; then
  echo "     ✗ a role named chs_app already exists and $ENV_FILE doesn't hold its password."
  echo "       Not resetting a role this script didn't create. Put its URL in $ENV_FILE, or drop the role, and re-run."
  exit 1
else
  DB_PASSWORD=$(openssl rand -hex 24)
  echo "     generated"
fi

echo "3/4  role and databases"
sudo -u postgres psql -p "$PORT" -v ON_ERROR_STOP=1 -q -v pw="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE chs_app LOGIN PASSWORD %L CREATEDB', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chs_app') \gexec
SELECT 'CREATE DATABASE chs_app OWNER chs_app ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'chs_app') \gexec
SELECT 'CREATE DATABASE chs_app_test OWNER chs_app ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'chs_app_test') \gexec
REVOKE ALL ON DATABASE chs_app FROM PUBLIC;
REVOKE ALL ON DATABASE chs_app_test FROM PUBLIC;
SQL
echo "     role chs_app · databases chs_app, chs_app_test"

echo "4/4  $ENV_FILE"
if [ -f "$ENV_FILE" ] && grep -q '^JWT_ACCESS_SECRET=.\+' "$ENV_FILE"; then
  sed -i -E "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://chs_app:${DB_PASSWORD}@127.0.0.1:${PORT}/chs_app?schema=public#" "$ENV_FILE"
  echo "     kept existing secrets, updated DATABASE_URL"
else
  secret() { openssl rand -base64 48 | tr -d '\n'; }
  cat > "$ENV_FILE" <<EOF
NODE_ENV=development
PORT=4100
DATABASE_URL=postgresql://chs_app:${DB_PASSWORD}@127.0.0.1:${PORT}/chs_app?schema=public
REDIS_URL=
JWT_ACCESS_SECRET=$(secret)
JWT_RESTRICTED_SECRET=$(secret)
DATA_ENCRYPTION_KEY=$(secret)
CORS_ORIGINS=http://localhost:5273,http://localhost:8181,http://localhost:8182
LOG_LEVEL=info
MESSAGING_PROVIDER=log
EOF
  chmod 600 "$ENV_FILE"
  echo "     written (mode 600)"
fi

echo
echo "Done. Start the API with: ./scripts/api.sh"
