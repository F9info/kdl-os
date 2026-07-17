<!-- Read this FIRST for orientation instead of scanning the repo. Regenerate only on structural change. Generated 2026-07-16. -->

# WORKSPACE MAP — kdl-starter-kit

One-read orientation for agents. Purpose: avoid re-discovering the repo every run (directory sprays cost 70k–111k tokens on cold runs). If a path here is wrong, fix it here — don't re-scan the whole tree.

**Repo:** github.com/F9info/kdl-os · monorepo (pnpm) · branch `master`
**Stack:** Node 20 + Express 5 + Prisma 6 · PostgreSQL 15 · Redis 7 + BullMQ · Next.js 15 (App Router, TS) · Tailwind + shadcn/ui + Zustand + TanStack Query · LangChain.js + ChromaDB + OpenRouter (ai-services runtime only) · MinIO · MeiliSearch

## Top-level layout

| Path | What |
|------|------|
| `backend/` | Express API + Prisma. Entry `src/index.js`. Modules under `src/modules/<slug>/` |
| `frontend/` | Next.js app. Pages under `src/app/(auth)` and `src/app/admin/<slug>/` |
| `ai-services/` | AI runtime (port 5000): orchestrator, agents, RAG, memory, brains |
| `agents/*.json` | Agent config **reference** (stale-prone; live source = Paperclip control plane) |
| `.agents/` | Specs (`*_ARCH.md`), `HANDOFF.md`+archive, `DECISIONS.md`, `LESSONS.md`, `CONTEXT.md`, this map |
| `tasks/` | `backlog.md`, per-agent outputs |
| `docs/` | `API_REFERENCE.md`, `ENV_REFERENCE.md`, `SETUP.md` |
| `STATUS.md` (root) | Rolling status log (+ `.agents/STATUS_ARCHIVE.md`) |

## Backend modules (`backend/src/modules/`)

`auth` · `users` · `settings` · `media` (DAM) · `user-management/{roles,permissions,activity,shared}` · `template-engine` · `page-builder` (WIP, Puck)
Pattern: `routes → controller → service → Prisma`. Prisma client singleton: `config/database.js`. Responses: `utils/response.js`. Per-module Prisma schema: `backend/prisma/schema/<slug>.prisma`. Module manifest: `module.json`. Scaffold: `npm run module:create -- --slug=x --name="X"`.

## Frontend key dirs (`frontend/src/`)

`app/(auth)/` login·register·forgot-password · `app/admin/` dashboard·users·settings·media·template-engine·page-builder · `components/{layout,shared,media}` · `stores/{auth,ui}.store.ts` · `lib/{axios,queryClient}.ts` · `hooks/`. Rules: API via `lib/axios.ts`; auth in `auth.store.ts`; reads `useQuery`, writes `useMutation`.

## Services & ports (host)

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5433 | `DATABASE_URL`; container-internal `postgres:5432` |
| Redis | 6380 | `REDIS_URL`; container-internal `redis:6379` |
| MinIO | 9000 | object storage; access via `storage.service.js` only |
| MeiliSearch | 7700 | search |
| ChromaDB | 8000 | vector store (ai-services) |
| ai-services | 5000 | `/api/ai/chat`, `/embed`, `/transcribe` (501) |
| Frontend app (local QA) | 3101 | admin login `admin@kdl.com` / `SEED_ADMIN_PASSWORD` (docker default `kdl-dev-seed-password`) |

## Where to look first for common tasks

- Add a module → `backend/src/modules/` + `prisma/schema/<slug>.prisma` + `frontend/src/app/admin/<slug>/` (see CLAUDE.md "How to add a module").
- Permissions/RBAC → `user-management/` + `middleware/permission.js` (`requirePermission`).
- Theming/settings → `template-engine/` + `settings/` (SettingValue, token resolver).
- Coding conventions & pitfalls → `CLAUDE.md` + `.agents/LESSONS.md`.
- Module specs → `.agents/<MODULE>_ARCH.md` (each has a "Read Scope" table — use it instead of whole-file reads).
