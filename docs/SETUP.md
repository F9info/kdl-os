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
| Email | `SEED_ADMIN_EMAIL` (default `admin@kdl.com`) |
| Password | `SEED_ADMIN_PASSWORD` if set; otherwise a random password printed once by the seed. Required in production. Docker stack pins `kdl-dev-seed-password` |
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

Opens on `http://localhost:3000`. Login with the seeded admin credentials (see "Seed the database" above).

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

### Nginx — SSE configuration

The Notifications module uses Server-Sent Events (SSE) at `GET /api/notifications/stream`. SSE requires nginx to disable response buffering for that route, or events will batch and only arrive when the connection closes.

`infra/nginx/nginx.conf` already has the required location block **before** the generic `/api` block:

```nginx
location /api/notifications/stream {
  set $backend_host backend:4000;
  proxy_pass http://$backend_host;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
  chunked_transfer_encoding on;
}
```

**If you customise nginx**, ensure this location block appears before `location /api` — nginx uses the longest-prefix rule, so order only matters for equal-length prefixes, but the explicit location ensures buffering-off is applied correctly. Without `proxy_buffering off` the browser receives all events at once when the connection closes rather than in real time. The frontend falls back to 30-second polling when EventSource fails, so the app stays functional, but real-time push requires this config.

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

## Integrations Module — Webhook Setup

The Integrations module receives delivery status callbacks from providers at:

```
GET  /api/integrations/webhooks/:driver   (challenge verification — Meta Cloud only)
POST /api/integrations/webhooks/:driver   (delivery status events — all drivers)
```

Replace `:driver` with the driver slug: `meta-cloud`, `msg91`, `twilio`, or `gupshup`.

**Your webhook base URL must be publicly reachable** — providers cannot call `localhost`. Use a tunnel (`ngrok`/`cloudflared`) in development.

```
# Example (production)
https://app.yourdomain.com/api/integrations/webhooks/meta-cloud
https://app.yourdomain.com/api/integrations/webhooks/msg91
https://app.yourdomain.com/api/integrations/webhooks/twilio
https://app.yourdomain.com/api/integrations/webhooks/gupshup
```

---

### Meta Cloud (WhatsApp Business Cloud API)

1. In the [Meta for Developers console](https://developers.facebook.com), open your App → **WhatsApp → Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set **Callback URL** to:
   ```
   https://app.yourdomain.com/api/integrations/webhooks/meta-cloud
   ```
4. Set **Verify token** to the same string stored in your provider's `config.verify_token` field (set when creating the provider in the UI).
5. Click **Verify and Save** — Meta issues a GET request with `hub.challenge`; the server echoes it back to complete verification.
6. Subscribe to at least the `messages` webhook field to receive delivery status updates.

---

### MSG91

1. Log in to [MSG91 dashboard](https://control.msg91.com) → **Webhook** (under your account settings).
2. Set the **Delivery URL** to:
   ```
   https://app.yourdomain.com/api/integrations/webhooks/msg91
   ```
3. No GET challenge step — MSG91 uses HMAC-SHA256 signature verification on POST payloads. The signature key is the API key stored in the provider's credentials.
4. Save and send a test SMS to confirm the webhook fires.

---

### Twilio (SMS)

1. In the [Twilio Console](https://console.twilio.com), open **Phone Numbers → Manage → Active numbers** and select your number.
2. Under **Messaging**, set **A message comes in** → **Webhook** URL to:
   ```
   https://app.yourdomain.com/api/integrations/webhooks/twilio
   ```
   Method: `HTTP POST`.
3. For delivery status callbacks, also set **Status callback URL** (same URL) under the Messaging section.
4. Twilio signs requests with the `X-Twilio-Signature` header using your Auth Token. The server validates this automatically using the provider's stored credentials.

---

### Gupshup (WhatsApp)

1. Log in to your [Gupshup dashboard](https://www.gupshup.io) → open your WhatsApp app.
2. Navigate to **Settings → Webhooks**.
3. Set the callback URL to:
   ```
   https://app.yourdomain.com/api/integrations/webhooks/gupshup
   ```
4. Gupshup signs POST payloads; the server verifies the signature against the stored API key.
5. Save and use **Test Webhook** to confirm connectivity.

---

## Admin Login Recovery

If the seeded admin password was not captured (the seed script prints it only once), or the admin account is locked out, use the reset script to set a new password without touching the UI.

### The random-seed-password trap

When `SEED_ADMIN_PASSWORD` is not set, `node prisma/seed.js` generates a random password and prints it **once**. If you miss it (closed the terminal, log was not captured, container restarted), the admin account is permanently inaccessible through normal login — there is no "forgot password" path for the super-admin out of the box.

### Reset the admin password

```bash
# With pnpm (monorepo root)
pnpm --filter backend db:reset-admin --email admin@kdl.com --password YourNew12CharMin

# With npm inside backend/
npm run db:reset-admin -- --email admin@kdl.com --password YourNew12CharMin

# Let the script generate a random password (printed once):
pnpm --filter backend db:reset-admin

# Via environment variables:
NEW_ADMIN_PASSWORD=YourNew12CharMin pnpm --filter backend db:reset-admin
```

Password rules: minimum 12 characters (matches the seed constraint).

After the script completes, `POST /api/auth/login` with the new password returns 200.

### Docker one-liner

If the backend is running inside Docker:

```bash
docker compose exec backend node scripts/reset-admin-password.js \
  --email admin@kdl.com \
  --password YourNew12CharMin
```

### Production use

The script refuses to run in production without `--force` as a deliberate safeguard:

```bash
NODE_ENV=production node scripts/reset-admin-password.js \
  --email admin@kdl.com \
  --password YourNew12CharMin \
  --force
```

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

**Notification SSE stream hangs / no events**

nginx buffers SSE responses by default, which blocks real-time delivery. The `infra/nginx.conf` already has the required location block, but confirm it is present if you customise nginx:

```nginx
location /api/notifications/stream {
    proxy_pass         http://backend;
    proxy_buffering    off;
    proxy_cache        off;
    proxy_read_timeout 3600s;
    proxy_set_header   Connection '';
    proxy_http_version 1.1;
}
```

Without `proxy_buffering off` the browser receives all events in one burst when the connection closes instead of in real time. The frontend falls back to 30-second polling if the EventSource fails, so the app remains functional, but real-time push requires this nginx config.
