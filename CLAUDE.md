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

> **The tech stack below is LOCKED (2026-07-16).** Agents must not change, replace, swap, or remove any part of it. If a genuine gap exists (a missing library/tool/service the project needs), the CEO *proposes* it to the board for approval — it is never added unilaterally.

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

## How to add a module

### Quick start — scaffold generator

```bash
cd backend
npm run module:create -- --slug=blog --name="Blog"
# OR: node scripts/create-module.js --slug=blog --name="Blog"
```

Creates `backend/src/modules/blog/` (module.json, routes.js, controller.js, service.js, schema.js, seed.js), `backend/prisma/schema/blog.prisma`, and `frontend/src/app/admin/blog/page.tsx`. Files that already exist are skipped (safe to re-run).

---

### Module anatomy

```
backend/src/modules/<slug>/
├── module.json      manifest (Zod-validated at startup)
├── routes.js        Express router — auto-mounted by module-loader
├── controller.js    thin handlers: parse, call service, respond
├── service.js       business logic + Prisma + writeActivityAsync
├── schema.js        Zod schemas for request bodies
└── seed.js          idempotent seed data (optional)

backend/prisma/schema/<slug>.prisma   Prisma models for this module only
frontend/src/app/admin/<slug>/page.tsx  wrapped in <ModuleGuard slug="<slug>">
```

---

### module.json format

```jsonc
{
  "slug": "blog",                  // lowercase alphanumeric + hyphens; must match folder name
  "name": "Blog",                  // display name
  "version": "1.0.0",             // semver
  "description": "Blog posts",    // optional
  "core": false,                   // true = always ENABLED, never uninstallable
  "apiPrefix": "/api/blog",        // must start with /api/
  "permissions": ["blog"],         // permission module names to auto-register on install
  "nav": [                         // sidebar nav entries shown when module is ENABLED
    {
      "label": "Blog",
      "path": "/blog",
      "icon": "FileText",          // lucide-react icon name
      "permission": "blog:view"    // optional — hide entry if user lacks this
    }
  ],
  "dependsOn": [],                 // slugs that must be INSTALLED before this can install
  "queues": [],                    // BullMQ queue names (informational — not enforced yet)
  "env": []                        // required env var names — install fails if any are missing
}
```

---

### New module checklist

Before submitting for code review, verify every item:

- [ ] `module.json` is Zod-valid; `slug` matches the folder name, `apiPrefix`, and prisma schema filename
- [ ] All Prisma models live in `prisma/schema/<slug>.prisma` only — never mixed with other modules
- [ ] `npx prisma migrate dev` applies cleanly; `npx prisma validate` exits 0
- [ ] All routes are behind `moduleGate(slug)` + `authenticate` + `requirePermission`
- [ ] Permissions are registered via the `permissions` array in manifest — never via manual seeder edits
- [ ] Every mutation calls `writeActivityAsync` (PII-scrubbed — no passwords or tokens in `properties`)
- [ ] Frontend pages are wrapped in `<ModuleGuard slug="<slug>">` and nav comes from the manifest only
- [ ] Module works correctly when other non-core modules are disabled (no cross-module coupling)
- [ ] Disable → re-enable round-trip leaves no orphaned DB state

---

## Database Schema

### Base tables

