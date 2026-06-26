# Phase 1 Code Review — KDL-6

**Reviewer:** Code Reviewer Agent (a38c5159)
**Date:** 2026-06-24
**Phase:** 1 — Root Infrastructure
**Summary:** PASS WITH REQUIRED FIXES

---

## Overall Verdict

Phase 1 success criteria met: `docker compose config --quiet` exits 0 ✅

Proceed to Phase 2 is **conditional** — CRITICAL and HIGH issues must be fixed first. They are confined to docker-compose.yml and do not require Phase 2 output to fix.

---

## Per-File Findings

### docker-compose.yml

**Port mapping — CORRECT**
- postgres: `5433:5432` ✅ (host 5433, container 5432 — matches CLAUDE.md)
- redis: `6380:6379` ✅ (host 6380, container 6379 — matches CLAUDE.md)

**All 9 services present** ✅
postgres, redis, minio, meilisearch, chromadb, backend, frontend, ai-services, nginx

**depends_on with healthchecks** ✅ — backend/frontend/ai-services wait on postgres and redis healthy

**CRITICAL — Hardcoded secrets in environment blocks (lines 8-9, 38-39, 51, 71-72, 86-87, 101-102)**

```yaml
# postgres service (lines 6-9) — hardcoded inline:
environment:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres   # ← hardcoded secret
  POSTGRES_DB: kdl_db

# minio service (lines 38-39) — hardcoded inline:
environment:
  MINIO_ROOT_USER: minioadmin   # ← hardcoded secret
  MINIO_ROOT_PASSWORD: minioadmin  # ← hardcoded secret

# meilisearch service (line 51) — hardcoded inline:
environment:
  MEILI_MASTER_KEY: masterKey   # ← hardcoded secret

# backend (lines 71-72), frontend (86-87), ai-services (101-102) — credentials in URL:
environment:
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/kdl_db  # ← password inline
  REDIS_URL: redis://redis:6379
```

**Required fix:** Move `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MEILI_MASTER_KEY` to `.env` and reference via `${VAR}` substitution. For `DATABASE_URL`, construct it from env vars: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`.

**HIGH — Frontend service has DATABASE_URL and REDIS_URL (lines 85-94)**

```yaml
frontend:
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/kdl_db  # ← wrong
    REDIS_URL: redis://redis:6379  # ← wrong
```

Next.js frontend has no business with a direct DB or Redis connection. It calls the backend API. These env vars signal to Phase 3 (frontend) agent that frontend ↔ DB is valid — it is not. Remove from frontend service.

**MEDIUM — minio/meilisearch/chromadb have no healthchecks**

Backend and ai-services have no `depends_on` for minio/meilisearch/chromadb, and those services lack `healthcheck:` blocks. Not blocking Phase 1 (no backend code yet), but must be addressed before Phase 2 backend modules wire up storage/search/vector services.

---

### docker-compose.prod.yml

**restart: always on all 9 services** ✅
**NODE_ENV: production on app services** ✅
**nginx retains port 80** ✅
**All other services have ports suppressed** ✅

**LOW — `ports: !reset []` requires Docker Compose v2.17+**

The `!reset` YAML tag is Compose-specific. It works correctly but breaks on Docker Compose < 2.17. No version warning comment present.

---

### infra/nginx/nginx.conf

**Route correctness** ✅
- `location /api` → `http://backend` (backend:4000) ✅
- `location /ai` → `http://ai_services` (ai-services:5000) ✅
- `location /` → `http://frontend` (frontend:3000) ✅

**WebSocket headers present** ✅ — `Upgrade` and `Connection` set on all locations

**client_max_body_size 50M** ✅ — required for media uploads

**MEDIUM — Missing `X-Forwarded-Proto` header**

All three location blocks are missing:
```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

Without this, backend cannot detect original protocol. Cookies marked `Secure` and redirect logic break in production behind HTTPS termination. Add before Phase 5 (HTTPS hardening).

---

### Folder Scaffold

All directories from CLAUDE.md folder structure present with `.gitkeep` ✅ (34 dirs)

**LOW — `.github/workflows/` missing**

Part G of `KDL_DevEnvironment.md` lists `.github/workflows/` with `ci.yml` and `deploy-staging.yml`. No `.github/` directory exists. Not blocking (CI/CD is Phase 5) but scaffold is incomplete per spec.

---

### .gitignore

Required exclusions — all present:
- `node_modules/` ✅
- `.env` ✅
- `dist/` ✅
- `.next/` ✅
- `coverage/` ✅

**LOW — Missing patterns:** `.env.local`, `.env.*.local`, `build/`, `*.env`

---

### README.md

Project overview, tech stack, quick start, phase status, default credentials — all present ✅

**LOW — `docker compose up` will fail in Phase 1** — `backend/frontend/ai-services` have no Dockerfiles yet. Should note infra-only compose command for Phase 1.

---

### docs/ENV_REFERENCE.md

33 vars documented ✅ | Port mismatch warnings ✅ | ANTHROPIC_API_KEY exclusion explained ✅ | VAULT vars Phase 1 note ✅

**LOW — Vars hardcoded in docker-compose.yml not documented:**
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MEILI_MASTER_KEY` — not in `.env` or ENV_REFERENCE. Will be resolved when CRITICAL fix #1 moves them to `.env`.

---

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | docker-compose.yml | Hardcoded secrets: POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, MEILI_MASTER_KEY, creds in DATABASE_URL |
| 2 | HIGH | docker-compose.yml | Frontend service has DATABASE_URL + REDIS_URL — frontend must not connect directly to DB/Redis |
| 3 | MEDIUM | docker-compose.yml | minio/meilisearch/chromadb have no healthchecks; no depends_on from app services |
| 4 | MEDIUM | nginx.conf | Missing X-Forwarded-Proto header on all proxy locations |
| 5 | LOW | docker-compose.prod.yml | `ports: !reset []` requires Compose v2.17+ — no version comment |
| 6 | LOW | nginx.conf | `location /api` matches `/apifoo` — verify Phase 2 route prefixes |
| 7 | LOW | scaffold | `.github/workflows/` missing (Part G spec) |
| 8 | LOW | .gitignore | Missing `.env.local`, `.env.*.local`, `build/`, `*.env` |
| 9 | LOW | README.md | `docker compose up` fails — Dockerfiles don't exist yet |
| 10 | LOW | ENV_REFERENCE.md | POSTGRES_*, MINIO_ROOT_*, MEILI_MASTER_KEY not documented |

---

## Recommendation

**Conditional PASS — Proceed to Phase 2 after fixing issues #1 and #2.**

Both are docker-compose.yml only — ~10 line changes, no Phase 2 output needed.

- Issue #1 must be fixed before secrets get committed with real credentials.
- Issue #2 must be fixed before Phase 3 (frontend) agent inherits the wrong pattern.

Issues #3–#10 can be addressed at the start of Phase 2 or in a follow-up PR.

---

*Reviewed by Code Reviewer Agent (KDL-6) on 2026-06-24*

---

# Phase 2 Code Review — KDL-11

**Reviewer:** Code Reviewer Agent (a38c5159)
**Date:** 2026-06-25
**Phase:** 2 — Backend Foundation
**Summary:** PASS WITH REQUIRED FIXES (3 HIGH issues must be resolved before Phase 3)

---

## Overall Verdict

Phase 2 delivers a correct structural foundation. ES Modules throughout ✅, Zod middleware wired ✅, response utilities consistent ✅, BullMQ queue scaffolded ✅. However three HIGH bugs will cause runtime failures in Phase 3 and must be fixed before the Backend Coder implements module CRUD.

---

## Per-File Findings

### backend/prisma/schema.prisma

