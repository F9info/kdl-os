# KDL Starter Kit — Agent Context

**Project:** KDL Starter Kit (kalamdreamlabs/kdl-starter-kit)
**Owner:** Kalam Dream Labs Pvt Ltd
**Human approver:** Prasanna (web@f9tech.com)
**Status:** Phase 1 in progress — ready to build.

---

## Project Overview

A generic, production-ready SaaS boilerplate that is also AI-agent buildable from day one. Every line of code is written by AI agents following the plan. Humans approve phases, not code. The finished product is the KDL OS Kit — a SaaS foundation with 6 core modules: Auth, Data Model Builder, Dynamic API, Admin Panel, Form Builder, Project Management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 + Express 5 + Prisma 6 |
| Database | PostgreSQL 15 (host port 5433) |
| Cache / Queue | Redis 7 (host port 6380) + BullMQ |
| Frontend | Next.js 15 App Router + TypeScript 5 |
| UI | TailwindCSS 3 + shadcn/ui + Zustand 5 + TanStack Query 5 |
| AI Services | LangChain.js + ChromaDB + OpenRouter API |
| Storage | MinIO (port 9000) |
| Search | MeiliSearch (port 7700) |
| Package manager | pnpm (monorepo) |

---

## Folder Structure

```
kdl-starter-kit/
├── backend/
│   ├── prisma/schema.prisma + seed.js
│   └── src/
│       ├── config/          database, redis, minio, meilisearch, chromadb
│       ├── middleware/       auth, rbac, validate, upload, errorHandler
│       ├── modules/
│       │   ├── auth/         routes, controller, service, schema
│       │   ├── users/        routes, controller, service, schema (RBAC-extended)
│       │   ├── settings/     routes, controller, service
│       │   ├── media/        routes, controller, service
│       │   └── user-management/
│       │       ├── roles/        routes, controller, service, schema
│       │       ├── permissions/  routes, controller, service, schema
│       │       ├── activity/     routes, controller, service, schema
│       │       └── shared/       permission-resolver.js, activity-logger.js
│       ├── shared/
│       │   ├── services/     email, storage, search
│       │   ├── queues/       email.queue.js
│       │   ├── workers/      email.worker.js
│       │   └── utils/        logger, response, pagination
│       └── index.js
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/       login, register, forgot-password
│       │   └── (admin)/      dashboard, users, settings
│       ├── components/
│       │   ├── layout/       AdminSidebar, TopBar, PageHeader
│       │   └── shared/       DataTable, Modal, ConfirmDialog, Pagination
│       ├── hooks/            useAuth, usePagination, useDebounce
│       ├── lib/              axios, queryClient, utils
│       ├── stores/           auth.store, ui.store
│       └── types/            api.types, models.types
├── ai-services/
│   └── src/
│       ├── orchestrator/     brain-router, budget-tracker, context-manager
│       ├── agents/           base, research, content, task
│       ├── tools/            rag, search, memory
│       ├── knowledge/        ingest, retrieve
│       ├── memory/           short-term (Redis), long-term (ChromaDB)
│       ├── workflows/        base, deterministic, non-deterministic
│       ├── governance/       audit-logger, compliance
│       ├── brains/           claude.js, openrouter.js
│       ├── chains/           rag-chain.js
│       └── controllers/      chat, embed, transcribe
├── infra/nginx/nginx.conf
├── .agents/                  CONTEXT.md, HANDOFF.md, DECISIONS.md, PROGRESS.md, REVIEW.md
├── tasks/                    backlog.md, current_task.md, completed/
├── docs/                     API_REFERENCE.md, ENV_REFERENCE.md, SETUP.md
├── docker-compose.yml
├── docker-compose.infra.yml  (infrastructure only — already running)
└── .env                      (all credentials filled in)
```

---

## Coding Conventions (non-negotiable)

- ES Modules (`import/export`) throughout backend — no CommonJS
- TypeScript strict mode in frontend
- Zod for ALL validation — no manual `if` checks on inputs
- `successResponse` / `errorResponse` from `utils/response.js` for ALL API responses
- Every controller function wrapped in `try/catch → next(error)`
- Prisma client imported from `config/database.js` singleton only — never `new PrismaClient()` directly
- All file uploads go through `storage.service.js` — never write to disk directly

