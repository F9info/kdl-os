#!/usr/bin/env bash
# Deploy a new version on the VM: fetch the code from GitHub, rebuild, restart.
# GitHub Actions (.github/workflows/deploy-gcp.yml) runs it over SSH as the "deploy" user after every push to
# main. By hand on the VM:   /opt/gdg/deploy/gcp/update.sh            (latest main)
#                            /opt/gdg/deploy/gcp/update.sh <commit>   (a specific commit, e.g. to roll back)
# Database migrations run by themselves when the backend starts. The database and uploads are untouched.
set -euo pipefail

# Everything is inside main(), which bash reads whole before running: `git reset` below may replace this file.
main() {
  cd "$(dirname "$0")/../.."
  local ref="${1:-origin/main}"
  git fetch --quiet origin main
  git reset --hard --quiet "$ref"
  echo "=== Deploying $(git log -1 --format='%h %s')"
  deploy/gcp/compose.sh build backend frontend
  deploy/gcp/compose.sh up -d backend frontend caddy
  docker image prune -f >/dev/null
  for _ in $(seq 1 40); do
    if deploy/gcp/compose.sh exec -T backend wget -qO- http://localhost:4000/health >/dev/null 2>&1; then
      echo "=== Live: $(git log -1 --format='%h %s')"
      exit 0
    fi
    sleep 3
  done
  echo "The backend did not become healthy. Logs: /opt/gdg/deploy/gcp/compose.sh logs --tail 80 backend" >&2
  exit 1
}
main "$@"
