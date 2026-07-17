#!/usr/bin/env bash
# One-time bootstrap for the staging VPS.
# Run once after provisioning the server:
#   ssh $STAGING_USER@$STAGING_HOST 'bash -s' < infra/scripts/staging-bootstrap.sh
set -euo pipefail

echo "=== KDL staging bootstrap ==="

# Docker (skip if already installed)
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$USER" || true
fi

# Docker Compose plugin (v2)
if ! docker compose version &>/dev/null; then
  COMPOSE_VERSION="v2.27.0"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

# Workspace directory
mkdir -p /opt/kdl-staging

echo "Bootstrap complete. Next steps:"
echo "  1. Add STAGING_HOST, STAGING_USER, STAGING_SSH_KEY, STAGING_ENV, GHCR_TOKEN"
echo "     to GitHub repo → Settings → Secrets → Actions"
echo "  2. Add STAGING_URL to GitHub repo → Settings → Environments → staging → Variables"
echo "  3. Push to master — cd-staging.yml will handle the first deploy"