---

## Patterns

- Backend modules follow: `routes → controller → service → Prisma`
- Frontend pages use: `useQuery` for reads, `useMutation` for writes
- Auth state lives in `auth.store.ts` (Zustand) — never in component state
- API calls go through `lib/axios.ts` — never raw `fetch`
- Background jobs go through BullMQ queues — never inline async calls for slow operations

### Permission middleware

Use `requirePermission(moduleName, action)` on any route that needs RBAC enforcement. It runs **after** `authenticate`.

```js
import { requirePermission } from '../../../middleware/permission.js';

router.get('/', authenticate, requirePermission('users', 'view'), listUsers);
router.post('/', authenticate, requirePermission('users', 'add'), createUser);
```

- Super Admin (`slug: 'super-admin'`) bypasses all checks — no permission rows needed.
- Suspended users and soft-deleted users get `403` from the resolver even with a valid token.
- On success, `req.userPermissions` is set to `{ bypass: bool, permissions: string[] }` for optional downstream use.
- Permission denied events are activity-logged automatically.
- Effective permission set cached in Redis (`perm:user:{id}`, TTL 600 s). Invalidated via `invalidatePermissionCache()` on any role/override mutation. Always call this in the **service layer**, not in controllers, to keep the single choke-point invariant.

### Activity logging

Every mutation in `user-management/` calls `writeActivity` or `writeActivityAsync` from `shared/activity-logger.js`. Always wrap in try/catch — a logging failure must never break the response.

```js
writeActivity({
  actor: req.user.id,
  module: 'roles',
  action: 'created',
  subject_type: 'RbacRole',
  subject_id: role.id,
  description: `Role "${role.name}" created`,
  properties: { ... },  // PII-scrubbed — no passwords, no tokens
  ip_address: getClientIp(req),
});
```

---

## Database Schema

### Base tables

```
users            id, name, email, password_hash, role(enum), is_active, status(UserStatus), avatar_media_id, last_login_at, deleted_at, created_at, updated_at
refresh_tokens   id, user_id, token_hash, expires_at, revoked
password_reset_tokens  id, user_id, token_hash, expires_at, used
app_settings     id, key, value, type, description, is_public
media            id, user_id, filename, original_name, mime_type, size, bucket, path, url
types            id, name, slug, is_active
categories       id, name, slug, type_id, is_active
setting_fields   id, field_name, slug, input_type, value, alt_text, options, type_id, category_id, sort
```

### RBAC tables (User Management module)

```
roles (RbacRole)       id, name, slug, description, is_system, created_at, updated_at
permission_modules     id, name, slug, label, is_system, sort_order, created_at
permissions            id, module_id, action(view|add|edit|delete|publish), created_at
role_permissions       [role_id, permission_id] — composite PK
user_roles             [user_id, role_id] — composite PK
user_permissions       [user_id, permission_id, mode(GRANT|DENY)] — composite PK
activity_logs          id, actor_id, module, action, subject_type, subject_id, description, properties(JSON), ip_address, created_at
```

### Enums

| Enum | Values |
|------|--------|
| `Role` (legacy, kept until Step 10) | `SUPER_ADMIN`, `ADMIN`, `USER` |
| `UserStatus` | `ACTIVE`, `SUSPENDED`, `PENDING` |
| `OverrideMode` | `GRANT`, `DENY` |

### Key relations

- `User` → many `UserRole` → `RbacRole` (multi-role assignment)
- `User` → many `UserPermission` (per-permission GRANT/DENY overrides)
- `RbacRole` → many `RolePermission` → `Permission` → `PermissionModule`
- `User` → many `ActivityLog` (as actor)

Seed: 1 SUPER_ADMIN → `admin@kdl.com / Admin@123`. System roles: `super-admin`, `admin`, `user`. System modules: `users`, `roles`, `permissions`, `settings`, `media`, `activity-log`.

---

## Two-Brain System

