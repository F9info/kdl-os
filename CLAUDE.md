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

The full folder map lives in **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** (moved out of this
always-loaded file to cut per-heartbeat tokens — KDL-336). Read it when you need the layout.
Top level: `backend/` (Express + Prisma), `frontend/` (Next.js), `ai-services/`, `infra/`,
`.agents/`, `tasks/`, `docs/`.

---

## Common Commands

Each workspace (`backend/`, `frontend/`, `ai-services/`) has its own `package.json` — there is no root-level script runner. `backend` and `ai-services` use `npm`; `frontend` uses `pnpm`.

```bash
# Backend (npm)
cd backend
npm run dev                 # nodemon src/index.js
npm test                    # vitest run — needs JWT_SECRET / JWT_REFRESH_SECRET (32+ chars) in env
npx vitest run path/to/file.test.js          # single test file
npx vitest run path/to/file.test.js -t "name"  # single test by name
npm run db:migrate          # prisma migrate dev
npm run db:seed             # prisma/seed.js
npm run db:studio           # prisma studio
npm run module:create -- --slug=blog --name="Blog"   # scaffold a new module

# Frontend (pnpm)
cd frontend
pnpm dev                    # next dev --port 3000
pnpm build
pnpm lint                   # next lint (includes a11y rules)
pnpm type-check             # tsc --noEmit
pnpm format:check           # prettier --check .
pnpm test                   # vitest run
pnpm test path/to/file.test.tsx              # single test file
pnpm e2e                    # playwright test (needs a running backend + Postgres/Redis)
pnpm e2e e2e/smoke.spec.ts  # single e2e spec

# AI services (npm)
cd ai-services
npm run dev                 # node --watch src/index.js
npm test                    # vitest run — needs JWT_SECRET in env
npx vitest run path/to/file.test.js          # single test file
```

Neither `backend` nor `ai-services` has a lint script — only `frontend` does.

Full CI-mirroring sequence (lockfile guard, audits, lint/typecheck/build/test per workspace) is in [`docs/CI_LOCAL_VERIFICATION.md`](docs/CI_LOCAL_VERIFICATION.md) — use it when GitHub Actions is down and a PR needs local verification.

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

Full module authoring guide (scaffold generator, `module.json` format, anatomy, and the
pre-review checklist) lives in **[`docs/MODULE_GUIDE.md`](docs/MODULE_GUIDE.md)** — moved out of
this always-loaded file (KDL-336). Read it before scaffolding or reviewing a module.

Quick start: `cd backend && npm run module:create -- --slug=blog --name="Blog"`.

---

## Database Schema

Full table/enum/relation reference lives in
**[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) → Database Schema** (moved out of this
always-loaded file — KDL-336). Read it when working on models or migrations.
Base tables: `users`, `refresh_tokens`, `media`, `app_settings`, `types`, `categories`, …
RBAC tables: `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions`,
`activity_logs`.

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
3. Read `STATUS.md` — the **generated rollup** at the top answers "what is done vs pending" (module build state, template-engine driver reality, true PR merge state, blocked issues + unblock owners); below it is a rolling window of recent entries, with older history in `.agents/STATUS_ARCHIVE.md`
4. Read `.agents/CONTEXT.md`
5. Read `ai-services/src/memory/lessons.md` if it exists
6. Do the work
7. Run tests / linters — never self-assess, use exit codes
8. **Prepend** your new entry to the top of `.agents/HANDOFF.md`; keep the window to ~8 entries (move older ones into `.agents/HANDOFF_ARCHIVE.md`)
9. **Prepend** your entry under the `## Rolling changelog` heading in `STATUS.md` — **not** at the top of the file, which is a generated block. Keep the window trimmed (older entries → `.agents/STATUS_ARCHIVE.md`)
10. Run `node scripts/status-rollup.mjs` if you changed a module's build state, a template-engine driver, or a blocked issue's owner. It rewrites only the region between the `BEGIN/END GENERATED ROLLUP` markers and leaves the changelog untouched. Curate unblock owners in `.agents/unblock-owners.json` when the board carries no `unblockDescriptor`

