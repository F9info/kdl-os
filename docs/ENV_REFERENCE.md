# ENV_REFERENCE — KDL Starter Kit

All environment variables used by the KDL Starter Kit. Source of truth: `.env` (actual values) and `KDL_DevEnvironment.md` Part K (canonical list).

## Quick Start

```bash
cp .env.example .env
# Fill in all secrets marked [REQUIRED]
```

---

## Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Runtime environment. Set to `production` in prod. |
| `APP_PORT` | Yes | `4000` | Port the backend Express server binds to. |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Next.js frontend origin. Used for CORS and email links. |
| `BACKEND_URL` | Yes | `http://localhost:4000` | Backend origin. Used by AI services and internal references. |
| `AI_SERVICES_URL` | Yes | `http://localhost:5000` | AI services origin. Used by backend and Nginx proxy. |
| `JWT_SECRET` | Yes | _(none)_ | Minimum 32-character secret for signing JWT access tokens. Generate with `openssl rand -base64 48`. |
| `JWT_EXPIRES_IN` | Yes | `15m` | Access token TTL. Short-lived by design. |
| `JWT_REFRESH_EXPIRES_IN` | Yes | `7d` | Refresh token TTL. Stored hashed in `refresh_tokens` table. |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | Allowed CORS origin. Must match `FRONTEND_URL` in prod. |

---

## Docker (Container Environment)

These variables are used by `docker-compose.yml` to configure infrastructure containers. They are NOT read directly by backend application code — the backend reads `DATABASE_URL` and `REDIS_URL` instead.

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_USER` | Yes | `postgres` | PostgreSQL superuser name. Used by the `postgres` container and interpolated into `DATABASE_URL` for backend/ai-services containers. |
| `POSTGRES_PASSWORD` | Yes | `postgres` | PostgreSQL superuser password. Change in production. |
| `POSTGRES_DB` | Yes | `kdl_db` | Database name created on first container start. |
| `MINIO_ROOT_USER` | Yes | `minioadmin` | MinIO admin username. Used by the `minio` container. Change in production. |
| `MINIO_ROOT_PASSWORD` | Yes | `minioadmin` | MinIO admin password. Used by the `minio` container. Change in production. |
| `MEILI_MASTER_KEY` | Yes | `masterKey` | MeiliSearch master key. Used by the `meilisearch` container. Use a strong random key in production. |

---

## Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5433/kdl_db` | PostgreSQL connection string. Host port 5433 (not 5432 — F9 Tech stack occupies that). Inside Docker containers, use `postgres:5432`. |

---

## Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | Yes | `redis://localhost:6380` | Redis connection string for BullMQ queues and session cache. Host port 6380 (not 6379 — F9 Tech stack occupies that). Inside Docker containers, use `redis:6379`. |

### Redis key usage

The User Management RBAC module writes permission resolution results to Redis:

| Key pattern | TTL | Description |
|---|---|---|
| `perm:user:{userId}` | 600 s (10 min) | Effective permission set for a user. JSON: `{ bypass: bool, permissions: string[] }`. Written by `permission-resolver.js` on first resolution, invalidated (via SCAN) on any role, permission, or user-role/override mutation. |

No new environment variables are required — the module reads `REDIS_URL`.

---

## AI Brains

Variables shared between backend and `ai-services/`. The `ai-services` process reads its own `.env` — `JWT_SECRET` must match the backend value exactly.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (AI) | _(none)_ | Anthropic API key for Claude. Used by `ai-services` for CRITICAL/HIGH priority tasks. Not needed if running via Paperclip subscription — omit and Claude calls use Paperclip auth. |
| `OPENROUTER_API_KEY` | Yes | _(none)_ | OpenRouter API key. Used by the budget brain for MEDIUM/LOW priority tasks and all embeddings. |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL. Override only for proxies or testing. |
| `OPENROUTER_DEFAULT_MODEL` | No | `moonshot-ai/moonshot-v1-32k` | OpenRouter model identifier used unless overridden per-call. |
| `OPENROUTER_DAILY_BUDGET` | No | `2.00` | Daily spend cap in USD for OpenRouter. Agent logs to `MANUAL_TASKS.md` when exhausted. |
| `OPENAI_API_KEY` | No | _(none)_ | OpenAI API key. Reserved for Whisper transcription (Phase 6 planned). Not used for completions. |

---

## AI Services Process