| Brain | When | Model |
|-------|------|-------|
| Claude (main) | CRITICAL / HIGH — architecture, security, decisions | claude-sonnet-4-6 via subscription |
| OpenRouter (budget) | MEDIUM / LOW — CRUD, components, routine tasks | moonshot-ai/moonshot-v1-32k |

OpenRouter API key is in `.env` as `OPENROUTER_API_KEY`.
Daily OpenRouter budget: $2.00. If exhausted → write task to `MANUAL_TASKS.md` and continue.

---

## Session Protocol (every agent, every session)

1. Read `CLAUDE.md` (this file)
2. Read `.agents/HANDOFF.md`
3. Read `STATUS.md`
4. Read `.agents/CONTEXT.md`
5. Read `ai-services/src/memory/lessons.md` if it exists
6. Do the work
7. Run tests / linters — never self-assess, use exit codes
8. Write `.agents/HANDOFF.md`
9. Append to `STATUS.md`

---

## Non-Negotiable Rules

1. **Maker ≠ Grader** — the agent that writes code never reviews it
2. **Every loop has a `maxIterations` hard cap** — no infinite loops
3. **On max iterations hit → write `BLOCKERS.md`** — never silently fail
4. **Never skip a phase approval gate** — Prasanna must confirm before next phase
5. **OpenRouter budget limit:** $2.00/day — log to `BUDGET.md`
6. **Security hook always-on** for backend agents (Agents 2, 3, 7)

---

## What Is NOT Built Yet

All 6 phases are complete. The following are known open items from code reviews:

**MEDIUM findings (post-Phase-5, not blocking):**
- M1 — No logger module in ai-services (console.* used)
- M2 — `redis.keys()` O(N) in `short-term.js` (use SCAN)
- M3 — Unscubbed original message written to MANUAL_TASKS.md on budget exhaust in `chat.js`
- M4 — Unbounded `Promise.all` for embed calls in `ingest.js`
- M5 — MeiliSearch master key used in `tools/search.js` (needs scoped API key)
- M6 — `process.cwd()` paths in `workflows/base.js` + `controllers/chat.js` (H1/H2 fixes used `import.meta.url` but M6 may still apply to BaseWorkflow)
- M7 — `jwt.verify` missing `{ algorithms: ['HS256'] }` in `ai-services/middleware/auth.js`

**Not yet implemented:**


- Whisper transcription (`POST /api/ai/transcribe` returns 501)
- Forgot-password backend endpoint (`/api/auth/forgot-password` — frontend shows static stub)

*(Documentation Agent updates this after each phase)*

---

## Common Mistakes to Avoid

- Never create `new PrismaClient()` directly — use singleton from `config/database.js`
- Never write files to disk directly — always use `storage.service.js`
- Never use raw `fetch` in frontend — always use `lib/axios.ts`
- Never hardcode port 6379 — Redis is on `REDIS_URL` from `.env` (mapped to 6380)
- Never hardcode port 5432 — PostgreSQL is on `DATABASE_URL` from `.env` (mapped to 5433)
- Never hardcode secrets in docker-compose.yml `environment:` blocks — use `${VAR}` substitution from `.env` via `env_file`
- Never give the frontend service `DATABASE_URL` or `REDIS_URL` — frontend is Next.js, it calls the backend API, never the DB directly
- In docker-compose.yml container environment blocks, DATABASE_URL uses `postgres:5432` (container-internal), not `localhost:5433` — these are different contexts
- Never use `new PrismaClient()` in seed.js — import from `config/database.js` singleton per the non-negotiable rule
- Never count processed jobs with a module-level counter in BullMQ workers — the counter never resets and permanently kills the worker after N jobs; the maxIterations rule applies to `for`/`while` loops, not event-driven workers
- Always start the email worker in index.js (`import './shared/workers/email.worker.js'`) — defining a Worker export is not enough; it must be instantiated to process jobs
- Log file paths in logger.js must be verified: from `backend/src/shared/utils/`, `../../../logs/` = `backend/logs/` (3 up), NOT `../../../../../logs/` (5 up = outside project)
- validate() middleware wraps schema input as `{ body, query, params }` — Phase 3 Zod schemas must use `z.object({ body: z.object({...}), ... })` and read from `req.validated.body`
- multer upload middleware must include a MIME type whitelist in `fileFilter` — no filter means any file type including executables can be uploaded (OWASP A04)
- Always add a 404 catch-all route (`app.use((req, res) => errorResponse(res, 'Not found', 404))`) before the error handler in index.js
- Health endpoints and all Express route handlers must use `successResponse` / `errorResponse` — no raw `res.json()`