---

## Merge Discipline (non-negotiable — every agent that touches git)

Full rules in [`docs/MERGE_DISCIPLINE.md`](docs/MERGE_DISCIPLINE.md). Summary:

1. **Rebase before CI** — `git fetch && git rebase origin/master` before every push. Never write a `fix(ci):` commit; rebase instead.
2. **One concern per PR** — feature, lockfile update, or CI change. Never mix.
3. **One workspace lockfile per PR** — a PR may touch `frontend/pnpm-lock.yaml` OR `backend/package-lock.json` OR `ai-services/package-lock.json`, never more than one.
4. **Dependabot owns lockfiles** — never manually modify a lockfile in a Dependabot PR. Merge them Mondays.
5. **Pin policy** — pin only when there is a confirmed bug/CVE and no upstream fix. Document the reason and removal trigger in the PR. Never pin the same package twice across workspaces.
6. **NEVER push directly to master** — all code lands via `gh pr merge` or the GitHub UI. Direct pushes cause GitHub to close open PRs with `mergedAt=null`, corrupting the audit trail. If CI is broken org-wide, mark the issue blocked — do not bypass the PR workflow. (Retired workaround: the 2026-08 billing-outage direct-push path. See §7 of [`docs/MERGE_DISCIPLINE.md`](docs/MERGE_DISCIPLINE.md).)

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

All 6 phases are complete. Verified against the code on 2026-10-18 (the previous list here was stale):

**Fixed since the earlier review (do not re-open):** M1 logger (`ai-services/src/utils/logger.js`), M2 `redis.keys()` → `scan`, M4 bounded embeds (`p-limit`), M5 scoped Meili key, M6 `import.meta.url` paths, M7 `jwt.verify` HS256, M3 mostly (message is scrubbed and now collapsed to one line). Whisper transcription (`controllers/transcribe.js`) and forgot-password (`POST /api/auth/forgot-password`) are implemented.

**Open (see `docs/PLATFORM_ROADMAP_AND_MOBILE_MODULES.md` §3 for the full list):**
- *(Fixed 2026-11-06)* Chroma tenant isolation: one collection per tenant (`ai-services/src/knowledge/tenant.js`, name = base + sha256(tenant)), tenant from the verified JWT (`tenantId` claim, else `user:<id>`; never the request body), missing tenant throws (fail closed). Applies to knowledge, long-term memory, RAG, agents. Org-wide shared knowledge now needs a signed `tenantId` claim from the backend (none is issued yet).
- *(Fixed 2026-11-06)* ai-services per-caller rate limits (`AI_LIMIT_CHAT|EMBED|TRANSCRIBE|BRAND_INFERENCE`, per 15 min, in-memory), role gates (brand-inference = backend service JWT only; embed = service or admin), embed budget gate + embed cost metering, Claude spend in its own un-gated Redis ledger `budget:claude:<day>` (`getBudgetStatus().claude_spent`). Still open: Claude spend has no cap, limits are per instance.
- *(Fixed 2026-11-06)* Project-membership checks on credits / brand-kit / collateral routes: `requireProject` now takes `'param'` or a resolver `(req) => projectId` (asset / render / hold lookups); tests in `backend/src/modules/project-scoping.route.test.js`.
- *(Fixed 2026-11-06)* PII scrubber now also covers Aadhaar, PAN and Indian mobiles (`ai-services/src/governance/compliance.js`).
- Mobile prerequisites: *(done 2026-11-06)* app-config endpoint (`/api/app-config`, T1.1) and API versioning (`/api/v1/*` alias via `backend/src/middleware/api-version.js`, `X-API-Version` header). *Still open:* OpenAPI spec (needs a zod-to-openapi style dependency — stack is locked, needs board approval), ETag / `updated_since`, device sessions + logout-all, push notifications.

*(Documentation Agent updates this after each phase)*

---

## Common Mistakes to Avoid

The full running list of common mistakes and per-phase code-review findings now lives in `.agents/LESSONS.md` (moved out of this always-loaded file to cut per-run token cost). Read it when working in the relevant module; the Code Reviewer appends new lessons there.