```
users            id, name, email, password_hash, role(enum), is_active, status(UserStatus), avatar_media_id, last_login_at, deleted_at, created_at, updated_at
refresh_tokens   id, user_id, token_hash, expires_at, revoked
password_reset_tokens  id, user_id, token_hash, expires_at, used
app_settings     id, key, value, type, description, is_public
media            id, user_id, folder_id?, filename, original_name, mime_type, size, bucket, path, type(MediaType), title?, alt_text?, caption?, width?, height?, duration?, variants(Json?), deleted_at?
media_folders    id, name, parent_id?(self-ref), created_by — @@unique([parent_id, name]); max depth 6
media_usages     id, media_id, entity, entity_id — @@unique([media_id, entity, entity_id]); blocks delete when present
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

Seed: 1 SUPER_ADMIN → `SEED_ADMIN_EMAIL` (default `admin@kdl.com`) with `SEED_ADMIN_PASSWORD` if set, else a random password printed once (production refuses to seed without it). The local docker stack pins `kdl-dev-seed-password`. System roles: `super-admin`, `admin`, `user`. System modules: `users`, `roles`, `permissions`, `settings`, `media`, `activity-log`.

---

## Model Allocation (live — 2026-07-16)

All agents run on the **Claude Code adapter (Claude subscription)** via the Paperclip control plane, which is the single source of truth. The old OpenRouter/opencode "budget brain" is retired.

| Tier | Agents | Model |
|------|--------|-------|
| Orchestration | CEO | Default (resolves to Sonnet 5) · Thinking effort: Medium |
| Implementation | Backend Coder, Frontend Coder | Claude Sonnet 4.6 |
| Design / review / routine | Architects, Code Reviewer, Security, AI Services | Claude Fable 5 |
| Ops / docs / QA | DevOps, Documentation, QA | Claude Sonnet 4.6 |
| Cheap profile | (all) | Claude Fable 5 — used for routine summaries |

> Historical note: earlier revisions of this repo and `agents/*.json` referenced an OpenRouter/moonshot "budget brain" and a $2/day cap. That path is retired — do not re-introduce OpenRouter budget logic. Per-agent $ budgets are moot while on the subscription adapter.

---

## Session Protocol (every agent, every session)

1. Read `CLAUDE.md` (this file)
2. Read `.agents/HANDOFF.md` — a **rolling window of only the most recent entries**; read `.agents/HANDOFF_ARCHIVE.md` ONLY if you need older context
3. Read `STATUS.md` — rolling window of recent entries only; older history in `.agents/STATUS_ARCHIVE.md`
4. Read `.agents/CONTEXT.md`
5. Read `ai-services/src/memory/lessons.md` if it exists
6. Do the work
7. Run tests / linters — never self-assess, use exit codes
8. **Prepend** your new entry to the top of `.agents/HANDOFF.md`; keep the window to ~8 entries (move older ones into `.agents/HANDOFF_ARCHIVE.md`)
9. **Prepend** to `STATUS.md`; keep the window trimmed (older entries → `.agents/STATUS_ARCHIVE.md`)

---

## Merge Discipline (non-negotiable — every agent that touches git)

Full rules in [`docs/MERGE_DISCIPLINE.md`](docs/MERGE_DISCIPLINE.md). Summary:

1. **Rebase before CI** — `git fetch && git rebase origin/master` before every push. Never write a `fix(ci):` commit; rebase instead.
2. **One concern per PR** — feature, lockfile update, or CI change. Never mix.
3. **One workspace lockfile per PR** — a PR may touch `frontend/pnpm-lock.yaml` OR `backend/package-lock.json` OR `ai-services/package-lock.json`, never more than one.
4. **Dependabot owns lockfiles** — never manually modify a lockfile in a Dependabot PR. Merge them Mondays.
5. **Pin policy** — pin only when there is a confirmed bug/CVE and no upstream fix. Document the reason and removal trigger in the PR. Never pin the same package twice across workspaces.

---

## Non-Negotiable Rules

1. **Maker ≠ Grader** — the agent that writes code never reviews it
2. **Every loop has a `maxIterations` hard cap** — no infinite loops
3. **On max iterations hit → write `BLOCKERS.md`** — never silently fail
4. **(Updated 2026-07-16)** Full autonomy — the CEO drives all phases without human approval gates. The user's only steering lever is the company Goal/milestones; all work must trace to them and stay in scope. (Supersedes the earlier "Prasanna must confirm before next phase" rule.)
5. **(Retired)** OpenRouter budget rule no longer applies — all agents run on the Claude subscription adapter (see Model Allocation). `BUDGET.md` is deprecated.
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

The full running list of common mistakes and per-phase code-review findings now lives in `.agents/LESSONS.md` (moved out of this always-loaded file to cut per-run token cost). Read it when working in the relevant module; the Code Reviewer appends new lessons there.
