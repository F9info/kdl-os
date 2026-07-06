# Developer Setup Guide — KDL Starter Kit

This guide gets a new developer running the full stack locally from scratch.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x | `node -v` to confirm |
| npm | ≥ 10 | Bundled with Node 20 |
| pnpm | latest | `npm install -g pnpm` (monorepo root tooling) |
| Docker + Compose | any recent | Required for all infra services |
| PostgreSQL | via Docker | Host port 5433 |
| Redis | via Docker | Host port 6380 |

---

## 1. Clone and configure environment

```bash
git clone <repo-url>
cd kdl-starter-kit

cp .env.example .env
```

Open `.env` and fill in all values marked as required. At minimum:

- `JWT_SECRET` — generate with `openssl rand -base64 48`
- `OPENROUTER_API_KEY` — from your OpenRouter dashboard
- `SMTP_USER` / `SMTP_PASS` — Gmail app password or equivalent
- `ANTHROPIC_API_KEY` — from Anthropic console (required for CRITICAL/HIGH AI tasks)

See `docs/ENV_REFERENCE.md` for full variable descriptions.

---

## 2. Start infrastructure services

The project uses a separate Docker Compose file for long-running infra (postgres, redis, minio, meilisearch, chromadb). These only need to start once and persist between restarts.

```bash
docker compose -f docker-compose.infra.yml up -d
```

Verify all services are healthy:

```bash
docker compose -f docker-compose.infra.yml ps
```

All should show `healthy` or `running`.

---

## 3. Backend setup

```bash
cd backend
npm install
```

The `postinstall` script runs `prisma generate` automatically.

### Run database migrations

```bash
npx prisma migrate dev
# npm alias: npm run db:migrate
```

Name the migration when prompted (e.g. `init`). Creates all 4 tables.

### Seed the database

```bash
node prisma/seed.js
# npm alias: npm run db:seed
```

Creates the default SUPER_ADMIN account:

| Field | Value |
|-------|-------|
| Email | `admin@kdl.com` |
| Password | `Admin@123` |
| Role | `SUPER_ADMIN` |

The seed uses `upsert` — safe to re-run.

### Module plugin system

The module seeder runs automatically as part of `node prisma/seed.js`. It scans every `backend/src/modules/*/module.json` where `core: true` and upserts a DB row with `status: ENABLED`, then registers the module's permission entries. Re-running seed is safe (all operations use `upsert`).

When the backend starts (`npm run dev` or `node src/index.js`), `loadModules(app)` scans `backend/src/modules/*/module.json` for non-core modules and auto-mounts each one's `routes.js` at the declared `apiPrefix` behind a `moduleGate` middleware. A broken manifest is logged and skipped — it never takes the backend down.

Core modules (auth, users, settings, media, modules, user-management, types, setting-fields, categories) are always mounted directly in `index.js`; they do not go through `loadModules`.

---

### Create log directory

```bash
mkdir -p logs
```

Winston writes to `backend/logs/combined.log` and `backend/logs/error.log`.

### Start backend

```bash
npm run dev     # development (nodemon hot reload)
node src/index.js  # production / one-shot
```

Expected output:
```
{"level":"info","message":"Backend running on port 4000"}
{"level":"info","message":"Redis connected"}
```

Health check: `curl http://localhost:4000/health`

---

## 4. Frontend setup

```bash
cd frontend
npm install
```

### Start frontend

```bash
npm run dev
```

Opens on `http://localhost:3000`. Login with `admin@kdl.com / Admin@123`.

The frontend proxies API calls through `lib/axios.ts` → `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

---

## 5. AI Services setup

```bash
cd ai-services
npm install
```

Copy and configure the AI services environment:

```bash
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, OPENROUTER_API_KEY, JWT_SECRET (same as backend)
```

### Start AI services

```bash
node src/index.js
```

Health check: `curl http://localhost:5000/health`

---

## Docker Compose — Full Stack

### Local development run

```bash
docker compose up --build
```

All 9 services start: postgres, redis, minio, meilisearch, chromadb, backend, frontend, ai-services, nginx.

Access via Nginx at `http://localhost` (port 80).

### Production run

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Production overrides:
- `restart: always` on all services
- `NODE_ENV: production`
- No host ports exposed (except nginx :80)

---

## Port Reference

| Service | Host Port | Container Port | Purpose |
|---------|-----------|---------------|---------|
| Backend (Express) | 4000 | 4000 | API |
| Frontend (Next.js) | 3000 | 3000 | UI |
| AI Services | 5000 | 5000 | LLM layer |
| PostgreSQL | 5433 | 5432 | Primary DB |
| Redis | 6380 | 6379 | Cache + queues |
| MinIO API | 9000 | 9000 | Object storage |
| MinIO Console | 9001 | 9001 | Admin UI |
| MeiliSearch | 7700 | 7700 | Full-text search |
| ChromaDB | 8000 | 8000 | Vector store |
| Nginx | 80 | 80 | Reverse proxy |

> Ports 5433 and 6380 are intentionally non-standard — the F9 Tech stack occupies 5432 and 6379 on the same machine.

---

## Environment Variables Quick Reference

See `docs/ENV_REFERENCE.md` for full descriptions.

**Minimum required to run locally:**

| Service | Variables |
|---------|-----------|
| Backend | `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `SMTP_USER`, `SMTP_PASS` |
| Frontend | `NEXT_PUBLIC_API_URL` (default: `http://localhost:4000`) |
| AI Services | `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `JWT_SECRET`, `REDIS_URL`, `CHROMA_URL` |
| Docker infra | `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `MEILI_MASTER_KEY` |

---

## Common Issues

**`prisma generate` not found**

Run `npm install` inside `backend/` — Prisma CLI is a devDependency there.

**`ECONNREFUSED redis://localhost:6380`**

Infra services not running: `docker compose -f docker-compose.infra.yml up -d`

**`P1001: Can't reach database server`**

Same cause — postgres container not running or unhealthy.

**`logs/` directory missing → Winston silent failure**

```bash
mkdir -p backend/logs
```

**Backend starts but AI chat returns 503**

OpenRouter daily budget exhausted (`$2.00/day`). Check `MANUAL_TASKS.md` for logged requests. Reset next UTC midnight.

**Frontend shows spinner forever after page refresh**

Zustand auth rehydration issue. Ensure `onRehydrateStorage: () => (state) => { state?.setLoading(false) }` is in the persist config (should already be present from Phase 4 fixes).

**Prisma migration fails on `init`**

Database may already exist from a previous run. Check with:
```bash
npx prisma migrate status
```

**MinIO media URLs expire (403 after 7 days)**

Expected behavior — presigned URLs are generated fresh on every API response. Stored URLs in old DB records are expired; re-fetch via the API to get a new URL.