These variables are specific to the `ai-services/` Express process (`ai-services/.env`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PORT` | No | `5000` | Port the AI services Express server binds to. |
| `CHROMA_URL` | Yes (AI) | `http://localhost:8000` | ChromaDB vector store URL. Used for long-term memory and knowledge base RAG. Inside Docker containers use `http://chromadb:8000`. |

---

## ChromaDB

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHROMADB_URL` | Yes | `http://localhost:8000` | ChromaDB vector store URL. Used by backend config singleton. Distinct from `CHROMA_URL` used directly in `ai-services`. |

---

## Storage (MinIO)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MINIO_ENDPOINT` | Yes | `localhost` | MinIO server hostname. Use `minio` inside Docker containers. |
| `MINIO_PORT` | Yes | `9000` | MinIO API port. |
| `MINIO_USE_SSL` | No | `false` | Enable TLS for MinIO connections. Set `true` in prod with a real cert. |
| `MINIO_ACCESS_KEY` | Yes | `minioadmin` | MinIO access key. Change in production. |
| `MINIO_SECRET_KEY` | Yes | `minioadmin` | MinIO secret key. Change in production. |
| `MINIO_BUCKET` | Yes | `kdl-media` | Default bucket name for all media uploads. Created on first run. |

---

## Search (MeiliSearch)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MEILISEARCH_HOST` | Yes | `http://localhost:7700` | MeiliSearch host URL. |
| `MEILISEARCH_API_KEY` | Yes | `masterKey` | MeiliSearch master key. Use a strong random key in production. |
| `MEILI_SEARCH_API_KEY` | Yes | _(none)_ | Scoped search-only API key used by ai-services' `meilisearch` tool. Generate with `GET /keys` using the master key (or the MeiliSearch dashboard) and grant only the `search` action. Never use the master key here. |

---

## Payments

| Variable | Required | Default | Description |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | No | _(none)_ | Stripe secret key. Use `sk_test_*` for development. |
| `STRIPE_WEBHOOK_SECRET` | No | _(none)_ | Stripe webhook signing secret (`whsec_*`). Required to verify incoming webhook payloads. |
| `RAZORPAY_KEY_ID` | No | _(none)_ | Razorpay key ID. Use test keys (`rzp_test_*`) for development. |
| `RAZORPAY_KEY_SECRET` | No | _(none)_ | Razorpay key secret. |

---

## Email (SMTP)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_HOST` | Yes | `smtp.gmail.com` | SMTP server hostname. |
| `SMTP_PORT` | Yes | `587` | SMTP port. 587 = STARTTLS. Use 465 for implicit TLS. |
| `SMTP_USER` | Yes | _(none)_ | SMTP authentication username (typically your email address). |
| `SMTP_PASS` | Yes | _(none)_ | SMTP password or app-specific password (Gmail requires an App Password). |
| `SMTP_FROM` | Yes | `KDL Starter Kit <noreply@kdl.com>` | From address shown in outgoing emails. |

---

## Vault (HashiCorp Vault)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VAULT_ADDR` | No | `http://localhost:8200` | Vault server address. Not used in Phase 1 — reserved for secrets management in later phases. |
| `VAULT_TOKEN` | No | `dev-root-token` | Vault root token. **Never use `dev-root-token` in production.** |

---

## Observability (Sentry)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SENTRY_DSN` | No | _(none)_ | Sentry Data Source Name. Backend and frontend both read this to send error traces. Leave blank to disable Sentry. |

---

## Integrations Module

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENCRYPTION_KEY` | Yes (if Integrations installed) | _(none)_ | 32-byte encryption key for AES-256-GCM encryption of provider credentials. Must be a 64-character lowercase hex string. Required at startup — the backend crashes immediately if missing or malformed when the Integrations module is loaded. **Must not be committed to version control.** |

### How to generate

```bash
openssl rand -hex 32
```

Example output (never use this value):
```
a3f1c2e4b5d67890abcdef1234567890abcdef1234567890abcdef1234567890
```

Set this in `.env`:
```
APP_ENCRYPTION_KEY=<your-64-char-hex-string>
```

### Rotation warning

**Changing `APP_ENCRYPTION_KEY` orphans all stored provider credentials.** Every `IntegrationProvider` row has its `credentials` column encrypted with the current key. Rotating the key without re-encrypting existing rows means all providers fail at send time with a decryption error. After rotation, all providers must be re-entered via the Integrations UI (Settings → Integrations → edit each provider and save credentials again).
