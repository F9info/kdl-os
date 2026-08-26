# KDL Starter Kit — Development Environment
**Kalam Dream Labs Pvt Ltd**
**Version:** v1.0
**Subtitle:** Tech stack, services, schema, folder structure, and environment variables
**Date:** June 2026
**Status:** Pending Approval

---

## About This Document

This document covers everything needed to set up and understand the development environment for the KDL Starter Kit. It includes the full tech stack (AI services, frontend, backend, infrastructure), OpenRouter setup, the database schema, folder structure, Docker services, and all environment variables.

**See also:** KDL_RepoDocs.md — Agent architecture, orchestration, phases, prompting, and loop engineering

---

## Part E — Tech Stack

### E1. AI Services Layer

| Technology | Role | Brain |
|-----------|------|-------|
| **Claude** (Anthropic) | Main brain — architecture, security, complex decisions | Main |
| **OpenRouter API** | Budget brain — model-agnostic (Kimi, Mistral, Llama, etc.) | Budget |
| **LangChain.js** | LLM orchestration layer — works with both brains | — |
| **ChromaDB** | Vector database for RAG | — |
| **OpenAI Whisper API** | Voice transcription only (not used as LLM) | — |

> **Brain setup:** Claude is accessed via your Claude subscription through Paperclip AI. OpenRouter is accessed via API key — a single endpoint that routes to 100+ models. Low-complexity tasks (boilerplate, config, simple utils) that would have used a local model are handled manually — see `MANUAL_TASKS.md`.

### E2. OpenRouter (Budget Brain) Setup

```
# API endpoint — single endpoint, 100+ models (OpenAI-compatible)
https://openrouter.ai/api/v1

# Default budget model (best for coding tasks)
moonshot-ai/moonshot-v1-32k

# Alternative models via same OpenRouter key
moonshot-ai/moonshot-v1-128k     (long context — large file analysis)
mistralai/mistral-nemo            (fast + cheap)
meta-llama/llama-3.1-8b-instruct:free  (free tier)
google/gemma-2-9b-it             (fast + very cheap)
anthropic/claude-haiku-4-5       (when Claude needed but cheapest Claude)

# Environment variables
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_DEFAULT_MODEL=moonshot-ai/moonshot-v1-32k

# To switch model — just change config, no code changes needed
```

### E3. Full Tech Stack (all layers)

#### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.x | App framework (App Router, SSR/SSG) |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Component library (Radix UI) |
| Zustand | 5.x | Global state |
| TanStack Query | 5.x | Server state, caching |
| Axios | latest | HTTP client |
| React Hook Form + Zod | 7.x / 3.x | Forms + validation |
| Lucide React | latest | Icons |
| react-hot-toast | latest | Notifications |

#### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| Express | 5.x | HTTP framework |
| Prisma | 6.x | ORM + migrations |
| PostgreSQL | 15.x | Primary database |
| Redis | 7.x | Cache + queue broker |
| BullMQ | latest | Background job queues |
| JWT + bcryptjs | 9.x / 3.x | Auth |
| Zod | 3.x | Validation |
| Multer | 2.x | File uploads |
| Nodemailer | latest | Email |
| Winston | 3.x | Logging |
| Helmet + rate-limit | latest | Security |
| Sentry | latest | Error tracking |

#### AI Services
| Technology | Purpose |
|-----------|---------|
| LangChain.js | Orchestration layer for both brains |
| Claude (subscription) | Main brain — architecture, complex decisions |
| OpenRouter API | Budget brain — model-agnostic, routine tasks |
| ChromaDB | Vector DB for RAG |
| OpenAI Whisper | Voice → text only |

#### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker + Compose | Containers |
| Nginx | Reverse proxy |
| MinIO | Object storage |
| MeiliSearch | Full-text search |
| HashiCorp Vault | Secrets |
| GitHub Actions | CI/CD |

---

## Part F — Database Schema

4 base tables only:

```
users            → id, name, email, mobile, password, role, is_active
refresh_tokens   → id, user_id, token, expires_at
app_settings     → id, key, value, type, description
media            → id, filename, original_name, mime_type, size, bucket, path, url, uploaded_by
```

Seed: 1 SUPER_ADMIN (`SEED_ADMIN_EMAIL`, default admin@kdl.com; password from `SEED_ADMIN_PASSWORD`, else random and printed once), base settings.

---

## Part G — Folder Structure

