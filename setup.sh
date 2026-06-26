#!/bin/bash

# ============================================================
# KDL Starter Kit — Setup Script
# Kalam Dream Labs Pvt Ltd
#
# Run this ONCE before starting Paperclip AI agents.
# It handles everything except 3 web signups (listed below).
#
# Prerequisites (create accounts first — takes ~10 min):
#   1. OpenRouter  → https://openrouter.ai  → get API key
#   2. Sentry      → https://sentry.io      → create project → get DSN
#   3. Gmail       → Google Account → Security → App Passwords → create one
#
# Then run:  bash setup.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     KDL Starter Kit — Setup Script       ║${NC}"
echo -e "${CYAN}║     Kalam Dream Labs Pvt Ltd              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. CHECK PREREQUISITES ──────────────────────────────────

echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}✗ Docker not found. Install from https://docker.com and re-run.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Docker found${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Install v20 LTS from https://nodejs.org and re-run.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Node.js found ($(node -v))${NC}"

if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}  pnpm not found — installing...${NC}"
  npm install -g pnpm
fi
echo -e "${GREEN}  ✓ pnpm found${NC}"

# ── 2. COLLECT CREDENTIALS ─────────────────────────────────

echo ""
echo -e "${YELLOW}[2/5] Collecting credentials (you need 3 values from web signups)...${NC}"
echo ""
echo -e "  Have these ready before continuing:"
echo -e "  ${CYAN}OpenRouter API key${NC}  → https://openrouter.ai"
echo -e "  ${CYAN}Sentry DSN${NC}          → https://sentry.io"
echo -e "  ${CYAN}Gmail App Password${NC}  → Google Account → Security → App Passwords"
echo ""

read -p "  OpenRouter API key (sk-or-...): " OPENROUTER_API_KEY
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo -e "${RED}  ✗ OpenRouter key required. Re-run after getting it.${NC}"
  exit 1
fi

read -p "  Sentry DSN (https://...@sentry.io/...): " SENTRY_DSN
if [ -z "$SENTRY_DSN" ]; then
  echo -e "${YELLOW}  ⚠ Sentry DSN skipped — error tracking will be disabled.${NC}"
  SENTRY_DSN="your_sentry_dsn_here"
fi

read -p "  Gmail address for SMTP (e.g. you@gmail.com): " SMTP_USER
read -p "  Gmail App Password (16-char code from Google): " SMTP_PASS
if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
  echo -e "${YELLOW}  ⚠ SMTP skipped — email features will not work.${NC}"
  SMTP_USER="your@gmail.com"
  SMTP_PASS="your_app_password"
fi

# ── 3. GENERATE SECRETS ────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/5] Generating secrets...${NC}"

JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
echo -e "${GREEN}  ✓ JWT_SECRET generated${NC}"

# ── 4. WRITE .env ──────────────────────────────────────────

echo ""
echo -e "${YELLOW}[4/5] Writing .env file...${NC}"

cat > .env << EOF
# ── Core ─────────────────────────────────────────────
NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
AI_SERVICES_URL=http://localhost:5000
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

# ── Database ─────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kdl_db

# ── Redis ────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── AI Brains ─────────────────────────────────────────
# Main brain — Claude (via Paperclip AI subscription — no key needed here)
ANTHROPIC_API_KEY=via_paperclip_subscription

# Budget brain — OpenRouter (fill your key below)
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
OPENROUTER_DEFAULT_MODEL=moonshot-ai/moonshot-v1-32k
OPENROUTER_DAILY_BUDGET=2.00

# ── Voice (Whisper only) ──────────────────────────────
OPENAI_API_KEY=sk-your-whisper-key-here

# ── ChromaDB ─────────────────────────────────────────
CHROMADB_URL=http://localhost:8000

# ── Storage (MinIO) ───────────────────────────────────
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=kdl-media

# ── Search (MeiliSearch) ──────────────────────────────
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=masterKey

# ── Payments ─────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# ── Email (SMTP) ──────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=KDL Starter Kit <noreply@kdl.com>

# ── Vault ────────────────────────────────────────────
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=dev-root-token

# ── Observability ─────────────────────────────────────
SENTRY_DSN=${SENTRY_DSN}
EOF

echo -e "${GREEN}  ✓ .env file written${NC}"

# Also write .env.example (same content but values replaced with placeholders)
sed \
  -e "s|${JWT_SECRET}|change_this_min_64_chars|" \
  -e "s|${OPENROUTER_API_KEY}|your_openrouter_api_key|" \
  -e "s|${SENTRY_DSN}|your_sentry_dsn|" \
  -e "s|${SMTP_USER}|your@gmail.com|" \
  -e "s|${SMTP_PASS}|your_app_password|" \
  .env > .env.example
echo -e "${GREEN}  ✓ .env.example written${NC}"

# ── 5. START DOCKER SERVICES ───────────────────────────────

echo ""
echo -e "${YELLOW}[5/5] Starting infrastructure Docker services...${NC}"
echo -e "  (postgres, redis, minio, meilisearch, chromadb)"
echo ""

# Write docker-compose.infra.yml — infrastructure only (no app containers yet)
cat > docker-compose.infra.yml << 'DOCKEREOF'
services:
  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kdl_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  meilisearch:
    image: getmeili/meilisearch:v1.7
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: masterKey
    ports:
      - "7700:7700"
    volumes:
      - meilidata:/meili_data

  chromadb:
    image: chromadb/chroma
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - chromadata:/chroma/chroma

volumes:
  pgdata:
  miniodata:
  meilidata:
  chromadata:
DOCKEREOF

docker compose -f docker-compose.infra.yml up -d

echo ""
echo -e "${GREEN}  ✓ Infrastructure services started${NC}"
echo ""

# ── DONE ──────────────────────────────────────────────────

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              Setup Complete!              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Folder scaffold ready${NC}"
echo -e "${GREEN}✓ .env file written${NC}"
echo -e "${GREEN}✓ Docker infrastructure running${NC}"
echo ""
echo -e "${YELLOW}── TWO THINGS LEFT (manual, 5 min each) ──${NC}"
echo ""
echo -e "  ${CYAN}1. Install Claude Code plugins${NC}"
echo -e "     Open Claude Code in this folder and run:"
echo -e "     ${GREEN}bash install-plugins.sh${NC}"
echo -e "     (it will print the commands to paste into Claude Code)"
echo ""
echo -e "  ${CYAN}2. Set up Paperclip agents${NC}"
echo -e "     See .agents/paperclip-setup.md for copy-paste prompts"
echo ""
echo -e "${YELLOW}── SERVICES RUNNING ──${NC}"
echo -e "  PostgreSQL  → localhost:5432"
echo -e "  Redis       → localhost:6379"
echo -e "  MinIO       → localhost:9000  (console: localhost:9001)"
echo -e "  MeiliSearch → localhost:7700"
echo -e "  ChromaDB    → localhost:8000"
echo ""
echo -e "  Stop services:   docker compose -f docker-compose.infra.yml down"
echo -e "  View logs:       docker compose -f docker-compose.infra.yml logs -f"
echo ""
