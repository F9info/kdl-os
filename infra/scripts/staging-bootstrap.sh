#!/usr/bin/env bash
# One-time bootstrap for the staging VPS. Needs root (installs Docker, writes /opt).
# Run once after provisioning the server, as a sudo-capable user:
#   ssh $STAGING_USER@$STAGING_HOST 'sudo bash -s' < infra/scripts/staging-bootstrap.sh
# The CD workflow later connects as that same user, so it is the "deploy user":
# the one that gets Docker access and owns /opt/kdl-staging.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root, e.g.: ssh user@host 'sudo bash -s' < infra/scripts/staging-bootstrap.sh" >&2
  exit 1
fi

# Under `sudo`, SUDO_USER is the login user; when logged in as root there is none.
DEPLOY_USER="${SUDO_USER:-root}"
echo "=== KDL staging bootstrap (deploy user: $DEPLOY_USER) ==="

# Docker (skip if already installed)
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
if [ "$DEPLOY_USER" != "root" ]; then
  usermod -aG docker "$DEPLOY_USER"
fi

# Docker Compose plugin (v2)
if ! docker compose version &>/dev/null; then
  COMPOSE_VERSION="v2.27.0"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

# Workspace: the CD workflow scp's compose files here and writes .env as the deploy user.
# frontend/projects is where the backend writes generated project sites (site-preview serves it).
mkdir -p /opt/kdl-staging/frontend/projects
chown -R "$DEPLOY_USER":"$DEPLOY_USER" /opt/kdl-staging

# Firewall: allow SSH first, then web, then enable — so enabling can never lock us out.
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo "Bootstrap complete. Log out and back in once so '$DEPLOY_USER' picks up the docker group."
echo "Next steps (GitHub → repo → Settings → Environments → staging):"
echo "  1. Secrets: STAGING_HOST, STAGING_USER ($DEPLOY_USER), STAGING_SSH_KEY, STAGING_ENV"
echo "  2. Variable: STAGING_URL"
echo "  3. Run the 'CD Staging' workflow (or merge to master) for the first deploy"
echo "See MANUAL_TASKS.md → KDL-403 for the exact commands."
