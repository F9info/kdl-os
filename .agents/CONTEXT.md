# KDL Starter Kit — Project Context

Last updated: 2026-07-03
Current phase: Phase 6 COMPLETE — All phases done

---

## What Has Been Done

### Phase 1 — Root Infrastructure (COMPLETE)
- Working directory created: ~/Documents/Claude/Projects/F9 Tech/kdl-starter-kit/
- .env written with all credentials (OpenRouter, SMTP, Sentry, JWT_SECRET)
- Infrastructure Docker services running: postgres (5433), redis (6380), minio (9000), meilisearch (7700), chromadb (8000)
- docker-compose.yml — 9 services, healthchecks, env var substitution (no hardcoded secrets)
- docker-compose.prod.yml — production variant
- docker-compose.infra.yml — infra-only (already running)
- infra/nginx/nginx.conf — reverse proxy routes
- 34 scaffold directories + .gitkeep files
- Planning docs: CLAUDE.md, AGENTS.md, KDL_RepoDocs.md, KDL_DevEnvironment.md, MANUAL_TASKS.md
- docs/ENV_REFERENCE.md — 33 env vars + Docker vars documented

### Phase 2 — Backend Foundation (COMPLETE)
- prisma/schema.prisma — 4 tables (users, refresh_tokens, app_settings, media), Role enum, cuid IDs
- prisma/seed.js — SUPER_ADMIN admin@kdl.com / Admin@123, upsert-safe
- backend/package.json — "type":"module", all deps, npm scripts, postinstall prisma generate
- backend/src/config/ — database, redis, minio, meilisearch, chromadb singletons
- backend/src/middleware/ — auth (JWT), rbac (requireRole), validate (Zod), upload (multer 10MB), errorHandler
- backend/src/shared/ — email/storage/search services, BullMQ email queue+worker, logger, response, pagination utils
- backend/src/index.js — Express 5, helmet/cors/ratelimit, stub routes, graceful shutdown
- backend/src/modules/*/routes.js — stub routes for auth, users, settings, media
- docs/SETUP.md — developer onboarding guide for local backend setup
- docs/ENV_REFERENCE.md — updated with Docker-specific vars (POSTGRES_USER, MINIO_ROOT_USER, MEILI_MASTER_KEY, etc.)

### Phase 3 — Backend Module CRUD (COMPLETE)
- auth/ — register, login, refresh (token rotation), logout; bcrypt cost 12; sha256 token hashing
- users/ — list/get/update/soft-delete; ADMIN cannot escalate to SUPER_ADMIN
- settings/ — public GET (no auth), admin GET (optionalAuthenticate); CRUD with role guards
- media/ — upload (multer 10MB, MIME whitelist), list, delete; presigned URLs generated on-demand (not stored)
- Security fixes: optionalAuthenticate middleware, refresh token rotation, presigned URL fix

### Phase 4 — Frontend (COMPLETE)
- Next.js 15 App Router + TypeScript strict
- Auth: access token in Zustand memory (not localStorage); refresh token in httpOnly cookie
- Pages: login, register, forgot-password stub, dashboard, users, settings
- Components: DataTable, Modal, ConfirmDialog, Pagination, StatusBadge, FileUpload, ErrorAlert + 17 shadcn/ui
- Zustand onRehydrateStorage fix (isLoading reset), QueryClient in useState, isSuperAdmin gate on role dropdown
- tsc --noEmit exit 0 ✅

### Phase 5 — AI Services (COMPLETE)
- ai-services/ — Express on port 5000, JWT auth, /health, /api/ai/chat, /api/ai/embed, /api/ai/transcribe (501 stub)
- Two-brain orchestrator: Claude (CRITICAL/HIGH) + OpenRouter (MEDIUM/LOW, $2/day Redis budget)
- RAG chain: ChromaDB knowledge base + context manager (Redis TTL 3600, max 50 messages)
- Governance: PII scrubber, audit logger (Redis LPUSH ai:audit:log, LTRIM 1000)
- Agents: BaseAgent (maxIterations=10 → BLOCKERS.md), ResearchAgent, ContentAgent, TaskAgent
- Workflows: BaseWorkflow (maxIterations=20), deterministic, non-deterministic
- Security: helmet, cors, rate-limit (100 req/15min) added; error handler guards err.message by NODE_ENV
- node --check on all 30 source files: ALL OK ✅

### Phase 6 — Final Documentation (COMPLETE)
- README.md — project overview, tech stack, quick start, service URLs, default credentials, doc links, phase status
- docs/SETUP.md — full-stack local dev (backend + frontend + ai-services), Docker Compose local + prod, Prisma migrate + seed, env quick-reference, common issues
- docs/API_REFERENCE.md (NEW) — all endpoints: backend (health, auth, users, settings, media) + AI services (health, chat, embed, transcribe)
- docs/ENV_REFERENCE.md — added Phase 5 AI services vars: AI_PORT, ANTHROPIC_API_KEY, OPENROUTER_BASE_URL, CHROMA_URL; clarified CHROMADB_URL vs CHROMA_URL
- CLAUDE.md — "What Is NOT Built Yet" updated to reflect all phases complete + open MEDIUM findings

## What Has NOT Been Done


- Whisper transcription (501 stub)
- Forgot-password backend endpoint

## Key Decisions

- PostgreSQL on host port 5433 (F9 Tech stack occupies 5432)
- Redis on host port 6380 (F9 Tech stack occupies 6379)
- No ANTHROPIC_API_KEY set — Claude via Paperclip subscription
- OpenRouter model: moonshot-ai/moonshot-v1-32k, budget $2.00/day
- ES Modules throughout backend ("type":"module" in package.json)
- Prisma Client imported from config/database.js singleton only
