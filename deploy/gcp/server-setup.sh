#!/usr/bin/env bash
# First install of GDG Vizag on a fresh Ubuntu VM, from the bundle made by prepare-bundle.sh.
#
#   tar -xzf gdg-vizag-bundle.tar.gz
#   sudo bash gdg-bundle/server-setup.sh gdgvizag.com
#
# Without a domain it uses <ip>.sslip.io (HTTPS works right away; move to a real domain later with
# deploy/gcp/set-domain.sh):
#   sudo bash gdg-bundle/server-setup.sh
#
# What it does: installs Docker and git; creates the "deploy" user (GitHub Actions logs in as it); clones
# F9info/gdg-vizag (main) into /opt/gdg with the read-only deploy key; restores the database and images;
# builds and starts everything with HTTPS; sets up a nightly backup. Refuses to run over an existing install.
# Needs the deploy key (keys/github_deploy.pub) added to the repo first: Settings -> Deploy keys.
set -euo pipefail

REPO_SSH="${GDG_REPO:-git@github.com:F9info/gdg-vizag.git}"
APP=/opt/gdg
DEPLOY_USER=deploy
# GitHub's published SSH host key (docs.github.com -> GitHub's SSH key fingerprints).
GITHUB_HOST_KEY='github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl'

if [ "$(id -u)" -ne 0 ]; then
  echo "Run it with sudo:  sudo bash $0 ${1:-}" >&2
  exit 1
fi

BUNDLE="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${1:-}"

for f in db.sql uploads.tar env.production keys/github_deploy keys/ci_deploy.pub; do
  [ -e "$BUNDLE/$f" ] || { echo "Missing $BUNDLE/$f - extract gdg-vizag-bundle.tar.gz first." >&2; exit 1; }
done
if [ -e "$APP/.env" ]; then
  echo "$APP is already installed. Not touching it (this script is for the first install only)." >&2
  exit 1
fi

IP="$(curl -fsS -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)"
if [ -z "$DOMAIN" ]; then
  [ -n "$IP" ] || { echo "Could not read this VM's external IP. Pass the domain: sudo bash $0 <domain>" >&2; exit 1; }
  DOMAIN="$(echo "$IP" | tr . -).sslip.io"
fi
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"
echo "=== Installing GDG Vizag for https://$DOMAIN"

echo "--- 1/8 Docker and git"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git; }

echo "--- 2/8 The deploy user and its keys"
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
H="/home/$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$H/.ssh"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BUNDLE/keys/github_deploy" "$H/.ssh/github_deploy"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BUNDLE/keys/ci_deploy.pub" "$H/.ssh/authorized_keys"
printf '%s\n' "$GITHUB_HOST_KEY" > "$H/.ssh/known_hosts"
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n  IdentitiesOnly yes\n' > "$H/.ssh/config"
chown "$DEPLOY_USER:$DEPLOY_USER" "$H/.ssh/known_hosts" "$H/.ssh/config"
chmod 600 "$H/.ssh/config"

echo "--- 3/8 Code from GitHub"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP"
if ! sudo -u "$DEPLOY_USER" git clone --quiet --branch main "$REPO_SSH" "$APP"; then
  echo >&2
  echo "Could not download the code from GitHub." >&2
  echo "Add this key in GitHub -> F9info/gdg-vizag -> Settings -> Deploy keys -> Add deploy key, then run this again:" >&2
  echo >&2
  ssh-keygen -y -f "$BUNDLE/keys/github_deploy" >&2
  exit 1
fi
[ -f "$APP/deploy/gcp/compose.sh" ] || {
  echo "main on GitHub has no deploy/gcp folder yet - push the deploy files first." >&2; exit 1; }

echo "--- 4/8 Settings, images"
sed "s/__DOMAIN__/$DOMAIN/g" "$BUNDLE/env.production" > "$APP/.env"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP/.env"
chmod 600 "$APP/.env"
sudo -u "$DEPLOY_USER" mkdir -p "$APP/backend/uploads" "$APP/frontend/projects" "$APP/backups"
tar -xf "$BUNDLE/uploads.tar" -C "$APP/backend"
C="$APP/deploy/gcp/compose.sh"

echo "--- 5/8 Database"
bash "$C" up -d postgres redis meilisearch
for _ in $(seq 1 60); do
  bash "$C" exec -T postgres pg_isready -U postgres -d kdl_db >/dev/null 2>&1 && break
  sleep 2
done
sleep 3
# Image links were saved as http://localhost:3000/... on the Mac; point them at the real domain.
sed "s#http://localhost:3000#https://$DOMAIN#g" "$BUNDLE/db.sql" \
  | bash "$C" exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d kdl_db >/dev/null

echo "--- 6/8 Building the backend and the website (10-15 minutes)"
bash "$C" build backend frontend

echo "--- 7/8 Starting"
# The backend runs as a non-root user inside its container: let it write uploads and generated sites.
bash "$C" run --rm --no-deps --user root --entrypoint sh backend \
  -c 'chown -R nodeuser:nodejs /app/uploads /app/generated-sites'
bash "$C" up -d backend frontend caddy

echo "--- 8/8 Nightly backup (02:30, kept 14 days, in $APP/backups)"
printf '30 2 * * * %s bash %s/deploy/gcp/backup.sh >> %s/backups/backup.log 2>&1\n' "$DEPLOY_USER" "$APP" "$APP" \
  > /etc/cron.d/gdg-backup

echo "=== Waiting for https://$DOMAIN"
ok=""
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "https://$DOMAIN/"; then ok=1; break; fi
  sleep 5
done
bash "$C" ps
echo
if [ -n "$ok" ]; then
  echo "SUCCESS: the site is live at https://$DOMAIN   (admin: https://$DOMAIN/login)"
else
  echo "The services are running but https://$DOMAIN did not answer yet."
  echo "With your own domain: check its DNS A record points to ${IP:-this server}, wait a few minutes, reload."
  echo "Logs:  sudo bash $C logs --tail 50 caddy frontend backend"
fi
echo
echo "For GitHub (Settings -> Secrets and variables -> Actions -> New repository secret):"
echo "  GCP_HOST      ${IP:-<the external IP of this server>}"
echo "  GCP_HOST_KEY  $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
echo
echo "Now delete the bundle (it holds passwords):  rm -rf ~/gdg-bundle ~/gdg-vizag-bundle.tar.gz"
