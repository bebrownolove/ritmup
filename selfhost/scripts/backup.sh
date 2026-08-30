#!/bin/sh
set -eu

backup_dir="${BACKUP_DIR:-/var/backups/ritm}"
keep_days="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "$backup_dir/ritm-$timestamp.sql.gz"
find "$backup_dir" -type f -name 'ritm-*.sql.gz' -mtime "+$keep_days" -delete
echo "Backup saved to $backup_dir/ritm-$timestamp.sql.gz"