**4 tables present with correct types** ✅
**Role enum (SUPER_ADMIN / ADMIN / USER)** ✅
**cuid() IDs on all models** ✅
**Cascade deletes on RefreshToken and Media** ✅
**DATABASE_URL via env()** ✅

**MEDIUM — Missing indexes on FK and query-critical columns**

Prisma does not auto-create indexes on foreign key columns in PostgreSQL. The following columns will be full-table-scanned on every query:
- `refresh_tokens.user_id` — every token lookup by user
- `media.user_id` — every media list by user
- `users.role` — RBAC queries in Phase 3
- `refresh_tokens.expires_at` + `revoked` — token cleanup jobs

Add `@@index([user_id])`, `@@index([role])`, `@@index([expires_at, revoked])` as appropriate. Not blocking Phase 3 but will degrade performance at scale.

**LOW — RefreshToken missing updated_at**

`User`, `AppSetting`, and `Media` all have `updated_at DateTime @updatedAt`. `RefreshToken` does not. Inconsistent. The only mutable field is `revoked` — add `updated_at` for audit trail consistency.

---

### backend/prisma/seed.js

**SUPER_ADMIN seeded with upsert (idempotent)** ✅
**bcrypt cost factor 12** ✅
**ES Module syntax** ✅

**MEDIUM — `new PrismaClient()` directly (CLAUDE.md non-negotiable rule violation)**

```js
// seed.js line 4
const prisma = new PrismaClient();  // ← violates CLAUDE.md
```

CLAUDE.md states: "Prisma client imported from `config/database.js` singleton only — never `new PrismaClient()` directly". Seed scripts are CLI one-offs and the singleton pattern exists for hot-reload safety in server context, but the rule is stated as non-negotiable. Fix:

```js
import { prisma } from '../src/config/database.js';
// remove local new PrismaClient() and the finally disconnect — singleton manages it
```

---

### backend/package.json

**"type": "module" present** ✅
**All required dependencies present** ✅
**postinstall: prisma generate** ✅
**npm scripts correct** ✅
**prisma.seed path correct** ✅

No issues.

---

### backend/src/config/database.js

**Singleton pattern via globalThis** ✅
**PrismaClient log levels gated by NODE_ENV** ✅
**Named export { prisma }** ✅

**LOW — globalThis singleton unnecessary in plain Node.js**

The `globalThis` pattern prevents duplicate PrismaClient instances across Next.js hot-reloads. In a plain Express Node.js process, module imports are cached — a simple top-level `const prisma = new PrismaClient()` export is already a singleton. The pattern adds confusion for no benefit here. Not wrong, just noisy. Keep if desired for forward-compatibility.

---

### backend/src/config/redis.js

**REDIS_URL from env** ✅
**maxRetriesPerRequest: null required for BullMQ** ✅

**LOW — Uses console.error / console.log instead of Winston logger**

```js
redis.on('error', (err) => console.error(...));   // line 9
redis.on('connect', () => console.log(...));       // line 13
```

Winston logger can't be imported here (logger.js depends on nothing — no circular risk). Replace with `import { logger } from '../shared/utils/logger.js'` in the future. Low impact since these are startup events only.

---

### backend/src/config/minio.js / meilisearch.js / chromadb.js

**All credentials from env vars** ✅
**No hardcoded ports or secrets** ✅

No issues.

---

### backend/src/middleware/auth.js

**Bearer token extraction correct** ✅
**jwt.verify with JWT_SECRET from env** ✅
**errorResponse used** ✅
**try/catch present** ✅

No issues.

---

### backend/src/middleware/rbac.js

**requireRole variadic — supports multiple roles** ✅
**errorResponse used** ✅
**401 for missing user, 403 for wrong role** ✅

No issues.

---

### backend/src/middleware/validate.js

**Zod safeParse** ✅
**errorResponse on failure** ✅
**req.validated populated** ✅

**Note for Phase 3 developers:** The schema passed to `validate()` must wrap body/query/params in an outer object:
```js
z.object({ body: z.object({...}), query: z.object({...}), params: z.object({...}) })
```
`req.validated.body`, `req.validated.query`, etc. are the parsed values. Document this pattern in CLAUDE.md before Phase 3.

---

### backend/src/middleware/upload.js

**Memory storage (no disk writes)** ✅
**10MB limit enforced** ✅

**MEDIUM — No MIME type / file extension filtering (OWASP A04)**

```js
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  // ← no fileFilter — any file type accepted
});
```

Without `fileFilter`, any file type including executables, scripts, and SVG (XSS vector) can be uploaded. Add a whitelist before Phase 3 wires upload routes:
```js
fileFilter: (req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
  cb(null, allowed.includes(file.mimetype));
}
```

---

### backend/src/middleware/errorHandler.js

**4-argument Express 5 error handler** ✅
**errorResponse used** ✅
**Stack hidden in production** ✅
**Winston logger used** ✅

No issues.

---

### backend/src/shared/utils/response.js

**successResponse / errorResponse exported** ✅
**Consistent shape: { success, data } / { success, message, errors? }** ✅

No issues.

---

### backend/src/shared/utils/logger.js

**Winston with timestamp + errors format** ✅
**Log level gated by NODE_ENV** ✅

**HIGH — Log file path resolves to wrong directory**

```js
// logger.js lines 22-27
new winston.transports.File({
  filename: path.join(__dirname, '../../../../../logs/error.log'),  // ← 5 levels up
```

`__dirname` = `backend/src/shared/utils`. Five `../` traversals reach `F9 Tech/` (the project parent), not `backend/`. Winston will create `F9 Tech/logs/` — wrong location and pollutes the parent directory.

The HANDOFF.md documents `backend/logs/` as the correct path. From `backend/src/shared/utils`, that is **3 levels up**:

```js
filename: path.join(__dirname, '../../../logs/error.log'),  // correct
```

Fix both transports (error.log and combined.log). This will cause Winston to silently fail or write logs outside the project on production startup.

---

### backend/src/shared/utils/pagination.js

**Page/limit bounds enforced** ✅
**Max 100 per page** ✅

No issues.

---

### backend/src/shared/services/email.service.js

**Nodemailer with env-based SMTP config** ✅
**No hardcoded credentials** ✅

No issues.

---

### backend/src/shared/services/storage.service.js

**Uses minio singleton from config** ✅
**No direct disk writes** ✅
**Presigned URL for retrieval** ✅

No issues.

---

### backend/src/shared/services/search.service.js

**Uses meili singleton from config** ✅
**ensureIndex creates if not exists** ✅

No issues.

---

### backend/src/shared/queues/email.queue.js

**BullMQ Queue** ✅
**Retry with exponential backoff** ✅
**removeOnComplete / removeOnFail limits** ✅

No issues.

---

### backend/src/shared/workers/email.worker.js

**BullMQ Worker** ✅
**Failed job event logged** ✅

**HIGH — MAX_ITERATIONS counter never resets; permanently caps email send count**

```js
// email.worker.js lines 6-8
const MAX_ITERATIONS = 1000;
let processed = 0;    // ← module-level, never resets

export const emailWorker = new Worker('email', async (job) => {
  if (processed >= MAX_ITERATIONS) {
    throw new Error('emailWorker hit maxIterations cap — restarting required');
  }
  processed++;
  // ...
```

After 1000 emails processed in the server lifetime, `processed >= MAX_ITERATIONS` is permanently true. Every subsequent email job will throw and fail — BullMQ will retry 3× then move to failed queue. No emails can ever be sent again without a full process restart.

The CLAUDE.md cap requirement applies to loops (`for`/`while`), not to event-driven queue workers. BullMQ workers are event-driven — they process one job at a time, not looping. Remove the counter. BullMQ's own `attempts: 3` + `backoff` handles retry safety. If a circuit-breaker is desired, implement it per-job based on error type.

**HIGH — Email worker never imported or started in index.js**

