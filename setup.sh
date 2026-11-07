#!/usr/bin/env bash
# KDL OS: one-command setup for a fresh clone.
#
#   ./setup.sh              create .env (if missing), build and start everything, seed, print the sign-ins
#   ./setup.sh --env-only   only create .env, then stop
#
# Needs Git, Docker Desktop (running) and OpenSSL. No accounts or API keys.
# Safe to run again: an existing .env is never overwritten and existing users are never touched.
# This replaces the old bootstrap script, which wrote files the compose stack does not use and overwrote
# tracked files (it is still in git history).

set -euo pipefail
cd "$(dirname "$0")"

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

make_env() {
  if [ -f .env ]; then
    say ".env already exists, leaving it as it is."
    return
  fi
  need openssl "It is already on Mac and Linux."
  local pg redis minio
  pg=$(openssl rand -hex 16)
  redis=$(openssl rand -hex 16)
  minio=$(openssl rand -hex 16)
  # umask first, so the file is never readable by others, even for a moment.
  (
    umask 077
    cat > .env <<EOF
NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=http://localhost
BACKEND_URL=http://localhost:4000
AI_SERVICES_URL=http://localhost:5000
CORS_ORIGIN=http://localhost,http://localhost:3000,http://localhost:3001
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
SEED_ADMIN_EMAIL=admin@kdl.com
SEED_ADMIN_PASSWORD=$(openssl rand -hex 16)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$pg
POSTGRES_DB=kdl_db
DATABASE_URL=postgresql://postgres:$pg@localhost:5433/kdl_db
REDIS_PASSWORD=$redis
REDIS_URL=redis://:$redis@localhost:6380
MINIO_ROOT_USER=kdl_minio
MINIO_ROOT_PASSWORD=$minio
MINIO_ACCESS_KEY=kdl_minio
MINIO_SECRET_KEY=$minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=kdl-media
MEILISEARCH_HOST=http://localhost:7700
MEILI_MASTER_KEY=$(openssl rand -hex 24)
MEILISEARCH_API_KEY=replace-after-first-boot
MEILI_SEARCH_API_KEY=replace-after-first-boot
CHROMADB_URL=http://localhost:8000
ANTHROPIC_API_KEY=local
OPENROUTER_API_KEY=local
EOF
  )
  say "Created .env with new random passwords. Never share or commit it."
}

wait_for_backend() {
  say "Waiting for the backend to be healthy (the first build can take 10 to 20 minutes)..."
  for _ in $(seq 1 180); do
    if docker compose ps backend --format '{{.Status}}' 2>/dev/null | grep -q '(healthy)'; then
      return 0
    fi
    sleep 5
  done
  die "The backend did not become healthy in 15 minutes. Run: docker compose logs backend"
}

main() {
  make_env
  [ "${1:-}" = "--env-only" ] && exit 0

  need git "Install it from https://git-scm.com."
  need docker "Install Docker Desktop from https://www.docker.com/products/docker-desktop and start it."
  docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker Desktop and run this again."
  docker compose version >/dev/null 2>&1 || die "Docker Compose is missing. Update Docker Desktop."

  say "Building and starting KDL OS..."
  docker compose up -d --build
  wait_for_backend

  say "Creating the users and starter data..."
  local out
  out=$(docker compose exec -T backend node prisma/seed.js 2>&1) || { printf '%s\n' "$out" >&2; die "The seed failed. See the output above."; }

  local admin_email admin_password
  # An older .env may lack these two lines; under pipefail a failed grep would end the script, so default them.
  admin_email=$(grep -E '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2- || true)
  [ -n "$admin_email" ] || admin_email=admin@kdl.com
  admin_password=$(grep -E '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2- || true)
  # An older .env may not have it. The compose file then falls back to its development default.
  [ -n "$admin_password" ] || admin_password="kdl-dev-seed-password (the Docker development default; use only on your own computer)"

  say ""
  say "KDL OS is running: http://localhost/login"
  say ""
  say "Sign-ins (each one asks you to choose a new password the first time):"
  say "  Super Admin  ${admin_email}  /  ${admin_password}"
  # The seed prints a one-time password for each new Developer and Admin user. Show those lines as they are.
  printf '%s\n' "$out" | grep -E 'Seeded (developer|admin) user:|Generated one-time password for the (developer|admin) user' | sed 's/^/  /' || true
  say ""
  say "Passwords are shown once. Existing users and an existing .env are never changed when you run this again."
}

main "$@"
