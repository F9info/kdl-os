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

## Module system

Every feature is a folder `backend/src/modules/<slug>/` with a `module.json` manifest (full format in [`MODULE_GUIDE.md`](MODULE_GUIDE.md)). The manifest is the single source of truth:

- **Discovery:** `shared/modules/module-loader.js` reads every manifest at boot and validates it (`manifest-schema.js`) and the whole graph (`module-graph.js`).
- **Routes:** optional modules are mounted behind `moduleGate(slug)`, which answers 404 unless the module is ENABLED in the `modules` table; core modules are always on.
- **Lifecycle:** install and enable pull in dependencies first, disable is refused while an enabled module depends on it, uninstall needs the module disabled (`modules/modules/service.js`).
- **Navigation and permissions:** the admin sidebar is built from enabled modules' `nav`; each module registers its own permissions from `permissions`.
- **Seeders:** a module's optional `seed.js` runs inside its install transaction.
- **Groups:** `group` (core, cms, membership, studio, platform) organises the install screen; it never gates anything.

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

## Page addresses (route keys)

Every page has one stored address name, `builder_pages.route_key` (`"home"`, `"about-us"`), set when the page is made
and not changed when its title is edited. `backend/src/shared/page-routes.js` is the only code that turns keys into
addresses; the site generator, the public page lookup (`/api/page-builder/public/...`), the sitemap, the menus
(`getPublicMenu`) and website-copy generation all call it.

- `deriveRouteKey` gives a new page its key: the stage key in a generated slug (`te-<run>-<key>`), `home` for a slug
  ending in `-home`, else the slugified title, else the slug. Pages made by the website stage, the starter site,
  the landing templates and the Page Builder all set it on creation.
- `pickHome` chooses the front page: the published page with key `home` (oldest first); a draft only when none is
  published. `assignRoutes` makes routes unique (`about`, `about-2`), keeps them off platform paths (`admin-page`) and
  gives the front page `""`.
- The key is **not unique** by itself (old drafts can share `home`); uniqueness is decided per site by `assignRoutes`.
- Migration `20261114000000_builder_page_route_key` adds the column and keys generated pages from their slug; the rest are
  keyed at backend start by `backfillRouteKeys` (idempotent, keeps `updated_at`). Until then a page with no key gets the
  address it always had (`routeKeyOf` falls back to `deriveRouteKey`).
- The website stage's `pageKeyToId` map is still written (the Pages view reads it) but is no longer used to decide an address.

## Company logo and name

The logo and company name are set once, in Application Identity (the installer's Company step, then Settings > Identity). Nothing
else owns them.

- **Brand-logo blocks** (`NavBar`, `Footer`, `TaglineStrip`, `ConstructionHeader`, `ConstructionFooter`, `ConstructionTaglineStrip`,
  `MedicalTopNav`) read Identity themselves, wherever they are drawn: the live site, the editor canvas, previews
  (`frontend/src/frontend/blocks/packs/live-brand.tsx`, applied for every block in `composePacks`). The company logo wins over the app
  logo, a landing page's own Branding wins over both, and the logo saved inside the page is only the fallback when Identity has none.
  `applyIdentity` (whole-page overlay) uses the same `brandProps`. The list of these blocks lives in `apply-identity.ts`; the backend
  seeder keeps a copy (`website-seed-content.js`) and a test fails if the two differ.
- **Sample copy** that names the company ("DemoLogo was founded...", sample FAQ and team rows) uses the Identity company name:
  seeds call `shared/brand-name.js`, and `applyIdentity` swaps the placeholder word in default block text at render.
- Image links saved inside page data are presigned and expire, so they are never trusted over Identity.