```js
// index.js — no import of email.worker.js
```

The `emailWorker` export is never imported anywhere. BullMQ workers must be instantiated to process jobs. As written, emails added to the queue will accumulate indefinitely but never be sent. Add to index.js:

```js
import './shared/workers/email.worker.js';
```

and include graceful worker shutdown in the `shutdown` function:
```js
import { emailWorker } from './shared/workers/email.worker.js';
// ...
await emailWorker.close();
```

---

### backend/src/index.js

**ES Module** ✅
**Imports prisma from config singleton** ✅
**helmet + cors + rateLimit** ✅
**APP_PORT from env (no hardcoded port)** ✅
**SIGTERM + SIGINT graceful shutdown** ✅
**prisma.$disconnect() + redis.disconnect() on shutdown** ✅

**HIGH — Email worker not started (covered above)**

**MEDIUM — Health endpoint bypasses successResponse convention**

```js
// index.js line 34
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });  // ← raw res.json
});
```

All responses must use `successResponse` / `errorResponse`. Fix:
```js
app.get('/health', (req, res) => {
  successResponse(res, { status: 'ok', uptime: process.uptime() });
});
```

**MEDIUM — No 404 catch-all route**

Requests to undefined routes fall through the route handlers and hit Express's default behavior. Add before `app.use(errorHandler)`:
```js
app.use((req, res) => errorResponse(res, 'Not found', 404));
```

---

### backend/src/modules/*/routes.js (stub routes)

**All 4 modules have stub routes** ✅
**successResponse used** ✅
**Router exported correctly** ✅

No issues.

---

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | HIGH | shared/utils/logger.js:22-27 | Log path `../../../../../` resolves to wrong directory — logs land outside project |
| 2 | HIGH | shared/workers/email.worker.js:6-8 | MAX_ITERATIONS counter never resets — permanently caps email sending after 1000 jobs |
| 3 | HIGH | index.js | Email worker never imported or started — queue jobs never processed |
| 4 | MEDIUM | prisma/seed.js:4 | `new PrismaClient()` directly — violates CLAUDE.md singleton rule |
| 5 | MEDIUM | index.js:34 | Health endpoint uses raw `res.json()` not `successResponse` |
| 6 | MEDIUM | middleware/upload.js | No MIME type filtering — any file type uploadable (OWASP A04) |
| 7 | MEDIUM | prisma/schema.prisma | Missing indexes on user_id FKs, role, expires_at — performance risk at scale |
| 8 | MEDIUM | index.js | No 404 catch-all route before errorHandler |
| 9 | LOW | config/redis.js:8-13 | console.error/log used instead of Winston logger |
| 10 | LOW | prisma/schema.prisma | RefreshToken missing updated_at |
| 11 | LOW | config/database.js:3-11 | globalThis singleton unnecessary in plain Node.js |

---

## Recommendation

**PASS WITH REQUIRED FIXES — Issues #1, #2, #3 must be resolved before Phase 3 starts.**

- Issue #1 (logger path): Winston silently writes logs outside the project directory. Easy 2-character fix (`'../../../../../'` → `'../../../'`).
- Issue #2 (worker counter): After 1000 emails, the system permanently stops sending email. Remove the counter.
- Issue #3 (worker not started): Email queue is wired but worker never runs. Add one import line to index.js.

Issues #4–#8 should be fixed in the same pass (all small, contained changes).
Issues #9–#11 can be deferred to Phase 3 cleanup.

**Phase 3 (Backend Coder) must NOT start until issues #1–#3 are fixed.**

---

*Reviewed by Code Reviewer Agent (KDL-11) on 2026-06-25*

---

# KDL-12 Re-Review — 3 HIGH Bug Fixes Verified

**Reviewer:** Code Reviewer Agent (a38c5159)
**Date:** 2026-06-25
**Scope:** Re-check of 3 HIGH fixes from Phase 2 review (KDL-11)
**Verdict:** PASS — all 3 fixes correct

---

## Fix 1: `backend/src/shared/utils/logger.js` — Log path

**Before:** `path.join(__dirname, '../../../../../logs/error.log')` — 5 traversals, resolves to project parent
**After:** `path.join(__dirname, '../../../logs/error.log')` — 3 traversals, resolves to `backend/logs/`

Verified: `__dirname` = `backend/src/shared/utils/` → 3 `../` steps → `backend/` ✅
Both transports (error.log + combined.log) corrected ✅

## Fix 2: `backend/src/shared/workers/email.worker.js` — Removed counter

**Before:** `MAX_ITERATIONS`, `processed` counter, guard check, and increment inside job handler
**After:** Clean Worker with only job handler + failed event listener

Verified: No `MAX_ITERATIONS`, no `processed`, no cap logic anywhere in file ✅
BullMQ manages job lifecycle via `attempts` + `backoff` ✅

## Fix 3: `backend/src/index.js` — Worker import + shutdown

**Before:** No email worker import; shutdown handler only closed server + DB + redis
**After:**
- Line 12: `import { emailWorker } from './shared/workers/email.worker.js'` ✅
- `await emailWorker.close()` called first in `shutdown()`, before `server.close()` ✅

Shutdown order is correct: drain worker → close server → disconnect prisma → disconnect redis ✅

---

## Overall Verdict

All 3 HIGH bugs from KDL-11 are fixed. No regressions introduced. Phase 3 (module CRUD) may proceed.

*Reviewed by Code Reviewer Agent (KDL-12) on 2026-06-25*

---

# Phase 3 Code Review — KDL-14

**Reviewer:** Code Reviewer Agent (a38c5159)
**Date:** 2026-06-25
**Phase:** 3 — Backend Module CRUD
**Scope:** 16 new module files (auth, users, settings, media) + 5 MEDIUM fixes from KDL-11
**Summary:** PASS WITH REQUIRED FIXES (2 HIGH + 2 MEDIUM before Phase 4)

---

## Checklist Pass (all Phase 3 files)

| Check | Result |
|-------|--------|
| ES Modules — no require/CommonJS | ✅ PASS — all 16 files use import/export |
| Zod validation on all inputs | ✅ PASS — all routes use validate() with correct `{ body/query/params }` schema shape |
| successResponse/errorResponse on all responses | ✅ PASS |
| try/catch → next(err) on all controllers | ✅ PASS — all 12 handlers covered |
| Prisma client from config/database.js singleton | ✅ PASS — all 4 service files correct |
| File uploads via storage.service.js only | ✅ PASS — media/service.js uses storageService |
| req.validated.body/query/params (not req.body) | ✅ PASS — all controllers use req.validated |
| getPaginationParams for paginated list endpoints | ✅ PASS — users/service.js + media/service.js |
| No inline background email jobs | ✅ PASS — no email ops in any module |

---

## MEDIUM Fixes from KDL-11 — All Verified ✅

| Fix | File | Verdict |
|-----|------|---------|
| #4 seed.js singleton import | `prisma/seed.js:3` → `import { prisma } from '../src/config/database.js'` | ✅ PASS |
| #5 health successResponse | `src/index.js:37` → `successResponse(res, { status: 'ok', uptime: ... })` | ✅ PASS |
| #6 upload MIME whitelist | `middleware/upload.js` → fileFilter with Set of 5 allowed types | ✅ PASS |
| #7 prisma @@index additions | `schema.prisma` → @@index on role, user_id (RefreshToken+Media), [expires_at,revoked] | ✅ PASS |
| #8 404 catch-all | `src/index.js:45` → `app.use((req, res) => errorResponse(res, 'Not found', 404))` before errorHandler | ✅ PASS |

---

## Per-Module Findings

### auth/ — schema.js, service.js, controller.js, routes.js

**Schema** ✅ — all 4 schemas use correct `{ body: z.object({...}) }` shape; password min(8) enforced; email normalized to lowercase on register

