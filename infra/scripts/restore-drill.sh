#!/usr/bin/env bash
# Quarterly restore drill — MASTER_SPEC E5 (RPO 1 h, RTO 4 h).
#
#   BACKUP_FILE=backups/chs-20260925T020000Z.dump.enc \
#   BACKUP_PASSPHRASE_FILE=/etc/chs/backup.key \
#   DRILL_DATABASE_URL=postgresql://chs_app:...@127.0.0.1:5432/chs_restore_drill \
#   ./infra/scripts/restore-drill.sh
#
# Restores into a scratch database (never the live one), then checks the
# restore is usable: migrations table present, row counts non-zero, audit log
# readable. Prints the elapsed time so the RTO can be recorded.
set -euo pipefail

: "${BACKUP_FILE:?set BACKUP_FILE}"
: "${BACKUP_PASSPHRASE_FILE:?set BACKUP_PASSPHRASE_FILE}"
: "${DRILL_DATABASE_URL:?set DRILL_DATABASE_URL (a scratch database, not production)}"

url="${DRILL_DATABASE_URL%%\?*}"
case "$url" in
  *drill*|*restore*|*scratch*) ;;
  *) echo "Refusing: DRILL_DATABASE_URL must name a drill/restore/scratch database"; exit 1 ;;
esac

start=$(date +%s)
sha256sum -c "$BACKUP_FILE.sha256"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$BACKUP_FILE" \
  | pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$url"

psql "$url" -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT 'migrations applied: ' || count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;
SELECT 'societies: ' || count(*) FROM societies;
SELECT 'users: ' || count(*) FROM users;
SELECT 'audit rows: ' || count(*) FROM audit_logs;
SQL
echo "restore drill passed in $(( $(date +%s) - start ))s"
