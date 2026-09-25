#!/usr/bin/env bash
# Apply pending migrations — forward only (MASTER_SPEC E2, E6). Run as a
# pre-deploy step; the API container also runs it before starting.
#
#   DATABASE_URL=... ./infra/scripts/migrate.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
cd "$(dirname "${BASH_SOURCE[0]}")/../../backend"
npx prisma migrate status || true
npx prisma migrate deploy