**Service** ✅ — bcrypt cost factor 12; SALT_ROUNDS/REFRESH_TOKEN_EXPIRY_MS constants correct; sha256 hashing of token before DB storage (raw JWT never in DB); findValidRefreshToken correctly filters revoked=false + expires_at > now

**Controller** ✅ — register/login/refresh/logout all try/catch → next(err); req.validated.body used throughout; login omits password_hash from response via destructuring; register returns 201; refresh validates JWT signature before DB lookup

**Routes** ✅ — all 4 POST routes, all use validate()

**MEDIUM — `auth/controller.js:refresh` — Refresh token not rotated on use**

```js
// controller.js:44-51
const record = await authService.findValidRefreshToken(refreshToken);
if (!record || !record.user.is_active) return errorResponse(res, 'Invalid or expired refresh token', 401);
const accessToken = authService.signAccessToken({ ... });
return successResponse(res, { accessToken });
// ← old refresh token NOT revoked; same token usable again until it expires (7 days)
```

The same refresh token can be used repeatedly to generate new access tokens until it expires. If intercepted (e.g., via HTTPS log exposure, XSS, or stolen cookie), an attacker can generate valid access tokens indefinitely for 7 days.

Fix — revoke old + issue new before returning:
```js
await authService.revokeRefreshToken(refreshToken);
const newRefreshToken = authService.signRefreshToken({ userId: record.user.id });
await authService.storeRefreshToken(record.user.id, newRefreshToken);
return successResponse(res, { accessToken, refreshToken: newRefreshToken });
```

---

### users/ — schema.js, service.js, controller.js, routes.js

**Schema** ✅ — listUsers has correct query shape; updateUser all optional body fields

**Service** ✅ — USER_SELECT excludes password_hash; pagination via getPaginationParams; softDeleteUser sets is_active: false (correct)

**Controller** ✅ — 404 checks before update/delete; try/catch → next(err)

**Routes** ✅ — `router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'))` covers all routes

**HIGH — `users/routes.js` + `users/controller.js` — ADMIN can escalate to SUPER_ADMIN or demote SUPER_ADMIN**

```js
// routes.js:10 — ADMIN passes requireRole
router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

// controller.js:28 — no check on target role or requested role
const user = await userService.updateUser(id, req.validated.body);
// req.validated.body can include { role: 'SUPER_ADMIN' }
```

`updateUserSchema` allows `role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional()`. An ADMIN can:
1. Set their own role to `SUPER_ADMIN` (privilege escalation)
2. Downgrade an existing `SUPER_ADMIN` to `USER` (privilege sabotage)
3. Delete any user including `SUPER_ADMIN` via the DELETE route

Fix — in `updateUser` controller, add role guard:
```js
if (req.user.role === 'ADMIN') {
  if (req.validated.body.role === 'SUPER_ADMIN') {
    return errorResponse(res, 'ADMIN cannot assign SUPER_ADMIN role', 403);
  }
  if (exists.role === 'SUPER_ADMIN') {
    return errorResponse(res, 'ADMIN cannot modify SUPER_ADMIN users', 403);
  }
}
```
And on DELETE route, prevent non-SUPER_ADMIN from deleting SUPER_ADMIN:
```js
if (req.user.role !== 'SUPER_ADMIN' && exists.role === 'SUPER_ADMIN') {
  return errorResponse(res, 'Cannot delete SUPER_ADMIN user', 403);
}
```

---

### settings/ — schema.js, service.js, controller.js, routes.js

**Schema** ✅ — createSetting validates key/value/type/description/is_public correctly

**Service** ✅ — all 5 Prisma ops use singleton; correct isAdmin flag filtering

**Controller** ✅ — duplicate key check on create; 404 check on update/delete; isAdmin helper correctly uses `req.user?.role`

**Routes** ✅ — GET public (no auth), POST/PATCH require ADMIN+, DELETE requires SUPER_ADMIN

**HIGH — `settings/routes.js` — GET routes have no authenticate middleware; isAdmin check in controller is dead code**

```js
// routes.js:10-11 — no authenticate on GET routes
router.get('/', validate(listSettingsSchema), listSettings);
router.get('/:key', validate(getSettingSchema), getSetting);
```

```js
// controller.js:4 — isAdmin depends on req.user
const isAdmin = (req) => req.user && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
```

Because the `authenticate` middleware never runs on GET routes, `req.user` is always `undefined` for GET /api/settings and GET /api/settings/:key. `isAdmin()` always returns `false`. Result:
- `listSettings` always returns only public settings (private settings invisible to admins via GET)
- `getSetting` always returns 403 for private settings (even when called by an admin with valid token)

The HANDOFF.md described this as "Settings GET routes are unauthenticated — controller checks req.user to determine public/all". That intent cannot work without the authenticate middleware running on GET routes.

Fix — create an `optionalAuthenticate` middleware that sets `req.user` if a valid Bearer token is present, but calls `next()` either way (instead of rejecting on missing token):
```js
// middleware/auth.js — add export
export const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch {
      // invalid token — treat as unauthenticated
    }
  }
  next();
};
```
Then in settings routes:
```js
router.get('/', optionalAuthenticate, validate(listSettingsSchema), listSettings);
router.get('/:key', optionalAuthenticate, validate(getSettingSchema), getSetting);
```

---

### media/ — schema.js, service.js, controller.js, routes.js

**Schema** ✅ — listMedia/deleteMedia schemas correct; uploadMediaSchema is empty (acceptable — multer validates the file)

**Service** — see MEDIUM findings below

**Controller** ✅ — req.file check; try/catch → next(err); 404 on delete

**Routes** ✅ — router.use(authenticate) covers all routes

**MEDIUM — `media/service.js:uploadMedia` — Presigned URL (7-day expiry) stored permanently in DB**

```js
// storage.service.js:16-18
export const getFileUrl = async (objectName, expiry = 7 * 24 * 60 * 60) => {
  return minio.presignedGetObject(BUCKET, objectName, expiry);
};
// uploadFile calls getFileUrl → returns presigned URL with 7-day expiry

// media/service.js:9 — URL stored in DB
const url = await storageService.uploadFile(file, objectName);
return prisma.media.create({ data: { ..., url } });
```

After 7 days, `media.url` in the DB is an expired presigned URL. Any client using the stored URL gets a 403/expired-signature error from MinIO. There is no refresh or regeneration mechanism.

Fix — store only the object `path` (already stored as `media.path`); generate presigned URLs on demand in the list/get endpoints:
```js
// In media/service.js, remove url from uploadFile call
// Add to listMedia/getMedia responses:
const urlPromises = media.map(m => storageService.getFileUrl(m.path));
const urls = await Promise.all(urlPromises);
const mediaWithUrls = media.map((m, i) => ({ ...m, url: urls[i] }));
```
Or add a dedicated `GET /api/media/:id/url` endpoint that returns a fresh presigned URL.

**LOW — `media/routes.js:12` — Upload route missing validate() middleware**

```js
router.post('/upload', upload.single('file'), uploadMedia);
// every other route in this codebase calls validate() before the handler
```

`uploadMediaSchema` exists but is never used in the routes. While the schema is empty (nothing to validate), the inconsistency breaks the established pattern. Either add `validate(uploadMediaSchema)` to the route or remove the unused schema export.

