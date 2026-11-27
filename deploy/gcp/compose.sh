#!/usr/bin/env bash
# docker compose for the GDG Vizag VM stack. Examples:
#   deploy/gcp/compose.sh ps
#   deploy/gcp/compose.sh logs -f backend
#   deploy/gcp/compose.sh restart frontend
set -euo pipefail
cd "$(dirname "$0")/../.."
exec docker compose -p gdg -f docker-compose.yml -f deploy/gcp/docker-compose.gcp.yml "$@"
