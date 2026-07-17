# Architecture Reference

Stable reference material moved out of the always-loaded `CLAUDE.md` (KDL-336) to cut
per-run token cost. Read this on-demand when you need the folder map or DB schema.

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