- Settings GET routes that need to distinguish authenticated admins from anonymous users MUST use an `optionalAuthenticate` middleware that sets req.user if a valid Bearer token is present but does NOT reject unauthenticated requests — the standard `authenticate` middleware always rejects, making `req.user` dead code in public routes
- Never allow ADMIN role to set `role: 'SUPER_ADMIN'` on any user — validate that ADMIN callers cannot assign or interact with SUPER_ADMIN-level users in the users module
- Refresh tokens MUST be revoked on use (token rotation) — issue a new refresh token and revoke the old one in the /refresh handler; reusing the same token until expiry is a 7-day replay window
- Never store MinIO presigned URLs in the database — they expire (default 7 days); store only the object path and generate presigned URLs on demand when serving media responses

- Never store access tokens or refresh tokens in `localStorage` — XSS payloads can steal them; access tokens belong in memory (Zustand non-persisted state), refresh tokens belong in httpOnly cookies set by the server
- Never set session cookies with `document.cookie` — use httpOnly flag (server-set) so JavaScript cannot read them; middleware.ts can still read httpOnly cookies server-side
- Zustand `persist` with `partialize` does NOT persist `isLoading` — add `onRehydrateStorage: () => (state) => { state?.setLoading(false) }` to the persist config or the auth guard will show a spinner forever after page refresh
- Never instantiate `new QueryClient()` at module level in Next.js App Router — create it inside a React component with `const [queryClient] = useState(() => new QueryClient(...))` to prevent SSR shared cache leakage between requests
- Never ship a frontend form that calls a non-existent backend endpoint — if the backend route doesn't exist yet, remove or stub the UI rather than letting it silently fail with 404
- Always add the `Secure` cookie flag in production; gate it on `window.location.protocol === 'https:'` on the client side
- Always guard `new Date(str)` with `isNaN(d.getTime())` before passing to date-fns `format()` — `format(Invalid Date, ...)` throws and will crash the component tree
- Frontend type definitions must stay in sync with backend schema changes — when `schema.prisma` changes a field type (e.g., nullable), update `types/models.types.ts` to match

- Never wrap audit logging or side-effect calls inside `brainRouter` (or any response-path function) without try/catch — a Redis failure in `auditLogger` must not prevent the AI response from being delivered; always isolate side-effects so they fail silently
- Always add `helmet`, `cors`, and `express-rate-limit` to every Express service (backend and ai-services) — omitting them on AI endpoints creates cost-amplification DoS exposure where every request triggers a paid API call
- Always use `import.meta.url`-relative paths in ES Module files for writing project-level files (BLOCKERS.md, MANUAL_TASKS.md) — `process.cwd()` resolves to the launch directory, not the source file location, so it breaks when started from the repo root
- When using `process.cwd()` for file paths, document the required working directory or switch to `import.meta.url`: `const __dir = fileURLToPath(new URL('.', import.meta.url))`
- Never write the original (pre-scrub) user message to any file or log — always scrub PII before logging, even to internal files like MANUAL_TASKS.md
- Never use `redis.keys()` in application code — it is O(N) blocking; always use `redis.scan()` with cursor iteration for key pattern matching
- BaseAgent subclasses must write BLOCKERS.md on maxIterations hit — console.warn alone violates the non-negotiable rule; mirror the BaseWorkflow pattern
- Never use MEILI_MASTER_KEY in application code for search queries — always use a scoped search-only API key (`MEILI_SEARCH_API_KEY`) with minimal permissions
- Always guard `err.message` in Express error handlers with a `NODE_ENV !== 'production'` check — raw error messages can leak file paths, connection strings, and API error details
- Always specify `{ algorithms: ['HS256'] }` in `jwt.verify` calls — explicit algorithm constraint prevents algorithm-confusion attacks if key type ever changes

*(Code Reviewer appends to this after each phase review)*