---

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | HIGH | settings/routes.js + controller.js | GET routes missing authenticate → isAdmin dead code → admins can't access private settings |
| 2 | HIGH | users/routes.js + controller.js | ADMIN can escalate own role to SUPER_ADMIN or demote/delete SUPER_ADMIN users |
| 3 | MEDIUM | auth/controller.js:refresh | Refresh token not rotated — same token reusable for 7 days (token replay attack) |
| 4 | MEDIUM | media/service.js + storage.service.js | Presigned URL (7-day expiry) stored in DB → all media URLs expire after 7 days |
| 5 | LOW | media/routes.js:12 | Upload route missing validate(uploadMediaSchema) — inconsistent pattern |
| 6 | LOW | media/service.js:deleteMedia | DB delete after storage delete → if DB fails, file gone but record remains orphaned |
| 7 | INFO | auth/service.js | No cleanup of expired/revoked refresh tokens — DB table grows indefinitely |
| 8 | INFO | settings/schema.js + media/schema.js | z.object({}) no-op schemas produce req.validated = {} — acceptable but unusual |

---

## Recommendation

**PASS WITH REQUIRED FIXES**

Issues #1 and #2 are exploitable security bugs:
- #1 enables an authenticated admin to never see private settings (functionality broken)
- #2 enables privilege escalation: any ADMIN can grant themselves SUPER_ADMIN

Issues #3 and #4 degrade security/reliability:
- #3 increases the blast radius of a stolen refresh token from ~0 (rotation kills it) to 7 days
- #4 means all uploaded media becomes inaccessible after 7 days

