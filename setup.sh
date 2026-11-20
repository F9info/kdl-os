#!/usr/bin/env bash
# KDL OS: one-command setup for a fresh clone.
#
#   ./setup.sh              create .env (if missing), build and start everything, seed, print the sign-ins
#   ./setup.sh --env-only   only create .env, then stop
#
# Options (only used when .env is created; all have safe defaults):
#   --name <project>   Docker project name. Default: this folder's name (e.g. acme-crm).
#   --db <name>        database name. Default: the project name with - turned into _ (acme-crm -> acme_crm).
#   --block <N>        port block. Default: the first block whose ports are all free.
#                      0 = the classic ports (http://localhost, 3001, 4000, 5433, ...).
#                      N >= 1 = ports 10000+N*100 .. +12 (block 1: http://localhost:10100).
# Several projects on one machine: docs/MULTI_PROJECT_LOCAL.md.
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

OPT_NAME=""
OPT_BLOCK=""
OPT_DB=""
ENV_ONLY=0

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --env-only) ENV_ONLY=1 ;;
      --name) [ $# -ge 2 ] || die "--name needs a value"; OPT_NAME="$2"; shift ;;
      --name=*) OPT_NAME="${1#--name=}" ;;
      --block) [ $# -ge 2 ] || die "--block needs a value"; OPT_BLOCK="$2"; shift ;;
      --block=*) OPT_BLOCK="${1#--block=}" ;;
      --db) [ $# -ge 2 ] || die "--db needs a value"; OPT_DB="$2"; shift ;;
      --db=*) OPT_DB="${1#--db=}" ;;
      *) die "Unknown option: $1 (see the top of setup.sh)" ;;
    esac
    shift
  done
}

# --- Project name ------------------------------------------------------------------------------
# Docker project names: lowercase letters, digits, '-' and '_', starting with a letter or digit.
slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9_-]/-/g' -e 's/^[^a-z0-9]*//' -e 's/-\{2,\}/-/g' -e 's/-$//'
}

# Refuse a name another folder on this machine already uses: same name = shared containers and data.
check_name_free() {
  local name="$1" here other
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 || return 0
  here=$(pwd -P)
  other=$(docker ps -a --filter "label=com.docker.compose.project=$name" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}' 2>/dev/null | sort -u | grep -vxF "$here" | head -1 || true)
  [ -z "$other" ] || die "The Docker project name '$name' is already used by $other. Two projects with one name share containers and data. Run again with --name <another-name>."
  if docker volume inspect "${name}_pgdata" >/dev/null 2>&1; then
    say "Note: a database volume '${name}_pgdata' already exists on this machine and will be reused."
    say "      If it belongs to another project, stop now (Ctrl+C) and run again with --name <another-name>."
  fi
}

# --- Ports -------------------------------------------------------------------------------------
# Block 0 = the classic ports. Block N >= 1 = 10000+N*100 + offset, in this order:
PORT_KEYS="HTTP FRONTEND BACKEND AI POSTGRES REDIS MINIO MINIO_CONSOLE MEILI CHROMA SMTP MAIL_UI CLAMAV"
classic_port() {
  case "$1" in
    HTTP) echo 80 ;; FRONTEND) echo 3001 ;; BACKEND) echo 4000 ;; AI) echo 5001 ;;
    POSTGRES) echo 5433 ;; REDIS) echo 6380 ;; MINIO) echo 9002 ;; MINIO_CONSOLE) echo 9003 ;;
    MEILI) echo 7700 ;; CHROMA) echo 8000 ;; SMTP) echo 1025 ;; MAIL_UI) echo 8025 ;; CLAMAV) echo 3310 ;;
  esac
}
port_for() { # <block> <key>
  if [ "$1" = 0 ]; then classic_port "$2"; return; fi
  local i=0 k
  for k in $PORT_KEYS; do
    [ "$k" = "$2" ] && { echo $((10000 + $1 * 100 + i)); return; }
    i=$((i + 1))
  done
}

