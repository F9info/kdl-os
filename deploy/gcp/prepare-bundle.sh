#!/usr/bin/env bash
# Run on the Mac, with the local stack running. Packs what the GCP server needs for its FIRST install into
# ONE file (the code itself comes from GitHub, F9info/gdg-vizag main):
#   - server-setup.sh
#   - the database (all pages, events, speakers, settings, users)
#   - the uploaded images (backend/uploads)
#   - a production .env: new secrets, the domain left as __DOMAIN__ (server-setup.sh fills it in)
#   - SSH keys: github_deploy (the VM reads the repo with it) and ci_deploy.pub (GitHub Actions logs in with
#     ci_deploy). The keys are made once, in <out>/keys, and reused.
#
#   bash deploy/gcp/prepare-bundle.sh            -> ~/Documents/gdg-vizag-deploy/gdg-vizag-bundle.tar.gz
#
# The bundle holds passwords and the database: keep it private and delete it once the site is live.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$HOME/Documents/gdg-vizag-deploy}"
PG_CONTAINER="${PG_CONTAINER:-kdl-os-postgres-1}"
DOCKER=docker
command -v docker >/dev/null 2>&1 || DOCKER=/Applications/Docker.app/Contents/Resources/bin/docker

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
B="$WORK/gdg-bundle"
mkdir -p "$B/keys" "$OUT/keys"
chmod 700 "$OUT" "$OUT/keys"
cd "$REPO"

echo "1/4 Setup script and SSH keys ..."
cp deploy/gcp/server-setup.sh "$B/"
[ -f "$OUT/keys/github_deploy" ] || ssh-keygen -q -t ed25519 -N '' -C 'gdg-vizag VM (read-only deploy key)' -f "$OUT/keys/github_deploy"
[ -f "$OUT/keys/ci_deploy" ] || ssh-keygen -q -t ed25519 -N '' -C 'gdg-vizag GitHub Actions deploy' -f "$OUT/keys/ci_deploy"
cp "$OUT/keys/github_deploy" "$OUT/keys/ci_deploy.pub" "$B/keys/"

echo "2/4 Database ..."
"$DOCKER" exec "$PG_CONTAINER" pg_dump -U postgres --clean --if-exists --no-owner --no-privileges kdl_db > "$B/db.sql"

echo "3/4 Uploaded images ..."
if [ -d backend/uploads ]; then
  tar -C backend -cf "$B/uploads.tar" uploads
else
  tar -cf "$B/uploads.tar" -T /dev/null
fi

echo "4/4 Production settings (.env with new secrets) ..."
hex() { openssl rand -hex "$1"; }
PG_PASS="$(hex 24)"
REDIS_PASS="$(hex 24)"
MEILI_KEY="$(hex 24)"
OVERRIDES="$WORK/overrides.env"
cat > "$OVERRIDES" <<EOF
NODE_ENV=production
SITE_DOMAIN=__DOMAIN__
FRONTEND_URL=https://__DOMAIN__
BACKEND_URL=https://__DOMAIN__
APP_PUBLIC_URL=https://__DOMAIN__
CORS_ORIGIN=https://__DOMAIN__
LOCAL_STORAGE_BASE_URL=https://__DOMAIN__
STORAGE_DRIVER=local
KDL_SKIP_INSTALL_WIZARD=1
JWT_SECRET=$(hex 48)
JWT_REFRESH_SECRET=$(hex 48)
SEED_ADMIN_PASSWORD=$(hex 12)
POSTGRES_USER=postgres
POSTGRES_DB=kdl_db
POSTGRES_PASSWORD=$PG_PASS
DATABASE_URL=postgresql://postgres:$PG_PASS@postgres:5432/kdl_db
REDIS_PASSWORD=$REDIS_PASS
REDIS_URL=redis://:$REDIS_PASS@redis:6379
MEILISEARCH_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=$MEILI_KEY
MEILISEARCH_API_KEY=$MEILI_KEY
MEILI_SEARCH_API_KEY=$MEILI_KEY
EOF
# Start from the local .env (keeps APP_ENCRYPTION_KEY, which the stored data needs, and any API keys),
# replace the keys above, and add the ones it lacks.
awk -F= '
  NR == FNR { if ($1 != "") { val[$1] = $0; order[++n] = $1 }; next }
  /^[A-Za-z_][A-Za-z0-9_]*=/ { k = $1; if (k in val) { if (!(k in done)) print val[k]; done[k] = 1; next } }
  { print }
  END { for (i = 1; i <= n; i++) if (!(order[i] in done)) print val[order[i]] }
' "$OVERRIDES" .env > "$B/env.production"
chmod 600 "$B/env.production"

tar -C "$WORK" -czf "$OUT/gdg-vizag-bundle.tar.gz" gdg-bundle
chmod 600 "$OUT/gdg-vizag-bundle.tar.gz"
echo
echo "Done: $OUT/gdg-vizag-bundle.tar.gz ($(du -h "$OUT/gdg-vizag-bundle.tar.gz" | cut -f1))"
echo "Upload this file to the server (SSH window -> Upload file)."
echo "GitHub deploy key (public): $OUT/keys/github_deploy.pub"
echo "GitHub secret GCP_SSH_KEY:  $OUT/keys/ci_deploy"