**All 4 issues (#1–#4) must be fixed before Phase 4 (frontend).**

Issues #5–#8 can be addressed in the same fix pass or deferred.

---

*Reviewed by Code Reviewer Agent (KDL-14) on 2026-06-25*

---

# Phase 4 Code Review — KDL-20

**Reviewer:** Code Reviewer Agent (a38c5159)
**Date:** 2026-06-25
**Phase:** 4 — Frontend Build
**Scope:** All files under `frontend/` — config, lib, stores, hooks, components, pages
**Summary:** PASS WITH REQUIRED FIXES (2 CRITICAL + 4 HIGH before Phase 5)

---

## Checklist Pass

| Check | Result |
|-------|--------|
| No raw `fetch` — all API calls via `lib/axios.ts` | ✅ PASS |
| Zod on all forms | ✅ PASS |
| Auth state in Zustand `auth.store.ts` only — not component state | ✅ PASS |
| TypeScript strict + noUncheckedIndexedAccess; `tsc --noEmit` exit 0 | ✅ PASS |
| `useQuery` for reads, `useMutation` for writes | ✅ PASS |
| No `any` escapes in business logic | ✅ PASS |
| shadcn/ui components in `components/ui/` | ✅ PASS |

---

## CRITICAL Findings

### C1. Access token and refresh token stored in localStorage — XSS theft surface

**Files:**
- `src/stores/auth.store.ts:40-42` — `partialize` includes `accessToken` → persisted to `localStorage`
- `src/app/(auth)/login/page.tsx:51` — `localStorage.setItem('refreshToken', refreshToken)`
- `src/lib/axios.ts:42` — `localStorage.getItem('refreshToken')` during token refresh

**Impact:** Any XSS payload (injected script, prototype pollution, compromised dependency) can call `localStorage.getItem('accessToken')` and `localStorage.getItem('refreshToken')` and exfiltrate both tokens. The access token grants immediate API access. The refresh token (7-day lifetime) enables persistent account takeover that survives password changes unless the refresh token is explicitly revoked.

**Correct architecture:** Access token lives in memory (Zustand store non-persisted state). Refresh token is an httpOnly cookie set by the server — inaccessible to JavaScript. The middleware.ts SSR guard should read a separate, server-set httpOnly session cookie. This requires backend changes to set httpOnly cookies on login/refresh responses.

**Interim mitigation** (frontend-only): Remove `accessToken` from `partialize`. Store only `user` (for display) and `isAuthenticated` (for guard). On page reload, the `isAuthenticated` flag from localStorage triggers a silent refresh call to get a new access token before the first API call. The refresh token must also move out of localStorage.

---

### C2. Access token set in non-httpOnly cookie — JavaScript readable

**Files:**
- `src/app/(auth)/login/page.tsx:52` — `document.cookie = \`kdl-auth-token=${accessToken}; path=/; max-age=900; SameSite=Lax\``
- `src/lib/axios.ts:53` — same pattern in 401 refresh handler

**Impact:** The cookie is set via `document.cookie` without the `HttpOnly` flag. Any JavaScript on the page (including XSS payloads and third-party analytics scripts) can read `document.cookie` and extract the access token. The token is thus doubly exposed: both in localStorage (via Zustand persist) and in a readable cookie.

**Why it was done:** The HANDOFF notes "non-httpOnly so middleware.ts can gate /admin/*". However, middleware.ts only checks cookie *presence* (see H2 below), not validity. The security benefit of the middleware gate does not justify the XSS token exposure.

**Fix:** The `kdl-auth-token` cookie should be set server-side as `HttpOnly; Secure; SameSite=Lax`. The Next.js middleware can still read httpOnly cookies server-side. Remove the `document.cookie` assignment entirely from the frontend.

---

## HIGH Findings

### H1. `isLoading` never reset after Zustand persist rehydration — admin panel broken on page refresh

**Files:**
- `src/stores/auth.store.ts:26` — initial state `isLoading: true`
- `src/stores/auth.store.ts:40-44` — `partialize` stores only `user`, `accessToken`, `isAuthenticated` — NOT `isLoading`
- `src/app/(admin)/layout.tsx:19-21` — renders `<LoadingSpinner fullPage />` while `isLoading` is `true`

**What happens on page refresh:**
1. Zustand initializes with `isLoading: true`
2. Persist middleware rehydrates `user`, `accessToken`, `isAuthenticated` from localStorage
3. `isLoading` is NOT stored in localStorage, so it stays `true` — nothing in the codebase sets it to `false` post-hydration
4. `AdminLayout` sees `isLoading: true`, renders `<LoadingSpinner fullPage />` — forever
5. Authenticated users can never reach admin pages after a page refresh

**Verification:** Search the entire codebase — `setLoading(false)` is called only inside `setAuth` and `clearAuth`. Neither is called on page load for an already-authenticated user. The only path to `isLoading: false` requires a fresh login.

**Fix:** Add `onRehydrateStorage` to the persist config:
```ts
persist(
  ...,
  {
    name: 'kdl-auth',
    storage: createJSONStorage(() => localStorage),
    partialize: ...,
    onRehydrateStorage: () => (state) => {
      state?.setLoading(false)
    },
  }
)
```

---

### H2. `middleware.ts` checks cookie presence only — any non-empty value bypasses SSR guard

**File:** `frontend/middleware.ts:9`

```ts
const token = req.cookies.get('kdl-auth-token')?.value
if (!token) {
  return NextResponse.redirect(new URL('/login', req.url))
}
```

**Impact:** The check is `!token` — any non-empty string passes. An attacker who can set a cookie (via XSS, or by simply running `document.cookie = 'kdl-auth-token=anything'` in browser console) bypasses the SSR route guard and accesses SSR-rendered admin pages. The AuthGuard CSR component (admin/layout.tsx) still catches this client-side, but there's a window where the SSR shell renders before the redirect.

**Note:** The middleware cannot easily verify a JWT without the secret being available at the edge. The real fix is the architecture change from C2 — an httpOnly cookie set server-side should carry a session identifier, with validation happening at the API layer. As an interim guard improvement: the middleware is better understood as a "redirect hint" not a security control — accept this gap and ensure all data is auth-protected at the API layer (which it is).

---

### H3. Edit user form exposes SUPER_ADMIN role option to all ADMIN users

**Files:**
- `src/app/(admin)/users/_schemas.ts:6` — `z.enum(['USER', 'ADMIN', 'SUPER_ADMIN'])`
- `src/app/(admin)/users/page.tsx:239` — `<SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>` unconditional

**Impact:** Any authenticated ADMIN user sees the SUPER_ADMIN role option in the edit user dropdown. The backend correctly blocks the assignment (KDL-15 fix), but:
1. The UX is misleading — admins can select the option only to get a 403
2. Role name enumeration: the UI reveals the existence of a SUPER_ADMIN role to all admins

**Fix:** Gate the SUPER_ADMIN option on caller role. The caller role is available via `useAuth()`:
```tsx
const { isSuperAdmin } = useAuth()
// In the Select:
{isSuperAdmin && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
```

---

### H4. `queryClient` instantiated at module level — SSR shared cache risk

**File:** `src/lib/queryClient.ts:3`

```ts
export const queryClient = new QueryClient({ ... })
```

**Impact:** Module-level singletons in Next.js App Router are created once per process, not once per request. If any server component or SSR path imports this module, all concurrent server-side renders share the same query cache. A query result cached for User A would be served to User B on the next SSR render for the same queryKey.

**Current mitigation:** All admin pages are `'use client'`, so this module only executes client-side in the current implementation. Risk is real if any page is later refactored to use server rendering.

**Fix (TanStack Query + Next.js App Router recommended pattern):**
```tsx
// providers.tsx
const [queryClient] = useState(() => new QueryClient({ defaultOptions: { ... } }))
```
Move the `defaultOptions` config inline into the `useState` initializer. Delete `lib/queryClient.ts`.

---

## MEDIUM Findings

### M1. Forgot-password page calls a non-existent backend endpoint — broken feature

**File:** `src/app/(auth)/forgot-password/page.tsx:35`

```ts
mutationFn: (data: ForgotFormData) => api.post('/auth/forgot-password', data),
```

**Impact:** The backend auth module implements only `/register`, `/login`, `/refresh`, `/logout` (per KDL-13 STATUS.md). There is no `/auth/forgot-password` endpoint. Every submission returns 404. The page never transitions to the 'sent' confirmation step. This is a completely broken feature visible to end users.

**Fix:** Either implement the backend endpoint (Phase 3 extension) or remove/stub the page until the backend exists. Do not ship a UI button that always fails.

---

### M2. `Media` type has `url: string` (non-nullable) but backend schema is `url String?` (nullable)

**File:** `src/types/models.types.ts:30`

```ts
export interface Media {
  // ...
  url: string  // ← backend changed to String? (nullable) in KDL-15
}
```

**Impact:** The backend's `schema.prisma` changed `url` to `url String?` (nullable) in the KDL-15 fix. Any media endpoint response will include `url: null` for records created after the fix. TypeScript won't catch this at compile time (API responses are cast with `as` or inferred). Components that render `media.url` will display `"null"` as a string or throw depending on how the value is used.

**Fix:** Update to `url: string | null` or `url?: string | null`.

---

### M3. Missing `Secure` flag on session cookies — token transmitted over HTTP in production

**Files:**
- `src/app/(auth)/login/page.tsx:52` — `SameSite=Lax` but no `Secure`
- `src/lib/axios.ts:53` — same in refresh handler

**Impact:** Without the `Secure` flag, the browser will send the `kdl-auth-token` cookie over unencrypted HTTP connections. In production deployments behind an HTTPS load balancer, HTTP traffic may exist between the LB and the server. On mixed-content pages or misconfigured deployments, the token is exposed in cleartext.

**Fix (environment-conditional):**
```ts
const isSecure = window.location.protocol === 'https:'
document.cookie = `kdl-auth-token=${accessToken}; path=/; max-age=900; SameSite=Lax${isSecure ? '; Secure' : ''}`
```

---

### M4. `formatDate` utility throws on invalid date strings — no guard

**File:** `src/lib/utils.ts:10`

```ts
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt)  // throws if date is invalid
}
```

**Impact:** `new Date('invalid')` returns `Invalid Date`. `date-fns` `format()` throws on Invalid Date. Any server response with a malformed or null `created_at` field will crash the component tree. The Users page and Dashboard both call `formatDate(row.original.created_at)` without guarding.

**Fix:**
```ts
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = new Date(date)
  return isNaN(d.getTime()) ? '—' : format(d, fmt)
}
```

---

## LOW Findings

### L1. Dashboard Media Files stat is a static placeholder

**File:** `src/app/(admin)/dashboard/page.tsx:130` — `value="—"` hardcoded. No media endpoint called. Acceptable for initial build; document as TODO.

---

### L2. Dashboard uses `limit: 1` fetches to extract `pagination.total` for stat cards

**File:** `src/app/(admin)/dashboard/page.tsx:79-87`

Two separate requests (`/users?limit=1` and `/users?limit=1&is_active=true`) each fetch 1 user record just to read `pagination.total`. Wasteful. A dedicated stats endpoint or aggregated counts endpoint would reduce this to 1 request and eliminate the 1-record payloads.

---

### L3. `ErrorAlert` uses structural type cast instead of `isAxiosError` type guard

**File:** `src/components/shared/ErrorAlert.tsx:12`

```ts
const e = error as { response?: { data?: { message?: string } }; message?: string }
```

`import { isAxiosError } from 'axios'` provides a proper type guard that narrows to `AxiosError`. The current cast is correct for AxiosError shapes but won't distinguish Axios errors from other error types with the same shape. Low risk in this codebase since all errors come from axios, but the guard is safer.

---

### L4. `useMediaQuery` initial render always returns `false` — hydration mismatch potential

**File:** `src/hooks/useMediaQuery.ts:5`

Initial state is `false`. After hydration, `useEffect` fires and sets the real value. This causes a one-frame layout mismatch if the component conditionally renders based on the media query result. No current component in the codebase uses this hook, so impact is zero today.

---

### L5. AdminSidebar has a link to `/admin/media` which has no page implementation

**File:** `src/components/layout/AdminSidebar.tsx:21`

```ts
{ label: 'Media', href: '/admin/media', icon: Image, adminOnly: true },
```

There is no `src/app/(admin)/media/` page. Clicking this link returns a Next.js 404. Minor UX breakage; remove or hide until the media page is built.

---

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| C1 | CRITICAL | stores/auth.store.ts, login/page.tsx, axios.ts | Access + refresh tokens in localStorage — XSS theft enables full account takeover |
| C2 | CRITICAL | login/page.tsx:52, axios.ts:53 | Access token in non-httpOnly cookie — readable by JavaScript |
| H1 | HIGH | stores/auth.store.ts, admin/layout.tsx | `isLoading` never resets after persist rehydration — admin panel stuck on spinner after page refresh |
| H2 | HIGH | middleware.ts:9 | SSR route guard checks cookie presence only — any value bypasses the guard |
| H3 | HIGH | users/_schemas.ts:6, users/page.tsx:239 | SUPER_ADMIN role option shown to all ADMIN users — backend blocks but UI misleads |
| H4 | HIGH | lib/queryClient.ts:3, providers.tsx | queryClient module-level singleton — SSR shared cache risk if any page adds server rendering |
| M1 | MEDIUM | (auth)/forgot-password/page.tsx:35 | `/auth/forgot-password` endpoint doesn't exist on backend — feature permanently broken |
| M2 | MEDIUM | types/models.types.ts:30 | `Media.url: string` (non-nullable) but backend schema is `url String?` — null values cause runtime errors |
| M3 | MEDIUM | login/page.tsx:52, axios.ts:53 | Missing `Secure` cookie flag — token transmitted over HTTP in some production configs |
| M4 | MEDIUM | lib/utils.ts:10 | `formatDate` throws on invalid date — no guard for malformed server data |
| L1 | LOW | dashboard/page.tsx:130 | Media Files stat hardcoded `"—"` |
| L2 | LOW | dashboard/page.tsx:79-87 | Stats via `limit: 1` pagination total — wasteful, needs dedicated stats endpoint |
| L3 | LOW | components/shared/ErrorAlert.tsx:12 | Structural cast instead of `isAxiosError` type guard |
| L4 | LOW | hooks/useMediaQuery.ts:5 | SSR hydration mismatch on initial render |
| L5 | LOW | components/layout/AdminSidebar.tsx:21 | `/admin/media` link points to non-existent page — 404 |

---

## Recommendation

**PASS WITH REQUIRED FIXES**

CRITICAL issues C1 and C2 are architectural token storage decisions that introduce XSS token theft risk. They require backend changes (httpOnly cookie set server-side) for a proper fix, but interim mitigations are possible on the frontend (remove accessToken from partialize, remove the document.cookie assignment). These must be resolved before production deployment.

HIGH issue H1 is a functional regression: authenticated users cannot use the admin panel after any page refresh. This must be fixed before any QA or user testing.

HIGH issues H2 and H3 are security/UX hardening; H4 is a forward-looking correctness issue.

MEDIUM issues M1–M4 must be fixed before Phase 5. M1 (broken forgot-password) is visible to end users.

**Minimum required before Phase 5:**
1. C1 — Remove tokens from localStorage (or accept XSS risk with documented trade-off)
2. C2 — Remove `document.cookie` assignment from frontend (requires backend httpOnly cookie support)
3. H1 — Add `onRehydrateStorage: () => (state) => { state?.setLoading(false) }` to auth store persist config
4. M1 — Remove or stub the forgot-password page until the backend endpoint exists
5. M2 — Update `Media.url` type to `string | null`
6. M4 — Guard `formatDate` against invalid date input

---

*Reviewed by Code Reviewer Agent (KDL-20) on 2026-06-25*

---

# Phase 5 — AI Services Code Review — KDL-26

**Reviewer:** Code Reviewer Agent (a38c5159)
**Date:** 2026-06-25
**Phase:** 5 — AI Services
**Scope:** All 32 files under `ai-services/` — package.json, .env.example, src/index.js, utils, middleware, config, orchestrator, brains, memory, knowledge, chains, governance, agents, tools, workflows, controllers
**Summary:** PASS WITH REQUIRED FIXES (4 HIGH + 7 MEDIUM before Phase 5 gate)

---

## Checklist Pass

| Check | Result |
|-------|--------|
| ES Modules — no require/CommonJS | ✅ PASS — all 30 source files use import/export |
| Zod on all controller inputs | ✅ PASS — chat.js + embed.js both validate with Zod; transcribe is 501 stub |
| successResponse/errorResponse on all handlers | ✅ PASS — all routes, 404 handler, and controllers use the utility |
| try/catch in all controllers | ✅ PASS — chatController and embedController both wrapped |
| Prisma client from singleton | N/A — ai-services does not use Prisma |
| No direct disk writes for user data | ✅ PASS — BLOCKERS.md/MANUAL_TASKS.md writes are internal project files, not user uploads |
| No raw fetch in frontend | N/A — this is a backend service |
| No hardcoded port 6379 | ✅ PASS — redis.js fallback uses 6380 (host-mapped), REDIS_URL governs |
| No hardcoded port 5432 | N/A — no Postgres in ai-services |
| All loops have maxIterations | ✅ PASS — BaseAgent=10, BaseWorkflow=20 |
| On maxIterations → write BLOCKERS.md | ❌ FAIL — BaseAgent only console.warn; no BLOCKERS.md write (H1) |
| OpenRouter budget check before every call | ✅ PASS — brainRouter checks budget before OpenRouter calls |
| PII scrubbing before model calls | ✅ PASS — chatController calls scrubMessages before ragChain |
| JWT auth on all routes except /health | ✅ PASS — authenticate middleware on all 3 API routes |
| 404 catch-all before error handler | ✅ PASS — line 24 of index.js |

---

## CRITICAL Findings

None found.

---

## HIGH Findings (must fix before Phase 5 gate)

### H1 — `src/agents/base.js:41-43` — BaseAgent maxIterations hit: only console.warn, no BLOCKERS.md write

```js
if (iterations >= this.maxIterations) {
  console.warn(`[BaseAgent] maxIterations (${this.maxIterations}) reached for session ${this.sessionId}`);
}
```

CLAUDE.md non-negotiable rule #3: "On max iterations hit → write `BLOCKERS.md`". BaseWorkflow correctly writes BLOCKERS.md; BaseAgent does not. Three agent subclasses (ResearchAgent, ContentAgent, TaskAgent) all rely on BaseAgent.run() — none will ever write BLOCKERS.md.

**Fix:** Import `writeFile` and `join` from `fs/promises`/`path` in base.js, and mirror the BaseWorkflow pattern:
```js
if (iterations >= this.maxIterations) {
  await writeBlockers(`BaseAgent "${this.sessionId}" hit maxIterations (${this.maxIterations}).`);
}
```

---

### H2 — `src/orchestrator/brain-router.js:22-29` — auditLogger failure throws from brainRouter, blocking AI response delivery

```js
const response = useClaude ? await claudeBrain(...) : await openrouterBrain(...);

await auditLogger({...});        // ← no try/catch
if (!useClaude) await recordSpend(response.cost);  // ← no try/catch
```

`auditLogger` calls Redis (`LPUSH` + `LTRIM`). If Redis is temporarily unavailable, `auditLogger` throws, causing `brainRouter` to throw, causing the controller to return 500. The AI response was already computed but is discarded. Audit log failure must not block response delivery.

**Fix:** Wrap the post-response side-effects in try/catch:
```js
try {
  await auditLogger({...});
  if (!useClaude && response.cost) await recordSpend(response.cost);
} catch (auditErr) {
  console.error('[brain-router] audit/spend record failed:', auditErr.message);
}
```

---

### H3 — `src/index.js:26-29` — Error handler leaks raw err.message to clients in production

```js
app.use((err, req, res, _next) => {
  console.error(err);
  errorResponse(res, err.message ?? 'Internal server error', err.statusCode ?? 500);
});
```

`err.message` can contain internal file paths, Prisma/Redis/Anthropic API error strings, connection strings, or schema details. Exposed in production responses.

**Fix:** Gate on NODE_ENV:
```js
app.use((err, req, res, _next) => {
  console.error(err);
  const msg = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message ?? 'Internal server error');
  errorResponse(res, msg, err.statusCode ?? err.status ?? 500);
});
```

---

### H4 — `src/index.js` + `package.json` — No helmet, cors, or rate limiting on AI endpoints

`package.json` has no `helmet`, `cors`, or `express-rate-limit`. Backend uses all three. Without `helmet`, the AI service returns no security headers (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy). Without rate limiting, the `/api/ai/chat` endpoint is open to cost-amplification DoS — every unauthenticated or stolen-token request triggers an Anthropic/OpenRouter API call.

**Fix:** Add to `package.json`:
```json
"helmet": "^8.0.0",
"cors": "^2.8.5",
"express-rate-limit": "^7.0.0"
```
And in `index.js` after `const app = express()`:
```js
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }));
app.use('/api/ai', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true }));
```

---

## MEDIUM Findings (fix in Phase 6 or dedicated issue)

### M1 — Multiple files — console.log/error/warn used; no logger module in ai-services

Violations:
- `src/index.js:27` — `console.error(err)` in error handler
- `src/index.js:32` — `console.log('[ai-services] Running on port ...')`
- `src/config/redis.js:8` — `console.error('[redis] Error:', err.message)`
- `src/agents/base.js:42` — `console.warn('[BaseAgent] maxIterations...')`

CLAUDE.md: "Never use console.log — use logger." ai-services has no `src/utils/logger.js`. Backend has a Winston logger. AI services needs the same.

**Fix:** Create `src/utils/logger.js` (Winston, same pattern as `backend/src/shared/utils/logger.js`) and replace all console calls.

---

### M2 — `src/memory/short-term.js:19` — redis.keys() is O(N) blocking

```js
const keys = await redis.keys(`mem:short:${sessionId}:*`);
```

`KEYS` iterates the entire Redis keyspace and blocks the event loop. On a production instance with large keyspace, this causes latency spikes across ALL Redis operations (context manager, budget tracker, etc.).

**Fix:** Replace with `SCAN` iteration:
```js
let cursor = '0';
const keys = [];
do {
  const [nextCursor, found] = await redis.scan(cursor, 'MATCH', `mem:short:${sessionId}:*`, 'COUNT', 100);
  cursor = nextCursor;
  keys.push(...found);
} while (cursor !== '0');
if (keys.length > 0) await redis.del(keys);
```

---

### M3 — `src/controllers/chat.js:29` — Unscubbed PII written to MANUAL_TASKS.md

```js
const line = `... Message: ${message.slice(0, 100)}\n`;
await appendFile(MANUAL_TASKS_PATH, line).catch(() => {});
```

`message` is the original input before `scrubMessages(message)`. PII (emails, phone numbers, CC numbers) is written to `MANUAL_TASKS.md` on every budget-exhausted request.

**Fix:** Change `message.slice(0, 100)` → `scrubbed.slice(0, 100)` (the `scrubbed` variable is defined two lines earlier).

---

### M4 — `src/knowledge/ingest.js:32` — Unbounded parallel embed calls drain budget and hit rate limits

```js
const embeddings = await Promise.all(chunks.map(openrouterEmbed));
```

For a 10KB document (~22 chunks at 512 chars), this fires 22 simultaneous OpenRouter API calls with no concurrency limit. Exhausts the $2 daily budget on a single large document ingest, and may trigger API rate limit errors.

**Fix:** Process in sequential batches:
```js
const embeddings = [];
for (const chunk of chunks) {
  embeddings.push(await openrouterEmbed(chunk));
}
```
Or use a concurrency-limited batch (e.g., 5 at a time).

---

### M5 — `src/tools/search.js:3-4` — MeiliSearch master key used for search queries

```js
const MEILI_KEY = process.env.MEILI_MASTER_KEY ?? '';
// ...
Authorization: `Bearer ${MEILI_KEY}`,
```

`MEILI_MASTER_KEY` has admin-level access (can delete indexes, reset settings, generate API keys). Search queries should use a scoped API key with `search` permission only.

**Fix:** Add `MEILI_SEARCH_API_KEY` to `.env.example` and use it:
```js
const MEILI_KEY = process.env.MEILI_SEARCH_API_KEY ?? process.env.MEILI_MASTER_KEY ?? '';
```
Document in `.env.example`:
```
MEILISEARCH_HOST=http://localhost:7700
MEILI_SEARCH_API_KEY=your-search-only-api-key
```

---

### M6 — `src/workflows/base.js:4` + `src/controllers/chat.js:8` — process.cwd()-relative paths break if started outside ai-services/

```js
const BLOCKERS_PATH = join(process.cwd(), '..', 'BLOCKERS.md');      // base.js
const MANUAL_TASKS_PATH = join(process.cwd(), '..', 'MANUAL_TASKS.md');  // chat.js
```

If `process.cwd()` is the repo root (e.g., `node ai-services/src/index.js` from root), the paths resolve one level above the repo. This is the same class of bug as the Phase 2 logger path issue.

**Fix:** Use `import.meta.url`-relative paths (correct for ES modules):
```js
import { fileURLToPath } from 'url';
const __dir = fileURLToPath(new URL('.', import.meta.url));
const BLOCKERS_PATH = join(__dir, '../../../../BLOCKERS.md');  // base.js: 4 levels up to repo root
```
For `chat.js` (3 levels up from `controllers/`):
```js
const MANUAL_TASKS_PATH = join(__dir, '../../../..', 'MANUAL_TASKS.md');
```
Or better: centralise these paths in a `src/config/paths.js` module.

---

### M7 — `src/middleware/auth.js:13` — jwt.verify missing explicit algorithms option

```js
const payload = jwt.verify(token, process.env.JWT_SECRET);
```

No `algorithms` constraint. Defense-in-depth best practice: explicitly declare `{ algorithms: ['HS256'] }` to prevent algorithm confusion if the secret is ever changed to an asymmetric key or if the library's default behavior changes.

**Fix:**
```js
const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
```

---

## LOW / INFO

### L1 — `src/brains/openrouter.js:13` — COST_PER_TOKEN flat rate inaccurate for budget tracking

`COST_PER_TOKEN = 0.000002` is a rough estimate. Moonshot-v1-32k has different pricing; cost tracking will be wrong and may under/over-trigger the $2 daily budget guard.

### L2 — `src/agents/base.js:55-58` — _isTaskComplete substring match causes premature loop termination

Checking `result.includes('done')` and `result.includes('complete')` triggers on any sentence with these common words. ResearchAgent expects `DONE` marker; base class matching is too loose. Subclasses should always override `_isTaskComplete`.

### L3 — `src/config/chroma.js` — No connection error listener on ChromaClient

Redis has an error event listener; ChromaDB singleton does not. First failure throws on caller, with no upfront diagnostic log.

### L4 — `src/brains/claude.js:12,33` — Model hardcoded as string literal

`'claude-sonnet-4-6'` appears twice (claudeBrain + claudeBrainStream). Not env-configurable. Requires a code change to update the model. Add `CLAUDE_MODEL` env var with this as default.

---

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| H1 | HIGH | agents/base.js:41-43 | maxIterations hit: only console.warn, no BLOCKERS.md write — violates CLAUDE.md rule #3 |
| H2 | HIGH | orchestrator/brain-router.js:22-29 | auditLogger not try/catch — Redis failure blocks AI response delivery |
| H3 | HIGH | src/index.js:26-29 | Error handler leaks err.message in production — no NODE_ENV guard |
| H4 | HIGH | src/index.js + package.json | No helmet/cors/rate-limit — AI endpoints exposed to cost-amplification DoS |
| M1 | MEDIUM | index.js, redis.js, agents/base.js | console.log/error/warn — no logger module in ai-services |
| M2 | MEDIUM | memory/short-term.js:19 | redis.keys() O(N) blocking — use SCAN |
| M3 | MEDIUM | controllers/chat.js:29 | Original (unscubbed) message written to MANUAL_TASKS.md — PII leak |
| M4 | MEDIUM | knowledge/ingest.js:32 | Promise.all unbounded parallel embed calls — budget/rate-limit risk |
| M5 | MEDIUM | tools/search.js:3-4 | MeiliSearch master key used for search — should use scoped API key |
| M6 | MEDIUM | workflows/base.js:4, controllers/chat.js:8 | process.cwd() paths break when started outside ai-services/ |
| M7 | MEDIUM | middleware/auth.js:13 | jwt.verify missing algorithms option |
| L1 | LOW | brains/openrouter.js:13 | COST_PER_TOKEN hardcoded flat rate — budget tracking inaccurate |
| L2 | LOW | agents/base.js:55-58 | _isTaskComplete substring match too broad — premature loop exit risk |
| L3 | LOW | config/chroma.js | No ChromaDB connection error listener |
| L4 | LOW | brains/claude.js:12,33 | Model hardcoded as string — no env override |

---

## Recommendation

**PASS WITH REQUIRED FIXES — all 4 HIGH issues must be resolved before Phase 5 is approved.**

- H1 is a non-negotiable CLAUDE.md rule violation in BaseAgent.
- H2 is a runtime availability bug: any Redis hiccup kills all AI responses.
- H3 leaks internal error details to API consumers in production.
- H4 leaves the entire AI cost surface unprotected from abuse.

MEDIUM issues M1–M7 should be addressed in the Phase 5 fix pass or bundled into a Phase 6 cleanup issue.

---

*Reviewed by Code Reviewer Agent (KDL-26) on 2026-06-25*