# Ports taken now (listening) or claimed by any container, running or stopped, of any project.
TAKEN_PORTS=""
collect_taken_ports() {
  local listening="" claimed=""
  if command -v lsof >/dev/null 2>&1; then
    listening=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{n=split($9,a,":"); print a[n]}' || true)
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    local ids
    ids=$(docker ps -aq 2>/dev/null || true)
    [ -z "$ids" ] || claimed=$(docker inspect -f '{{range $p, $b := .HostConfig.PortBindings}}{{range $b}}{{.HostPort}} {{end}}{{end}}' $ids 2>/dev/null | tr ' ' '\n' || true)
  fi
  TAKEN_PORTS=$(printf '%s\n%s\n' "$listening" "$claimed" | grep -E '^[0-9]+$' | sort -un | tr '\n' ' ')
}
block_free() {
  local k p
  for k in $PORT_KEYS; do
    p=$(port_for "$1" "$k")
    case " $TAKEN_PORTS " in *" $p "*) return 1 ;; esac
  done
  return 0
}
# Machine-wide list of claimed blocks, so two projects set up before either has started (no
# containers yet, ports look free) still get different blocks. One line per project:
#   <block><TAB><project name><TAB><folder>
# A line whose folder no longer exists is ignored. Delete a line to release its block.
REGISTRY="${KDL_REGISTRY:-$HOME/.kdl/port-blocks}"
registry_lines_of_others() { # lines of other folders that still exist
  local here b n p
  here=$(pwd -P)
  [ -f "$REGISTRY" ] || return 0
  while IFS="$(printf '\t')" read -r b n p; do
    [ -n "$p" ] && [ "$p" != "$here" ] && [ -d "$p" ] && printf '%s\t%s\t%s\n' "$b" "$n" "$p"
  done < "$REGISTRY"
  return 0
}
# awk reads every line (no early exit): under pipefail an early exit would kill the script with SIGPIPE.
block_claimed() { registry_lines_of_others | awk -F'\t' -v b="$1" '$1==b{f=1} END{exit !f}'; }
name_claimed_by() { registry_lines_of_others | awk -F'\t' -v n="$1" '$2==n && !f{print $3; f=1}' || true; }
registry_record() { # <block> <name>
  local here tmp
  here=$(pwd -P)
  mkdir -p "$(dirname "$REGISTRY")"
  tmp="$REGISTRY.tmp.$$"
  { [ -f "$REGISTRY" ] && awk -F'\t' -v p="$here" '$3!=p' "$REGISTRY"; printf '%s\t%s\t%s\n' "$1" "$2" "$here"; } > "$tmp"
  mv "$tmp" "$REGISTRY"
}

pick_block() {
  collect_taken_ports
  if [ -n "$OPT_BLOCK" ]; then
    case "$OPT_BLOCK" in ''|*[!0-9]*) die "--block must be a number (0 to 50)" ;; esac
    [ "$OPT_BLOCK" -le 50 ] || die "--block must be 0 to 50"
    block_free "$OPT_BLOCK" || say "Warning: some ports of block $OPT_BLOCK are already in use on this machine."
    block_claimed "$OPT_BLOCK" && say "Warning: block $OPT_BLOCK is already claimed in $REGISTRY by another project."
    BLOCK="$OPT_BLOCK"; return
  fi
  local n
  for n in $(seq 0 50); do
    block_free "$n" && ! block_claimed "$n" && { BLOCK="$n"; return; }
  done
  die "No free port block found (0 to 50). Pass --block <N>."
}