```
kdl-starter-kit/
│
├── .agents/                          ← AI agent configuration
│   ├── CLAUDE.md                     Master context for Claude agents
│   ├── AGENTS.md                     Agent registry and assignments
│   ├── CONTEXT.md                    Shared project context (updated each session)
│   ├── HANDOFF.md                    Active handoff document
│   ├── STATUS.md                     Append-only project log
│   ├── BUDGET.md                     Token/cost tracking
│   ├── DECISIONS.md                  Architecture decision log
│   ├── PROGRESS.md                   Phase completion tracker
│   ├── REVIEW.md                     Code review findings
│   └── BLOCKERS.md                   Current blockers
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── config/                   database, redis, minio, meilisearch, chromadb
│   │   ├── middleware/               auth, rbac, validate, upload, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/                 routes, controller, service, schema
│   │   │   ├── users/                routes, controller, service, schema
│   │   │   ├── settings/             routes, controller, service
│   │   │   └── media/                routes, controller, service
│   │   ├── shared/
│   │   │   ├── services/             email, storage, search, stripe, razorpay
│   │   │   ├── queues/               email.queue.js
│   │   │   ├── workers/              email.worker.js
│   │   │   └── utils/                logger, response, pagination
│   │   └── index.js
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/               login, register, forgot-password
│   │   │   └── (admin)/              dashboard, users, settings
│   │   ├── components/
│   │   │   ├── layout/               AdminSidebar, TopBar, PageHeader
│   │   │   └── shared/               DataTable, Modal, ConfirmDialog, Pagination, EmptyState
│   │   ├── hooks/                    useAuth, usePagination, useDebounce
│   │   ├── lib/                      axios, queryClient, utils
│   │   ├── stores/                   auth.store, ui.store
│   │   └── types/                    api.types, models.types
│   ├── Dockerfile
│   └── package.json
│
├── ai-services/
│   ├── src/
│   │   ├── orchestrator/
│   │   │   ├── brain-router.js       Routes tasks to correct brain
│   │   │   ├── budget-tracker.js     Tracks token usage, enforces limits
│   │   │   └── context-manager.js    Reads/writes CONTEXT.md
│   │   ├── agents/                   Specialized agent definitions
│   │   │   ├── base.agent.js         Abstract base — all agents extend this
│   │   │   ├── research.agent.js     Research + data gathering agent
│   │   │   ├── content.agent.js      Content generation agent
│   │   │   └── task.agent.js         Generic task execution agent
│   │   ├── tools/                    Tools available to agents
│   │   │   ├── rag.tool.js           Query ChromaDB knowledge base
│   │   │   ├── search.tool.js        MeiliSearch full-text search
│   │   │   └── memory.tool.js        Read/write agent memory
│   │   ├── knowledge/                Knowledge base management
│   │   │   ├── ingest.js             Chunk + embed documents → ChromaDB
│   │   │   └── retrieve.js           Semantic search wrapper
│   │   ├── memory/                   Agent memory layers
│   │   │   ├── short-term.js         Redis — in-session context
│   │   │   └── long-term.js          ChromaDB — persistent vector memory
│   │   ├── workflows/                Named multi-step agent pipelines
│   │   │   └── base.workflow.js      Base workflow class
│   │   ├── governance/               Audit + compliance
│   │   │   ├── audit-logger.js       Log every agent action to STATUS.md + DB
│   │   │   └── compliance.js         Rate limits, content filters, cost guards
│   │   ├── brains/
│   │   │   ├── claude.js             Claude API client (Anthropic SDK)
│   │   │   └── openrouter.js         OpenRouter client (model-agnostic budget brain)
│   │   ├── chains/
│   │   │   └── rag-chain.js          LangChain RAG pipeline (brain-agnostic)
│   │   ├── controllers/
│   │   │   ├── chat.controller.js    POST /ai/chat → brain-router
│   │   │   ├── embed.controller.js   POST /ai/embed, /ai/search → ChromaDB
│   │   │   └── transcribe.controller.js  POST /ai/transcribe → Whisper
│   │   ├── routes/
│   │   │   └── ai.routes.js
│   │   ├── utils/
│   │   │   └── logger.js
│   │   └── index.js
│   ├── Dockerfile
│   └── package.json
│
├── infra/
│   └── nginx/nginx.conf
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-staging.yml
│
├── docs/
│   ├── API_REFERENCE.md              Auto-generated API docs
│   ├── ENV_REFERENCE.md              All env vars documented
│   └── SETUP.md                      Local + Docker setup guide
│
├── docker-compose.yml                All services
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Part H — Docker Services

Host ports below come from `docker-compose.yml` and must match `.env`. The containers listen on
their own internal port; the **host port** is what you hit from your machine.

| Service | Image | Container port | **Host port** | Purpose |
|---------|-------|----------------|---------------|---------|
| postgres | postgres:15 | 5432 | **5433** | Primary database |
| redis | redis:7-alpine | 6379 | **6380** | Cache + BullMQ |
| backend | ./backend | 4000 | **4000** | Express API |
| frontend | ./frontend | 3000 | **3001** | Next.js app |
| minio | minio/minio | 9000 / 9001 | **9002 / 9003** | Object storage |
| meilisearch | getmeili/meilisearch:v1.7 | 7700 | **7700** | Full-text search |
| chromadb | chromadb/chroma | 8000 | **8000** | Vector database |
| ai-services | ./ai-services | 5000 | **5001** | Brain router + LangChain |
| nginx | nginx:alpine | 80 | **80** | Reverse proxy |

> All 9 services run inside Docker. Claude is accessed via the Paperclip subscription — no local model container needed.

> **Port note:** the host ports (5433, 6380, 3001, 9002 …) are defined in `docker-compose.yml` and referenced in your `.env` DATABASE_URL / REDIS_URL. Do not use bare defaults like 5432/6379/3000 when connecting from the host.

---

## Part K — Environment Variables

> **Source of truth:** `.env.example` in the repo root. This section mirrors it. If these diverge, `.env.example` wins.
>
> **Setup:** `cp .env.example .env` then fill in secrets. The backend env-preflight reports **all** missing required vars at once on startup.
>
> **Port note:** DATABASE_URL uses host port 5433; REDIS_URL uses host port 6380. These match what `docker-compose.yml` maps to the host. The frontend runs on host port 3001, backend on 4000.

```bash
# ── Core ─────────────────────────────────────────────
NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
AI_SERVICES_URL=http://localhost:5000
# JWT_SECRET and JWT_REFRESH_SECRET must be different, ≥32 bytes, non-placeholder
JWT_SECRET=change_this_min_64_chars
JWT_REFRESH_SECRET=change_this_min_64_chars_refresh_different
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

