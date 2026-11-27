#!/usr/bin/env bash
# Nightly backup on the VM (installed as a cron job by server-setup.sh): the database and the uploaded
# images go to /opt/gdg/backups, and copies older than 14 days are removed.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p backups
day="$(date +%F)"
deploy/gcp/compose.sh exec -T postgres pg_dump -U postgres --clean --if-exists --no-owner kdl_db | gzip > "backups/db-$day.sql.gz"
tar -czf "backups/uploads-$day.tgz" -C backend uploads
find backups -type f -mtime +14 -delete
