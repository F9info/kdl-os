# KDL Starter Kit — Task Backlog

## CURRENT PHASE: Phase 1 — Root Infrastructure

**Phase 1 Goal:** Docker Compose boots all 9 app services cleanly.  
**Lead Agent:** DevOps (Agent 6)  
**Approval gate:** Prasanna runs `docker compose up` — all services start

---

## TODO — Phase 1

- [ ] Write `docker-compose.yml` — all 9 services (postgres, redis, backend, frontend, minio, meilisearch, chromadb, ai-services, nginx). Note: postgres on host port 5433, redis on host port 6380.
- [ ] Write `docker-compose.prod.yml` — production overrides
- [ ] Write `infra/nginx/nginx.conf` — reverse proxy config
- [ ] Create full folder scaffold (backend/src/, frontend/src/, ai-services/src/ with all subfolders from KDL_DevEnvironment.md Part G)
- [ ] Write `docs/ENV_REFERENCE.md` — all env vars documented (Documentation Agent)

---

## IN PROGRESS

*(Orchestrator moves tasks here when assigning)*

---

## DONE

*(Orchestrator moves tasks here after engineer_output.md confirms completion)*

---

## PHASE 2 — Backend Foundation *(locked until Phase 1 approved)*

- [ ] prisma/schema.prisma (4 base tables: users, refresh_tokens, app_settings, media)
- [ ] prisma/seed.js (admin via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
- [ ] backend/package.json (all deps)
- [ ] backend/src/config/ (database, redis, minio, meilisearch, chromadb)
- [ ] backend/src/middleware/ (auth, rbac, validate, upload, errorHandler)
- [ ] backend/src/shared/ (email service, storage service, queue, worker, utils)
- [ ] backend/src/index.js (entry point, all routes registered)

## PHASE 3 — Backend Modules *(locked until Phase 2 approved)*

- [ ] modules/auth/ (register, login, logout, refresh, forgot/reset password)
- [ ] modules/users/ (CRUD + role management + status toggle)
- [ ] modules/settings/ (get all, get by key, update)
- [ ] modules/media/ (upload, list, delete via MinIO)

## PHASE 4 — Frontend *(locked until Phase 3 approved)*

- [ ] frontend/package.json + config files
- [ ] src/lib/, src/stores/, src/types/, src/hooks/
- [ ] src/components/layout/ and src/components/shared/
- [ ] (auth) pages: login, register, forgot-password
- [ ] (admin) pages: dashboard, users, settings

## PHASE 5 — AI Services *(locked until Phase 4 approved)*

- [ ] brain-router.js, budget-tracker.js, context-manager.js
- [ ] agents/, tools/, knowledge/, memory/, workflows/, governance/
- [ ] brains/claude.js, brains/openrouter.js
- [ ] controllers: chat, embed, transcribe

## PHASE 6 — DevOps & Final *(locked until Phase 5 approved)*

- [ ] backend/Dockerfile, frontend/Dockerfile, ai-services/Dockerfile
- [ ] .github/workflows/ci.yml
- [ ] .github/workflows/deploy-staging.yml
- [ ] Finalize all docs