# ── Database ─────────────────────────────────────────
# Host port 5433 (compose maps container 5432 → host 5433)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_this_postgres_password
POSTGRES_DB=kdl_db
DATABASE_URL=postgresql://postgres:change_this_postgres_password@localhost:5433/kdl_db

# ── Redis ────────────────────────────────────────────
# Host port 6380 (compose maps container 6379 → host 6380)
# REDIS_PASSWORD is also required by docker-compose redis --requirepass interpolation
REDIS_PASSWORD=change_this_redis_password
REDIS_URL=redis://:change_this_redis_password@localhost:6380

# ── AI Brain ─────────────────────────────────────────
# Main brain — Claude via Paperclip subscription (no key needed locally)
ANTHROPIC_API_KEY=via_paperclip_subscription
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_DEFAULT_MODEL=moonshot-ai/moonshot-v1-32k
OPENROUTER_DAILY_BUDGET=2.00

# ── Voice ────────────────────────────────────────────
OPENAI_API_KEY=sk-your-whisper-key-here

# ── ChromaDB ─────────────────────────────────────────
CHROMADB_URL=http://localhost:8000

# ── Storage (MinIO) ───────────────────────────────────
MINIO_ROOT_USER=change_this_minio_user
MINIO_ROOT_PASSWORD=change_this_minio_password
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=change_this_minio_user
MINIO_SECRET_KEY=change_this_minio_password
MINIO_BUCKET=kdl-media

# ── Search (MeiliSearch) ──────────────────────────────
MEILISEARCH_HOST=http://localhost:7700
MEILI_MASTER_KEY=change_this_meili_master_key
MEILISEARCH_API_KEY=scoped-admin-key

# ── Payments ─────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# ── Email ────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=KDL Starter Kit <noreply@kdl.com>

# ── Vault ────────────────────────────────────────────
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=dev-root-token

# ── Observability ─────────────────────────────────────
SENTRY_DSN=your_sentry_dsn

# ── Encryption ───────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
APP_ENCRYPTION_KEY=REPLACE_BEFORE_DEPLOY_run_node_e_console.log_require_crypto_randomBytes_32_toString_hex
```

---

*See also: KDL_RepoDocs.md — Repository Documentation (agent architecture, orchestration, phases, prompting, loop engineering)*

*Kalam Dream Labs Pvt Ltd — Internal Reference Document v1.0*