make_env() {
  if [ -f .env ]; then
    say ".env already exists, leaving it as it is."
    grep -qE '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null || \
      say "Note: this .env has no COMPOSE_PROJECT_NAME, so Docker uses the name in docker-compose.yml. See docs/MULTI_PROJECT_LOCAL.md if another project on this machine uses it too."
    return
  fi
  need openssl "It is already on Mac and Linux."

  local name
  name=$(slugify "${OPT_NAME:-$(basename "$(pwd -P)")}")
  [ -n "$name" ] || die "Could not make a Docker project name from '${OPT_NAME:-$(basename "$(pwd -P)")}'. Pass --name <project>."
  check_name_free "$name"
  local owner
  owner=$(name_claimed_by "$name")
  [ -z "$owner" ] || die "The Docker project name '$name' is already claimed by $owner (in $REGISTRY). Run again with --name <another-name>."

  # Database name: lowercase letters, digits and _ only (safe in any SQL without quoting).
  local db
  db=$(printf '%s' "${OPT_DB:-$name}" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9_]/_/g' -e 's/^[^a-z_]*//' -e 's/_\{2,\}/_/g' | cut -c1-63)
  [ -n "$db" ] || die "Could not make a database name from '${OPT_DB:-$name}'. Pass --db <name> (letters, digits, _)."
  pick_block

  local P_HTTP P_FRONTEND P_BACKEND P_AI P_POSTGRES P_REDIS P_MEILI P_CHROMA site
  P_HTTP=$(port_for "$BLOCK" HTTP); P_FRONTEND=$(port_for "$BLOCK" FRONTEND)
  P_BACKEND=$(port_for "$BLOCK" BACKEND); P_AI=$(port_for "$BLOCK" AI)
  P_POSTGRES=$(port_for "$BLOCK" POSTGRES); P_REDIS=$(port_for "$BLOCK" REDIS)
  P_MEILI=$(port_for "$BLOCK" MEILI); P_CHROMA=$(port_for "$BLOCK" CHROMA)
  if [ "$P_HTTP" = 80 ]; then site="http://localhost"; else site="http://localhost:$P_HTTP"; fi

  local port_lines="" k
  for k in $PORT_KEYS; do
    port_lines="${port_lines}KDL_PORT_${k}=$(port_for "$BLOCK" "$k")
"
  done

  local pg redis minio
  pg=$(openssl rand -hex 16)
  redis=$(openssl rand -hex 16)
  minio=$(openssl rand -hex 16)
  # umask first, so the file is never readable by others, even for a moment.
  (
    umask 077
    cat > .env <<EOF
# Docker project name and port block (docs/MULTI_PROJECT_LOCAL.md). Unique per project on this machine.
COMPOSE_PROJECT_NAME=$name
# Port block $BLOCK
${port_lines}NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=$site
BACKEND_URL=http://localhost:$P_BACKEND
AI_SERVICES_URL=http://localhost:5000
CORS_ORIGIN=$site,http://localhost:3000,http://localhost:$P_FRONTEND
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
SEED_ADMIN_EMAIL=admin@kdl.com
SEED_ADMIN_PASSWORD=$(openssl rand -hex 16)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$pg
POSTGRES_DB=$db
DATABASE_URL=postgresql://postgres:$pg@localhost:$P_POSTGRES/$db
REDIS_PASSWORD=$redis
REDIS_URL=redis://:$redis@localhost:$P_REDIS
MINIO_ROOT_USER=kdl_minio
MINIO_ROOT_PASSWORD=$minio
MINIO_ACCESS_KEY=kdl_minio
MINIO_SECRET_KEY=$minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=kdl-media
MEILISEARCH_HOST=http://localhost:$P_MEILI
MEILI_MASTER_KEY=$(openssl rand -hex 24)
MEILISEARCH_API_KEY=replace-after-first-boot
MEILI_SEARCH_API_KEY=replace-after-first-boot
CHROMADB_URL=http://localhost:$P_CHROMA
ANTHROPIC_API_KEY=local
OPENROUTER_API_KEY=local
EOF
  )
  say "Created .env with new random passwords. Never share or commit it."
  registry_record "$BLOCK" "$name"
  say "Docker project '$name', database '$db', port block $BLOCK (claimed in $REGISTRY)."
  say "After docker compose up -d --build:"
  say "  Installation wizard: http://localhost:$P_FRONTEND/install"
  say "  Admin app:           http://localhost:$P_FRONTEND   Website (nginx): $site"
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

# Lighter local footprint (memory caps) so several projects fit on one
# machine. docker-compose.override.yml is git-ignored and never used by a server.
make_override() {
  if [ -f docker-compose.override.yml ]; then
    say "docker-compose.override.yml already exists, leaving it as it is."
  elif [ -f docker-compose.override.example.yml ]; then
    cp docker-compose.override.example.yml docker-compose.override.yml
    say "Created docker-compose.override.yml (local memory caps)."
  fi
}

site_url() {
  local http
  http=$(grep -E '^KDL_PORT_HTTP=' .env 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$http" ] || [ "$http" = 80 ]; then echo "http://localhost"; else echo "http://localhost:$http"; fi
}

main() {
  parse_args "$@"
  make_env
  make_override
  [ "$ENV_ONLY" = 1 ] && exit 0

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
  say "KDL OS is running: $(site_url)/login   (Docker project: $(docker compose config 2>/dev/null | sed -n 's/^name: //p'))"
  say ""
  say "Sign-ins (each one asks you to choose a new password the first time):"
  say "  Super Admin  ${admin_email}  /  ${admin_password}"
  # The seed prints a one-time password for each new Developer and Admin user. Show those lines as they are.
  printf '%s\n' "$out" | grep -E 'Seeded (developer|admin) user:|Generated one-time password for the (developer|admin) user' | sed 's/^/  /' || true
  say ""
  say "Passwords are shown once. Existing users and an existing .env are never changed when you run this again."
}

main "$@"
