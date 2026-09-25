#!/usr/bin/env bash
# Encrypted logical backup of the CHS database — MASTER_SPEC E5 (daily, 35-day retention).
#
#   DATABASE_URL=... BACKUP_DIR=/var/backups/chs BACKUP_PASSPHRASE_FILE=/etc/chs/backup.key ./infra/scripts/backup.sh
#
# Custom-format pg_dump (restorable table by table), encrypted with AES-256
# via openssl, then files older than RETENTION_DAYS are removed. Ship
# BACKUP_DIR to off-site object storage in the India region with your
# scheduler of choice; this script only produces and prunes.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL}"
: "${BACKUP_PASSPHRASE_FILE:?set BACKUP_PASSPHRASE_FILE (a file holding the encryption passphrase)}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-35}"

mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$BACKUP_DIR/chs-$stamp.dump.enc"

# Prisma's ?schema= query parameter isn't understood by libpq.
url="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --no-privileges "$url" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$BACKUP_PASSPHRASE_FILE" > "$out.partial"
mv "$out.partial" "$out"
sha256sum "$out" > "$out.sha256"
echo "backup: $out ($(du -h "$out" | cut -f1))"

find "$BACKUP_DIR" -name 'chs-*.dump.enc*' -mtime "+$RETENTION_DAYS" -print -delete | sed 's/^/pruned: /'
