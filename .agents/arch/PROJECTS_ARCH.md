# PROJECTS_ARCH — multi-project workspaces

**Status:** SPEC (KDL-474). No implementation in this issue.
**Context:** `.agents/PRODUCT_MODES_ARCH.md` §3 (layers), §7 (sequencing item 1), §8 (OQ).
Phase 0 (KDL-446) shipped to master (PR #154 / 613b0fd). This is Template Engine follow-on #1
and it **gates credits and brand-kit** — both are per-project by definition, so `projects`
is the critical path.
**Owner:** Backend Architect. **Reviewer:** Code Reviewer.

---

## 0. Problem and scope

KDL is single-tenant by construction, not by policy:

- `setting_values.field_id` is `@unique` — exactly one theme value per field, app-wide.
- `builder_pages.slug` is `@unique` — one global page namespace.
- The Meilisearch `media` index has no tenancy attribute at all.
- The active theme is an `app_settings` key (`theme_engine.active_theme.{platform}`).
- The permission cache key is `perm:user:{id}` — permissions cannot differ by workspace.

Multi-project workspaces change every layer ABOVE the engines. Per the board rule in
PRODUCT_MODES_ARCH §3: the engines' **algorithms** (token compiler, CSS sanitiser, Puck
renderer, media pipeline) are untouched; what changes is the **key shape of their storage**
(a `project_id` column on their tables) and the **request context** that selects which rows
they operate on. Nothing in this spec forks a compiler or a renderer.

**Non-goals (v1):** per-project custom domains; per-project module enablement (modules stay
global); billing (credits is follow-on #2 and lands on top of this); cross-project asset
sharing; org/team hierarchy above projects.

---

## 1. Tenancy boundary — table by table

Legend: **SCOPED** = gains `project_id` FK; **CHILD** = inherits scope through its parent FK,
no column; **GLOBAL** = unchanged.

### 1.1 New tables

| Table | Purpose |
|---|---|
| `projects` | `id` (cuid), `name`, `slug @unique`, `is_default Boolean @default(false)`, `created_by String?` (SetNull→users), `deleted_at DateTime?` (soft delete only in v1), timestamps. Partial unique index `WHERE is_default = true` guarantees exactly one default project. |
| `project_members` | `project_id` (Cascade→projects), `user_id` (Cascade→users), `role_id` (Cascade→roles), `created_at`. `@@id([project_id, user_id, role_id])` — multiple roles per member, mirroring `user_roles`. `@@index([user_id])`, `@@index([role_id])`. |
| `project_settings` | Per-project key/value store mirroring `app_settings`: `project_id` (Cascade→projects), `key`, `value`, `type`, `is_public`. `@@unique([project_id, key])`. First tenant: the active theme (moves out of `app_settings`, §1.4). |

### 1.2 Tables that become project-scoped

All `project_id` FKs below are `onDelete: Restrict`. Projects are soft-deleted in v1; Restrict
makes an accidental hard `DELETE FROM projects` fail loudly instead of cascading a workspace
away. (`project_members` / `project_settings` are the exceptions — pure join/config rows,
Cascade is correct.)

| Table | Column change | Constraint change |
|---|---|---|
| `setting_values` | `project_id String` NOT NULL | drop `@unique(field_id)`; add `@@unique([project_id, field_id])`; replace `@@index([platform])` with `@@index([project_id, platform])` |
| `builder_pages` | `project_id String` NOT NULL | drop `@unique(slug)`; add `@@unique([project_id, slug])`; add `@@index([project_id, status])` |
| `media` | `project_id String` NOT NULL | add `@@index([project_id])`, `@@index([project_id, deleted_at])` (list queries always carry both) |
| `media_folders` | `project_id String` NOT NULL | replace `@@unique([parent_id, name])` with `@@unique([project_id, parent_id, name])` (NULL-parent semantics unchanged); add `@@index([project_id])` |
| `media_tags` | `project_id String` NOT NULL | drop `@unique(name)`; add `@@unique([project_id, name])` |
| `media_collections` | `project_id String` NOT NULL | add `@@index([project_id])` |
| `activity_logs` | `project_id String?` **nullable** (SetNull) | add `@@index([project_id, created_at])`. Global events (login, user CRUD, module install) keep NULL; project-context events stamp the active project. |

Brand-kit and collateral tables (follow-ons #3/#4) are **born scoped** — their specs must
declare `project_id NOT NULL` from the first migration; they never appear in a backfill.
Credits (follow-on #2) FKs its balance/ledger to `projects.id`.

### 1.3 Child tables — scope inherited via parent FK, no column added

`media_versions`, `media_suggestions`, `media_usages`, `media_tag_pivot`, `media_meta_values`,
`media_collection_items`, `media_favorites`, `media_comments`, `media_shares`.

Rule: a row whose only access path is a JOIN through a scoped parent does not get its own
column — a second copy of the tenant key is a denormalisation that can drift. `media_shares`
stays public-by-token (`/share/[token]` is a deliberate cross-boundary door, like a presigned
URL); its create/revoke/list admin routes resolve scope through the parent media/folder.

### 1.4 Tables that stay GLOBAL, with the reason

| Table(s) | Why global |
|---|---|
| `users`, `refresh_tokens`, `password_reset_tokens` | Identity is platform-level; membership scopes access, not existence. |
| `roles`, `permissions`, `permission_modules`, `role_permissions` | The permission **catalogue** is global. Roles gain a `scope` column (§4.1) but remain one table. |
| `user_roles`, `user_permissions` | These are the **global** assignments (Super Admin, platform staff). Project assignments live in `project_members`. |
| `types`, `categories`, `setting_fields` | Theme **schema catalogue** — what fields exist, their input types, defaults, `owner_module`, `locked_by`. Module install/lock state is global (modules are global), so the catalogue is too. Only the **values** are per-project. |
| `app_settings` | Global app config only, after the active-theme keys migrate to `project_settings`. `theme_engine.active_theme.{platform}` (see `backend/src/modules/theme-engine/service.js` `activeThemeKey()`) becomes `project_settings` key `theme_engine.active_theme.{platform}`. |
| `modules` | Module enablement is global in v1 (explicit non-goal). Product-mode exclusivity (PRODUCT_MODES §2a) therefore stays global too. |
| `media_meta_fields` | Admin-defined metadata **schema** (project/client/campaign/copyright) — same catalogue argument as `setting_fields`. Values ride on scoped `media` rows. |
| `media_import_connections` | Personal credentials (OAuth tokens). A connection belongs to a user; each **import run** lands files into the active project. |
| `notification_*` | Notifications target users, not projects. `Notification.data` JSON may carry `{projectId}` for click-through. |
| `integration_providers`, `integration_logs`, `ai_providers` | Platform infrastructure (SMTP/SMS/AI credentials). Per-project senders are a commerce-era feature, out of scope. |

---

## 2. Prisma migration plan

Two migrations, one PR (PR-A in §7), each with a tested DOWN. Gate per PRODUCT_MODES §5:
UP → DOWN → UP clean, row counts posted.

### Migration 1 — `projects_core`

UP:
1. `CREATE TABLE projects`, `project_members`, `project_settings` (+ indexes, partial unique
   `projects_one_default ON projects(is_default) WHERE is_default`).
2. Seed the default project **in the migration itself** (not seed.js — backfill in migration 2
   depends on it existing in every environment):
   `INSERT INTO projects (id, name, slug, is_default, ...) VALUES ('kdlproj_default', 'Default Project', 'default', true, ...)`.
   Fixed literal id — deterministic across envs, greppable in later forensics.

DOWN: drop the three tables. (Guard: `RAISE EXCEPTION` if any project other than
`kdlproj_default` exists — reversibility is only claimed for the pre-adoption state.)

### Migration 2 — `project_scoping_backfill`

Exact ordering, per table, so every intermediate statement is valid and the whole file is
reversible:

1. `ALTER TABLE <t> ADD COLUMN project_id TEXT;` (nullable — no table rewrite, no default).
2. `UPDATE <t> SET project_id = 'kdlproj_default';` (backfill; these tables are admin-scale,
   `media` is the largest — still a single UPDATE, no batching needed at starter-kit scale).
3. `ALTER TABLE <t> ALTER COLUMN project_id SET NOT NULL;`
4. `ADD CONSTRAINT <t>_project_id_fkey FOREIGN KEY ... ON DELETE RESTRICT;`
5. **Create the new composite unique BEFORE dropping the old one** (never a window with no
   uniqueness): `CREATE UNIQUE INDEX setting_values_project_field ON setting_values(project_id, field_id);`
   then `DROP INDEX setting_values_field_id_key;` Same pattern for `builder_pages.slug`,
   `media_tags.name`, `media_folders(parent_id, name)`.
6. Data move: `INSERT INTO project_settings (project_id, key, value, type, is_public)
   SELECT 'kdlproj_default', key, value, type, is_public FROM app_settings
   WHERE key LIKE 'theme_engine.active_theme.%'; DELETE FROM app_settings WHERE key LIKE ...;`
7. `activity_logs`: steps 1 + 4 only (nullable, SetNull) — historical rows stay NULL; no
   backfill (pre-projects history is genuinely global).

DOWN (strict reverse): move active-theme keys back to `app_settings`; recreate old unique
indexes **before** dropping composite ones — guarded by
`RAISE EXCEPTION IF EXISTS (SELECT 1 FROM <t> WHERE project_id <> 'kdlproj_default')`
(the old `@unique(field_id)` cannot hold with two projects' rows; failing loudly beats
corrupting on the way down); drop FKs, drop columns.

Prisma schema files change in the same PR: new `backend/prisma/schema/projects.prisma`
(one module per file, per existing convention); edits to `core.prisma`, `page-builder.prisma`,
`media-dam.prisma`, `user-management.prisma` for the columns/uniques above.

---

## 3. Active-project resolution — one choke point

### 3.1 Decision: header for the API, path segment only for public pages

- **API:** `X-Project-Id: <cuid-or-slug>` header on every project-scoped request.
- **Frontend admin:** active project lives in a `ProjectProvider` (cookie-persisted), which
  makes the API client inject the header (§5).
- **Public renderer:** path segment `/p/[projectSlug]/[pageSlug]` — public URLs must be
  shareable and stateless (§5.2).

Rejected: **path segment on the API** (`/api/p/:projectId/...`) — remounts every router in
`backend/src/index.js`, breaks presigned/share URLs already in the wild, and turns one
middleware into a routing migration. **Session-stored project** — a server-side "current
project" breaks two tabs on two projects over one session, and makes requests non-replayable
(the same request means different things at different times). The header keeps every existing
route path stable and is trivially replayable.

### 3.2 The two halves of the choke point

**No per-controller checks** is achieved with exactly two mechanisms, both of which every
request already passes through:

**(a) `projectContext` middleware — resolution.** Mounted ONCE in `backend/src/index.js`,
immediately after the rate limiter and before all module routers:

```
app.use('/api', projectContext);   // new — resolves, never authorises
```

It reads `X-Project-Id`, resolves slug→id (Redis-cached `project:slug:{slug}`, 60s TTL,
invalidated on project rename/delete — same pattern as `module:status:*` in
`backend/src/middleware/module-gate.js`), 404s on unknown/soft-deleted project, sets
`req.projectId`, and enters an `AsyncLocalStorage` project context for (b). It does NOT check
membership — it runs before `authenticate` (which is per-router), so `req.user` does not
exist yet. If the header is absent it resolves the default project while
`PROJECTS_ENFORCED=false` (transition flag, §7), else leaves `req.projectId = null`, which
makes any scoped data access fail closed in (b) and membership resolution return the empty
set — after PR-H the flag flips: absent header on a scoped request → 400 `PROJECT_REQUIRED`.

**(b) Prisma client extension — enforcement.** A `prisma.$extends` query extension in
`backend/src/config/database.js` with an explicit allowlist of scoped models
(`SettingValue`, `BuilderPage`, `Media`, `MediaFolder`, `MediaTag`, `MediaCollection`,
`ProjectSettings`):

- every `find*/update*/delete*/count/aggregate` on a scoped model gets
  `AND project_id = <ctx.projectId>` injected;
- every `create/createMany/upsert` gets `project_id` stamped;
- a scoped-model query with **no project in context throws** (`ProjectScopeError` → 500 in
  dev, and the leakage suite asserts it) — a route that somehow bypasses the middleware
  cannot silently read cross-project rows.
- An explicit `withoutProjectScope(fn)` escape hatch (runs `fn` with a sentinel context)
  exists for the migration-era admin surfaces: Meilisearch full reindex, media expiry
  worker, Super Admin cross-project listings. Every call site is greppable.

Controllers and services do not change their queries at all — that is the point. The
middleware resolves once; the ORM layer enforces everywhere; `requirePermission` (already on
every protected route) carries the authorisation half (§4.2).

Workers/queues (media processing, expiry, imports) don't have a request: job payloads gain a
`projectId` field stamped at enqueue time (inside the request context), and the worker enters
the project context before touching scoped models.

---

## 4. RBAC — project-scoped roles

### 4.1 Role catalogue

`roles` gains `scope RoleScope @default(GLOBAL)` (`enum RoleScope { GLOBAL PROJECT }`).
Existing seeded roles (`super-admin`, etc.) stay GLOBAL. New seeded PROJECT roles:
`project-admin`, `project-editor`, `project-viewer` (`is_system: true`), with permission sets
drawn from the existing catalogue (theme-engine, page-builder, media, activity — project-level
modules only; user-management/modules/integrations permissions are never attached to PROJECT
roles by seed).

Assignment surfaces: `user_roles` accepts only GLOBAL roles; `project_members.role_id`
accepts only PROJECT roles. Enforced in the role-assignment services (validation error naming
the scope mismatch), not by the DB.

### 4.2 Composition — `resolvePermissions(userId, projectId)`

`backend/src/modules/user-management/shared/permission-resolver.js` becomes project-aware.
Effective set for a request:

```
global-role permissions            (user_roles → GLOBAL roles)
∪ project-role permissions         (project_members WHERE project_id = active, iff member)
then user_permissions overrides    (GRANT adds / DENY removes — overrides stay GLOBAL and
                                    apply last, same as today)
```

- **Not a member of the active project** → the project term is ∅. A user with no relevant
  global permissions gets 403 from `requirePermission` exactly as today — membership is not
  a separate middleware, it is a factor of permission resolution. One choke point, kept.
- **Super Admin:** `bypass: true` short-circuit unchanged — sees and edits every project,
  is the only actor for cross-project admin (project CRUD, member management of projects
  they're not in).
- `requirePermission(module, action)` **signature unchanged** at every call site; internally
  it passes `req.projectId` through to the resolver.

### 4.3 Redis cache key change

`perm:user:{id}` is insufficient — the same user is `project-admin` in A and `project-viewer`
in B. New keys:

```
perm:user:{id}:proj:{projectId}    — resolved set for that project context
perm:user:{id}:global              — no-project context (global-admin routes)
```

TTL stays 600s. Invalidation: `invalidatePermissionCache` already SCANs by pattern —
per-user invalidation uses `perm:user:{id}:*` (covers all projects + global); role-permission
edits keep the full `perm:user:*` sweep. **New invalidation triggers:** membership
add/remove/role-change on `project_members` → `perm:user:{id}:*` for that user.

### 4.4 Projects API (new core routes, not a module)

`/api/projects` mounted in `index.js` like `users`/`roles` (core platform, no `moduleGate`):
CRUD (permission `projects:*`, seeded into a new `projects` PermissionModule; create/delete
Super-Admin-only in v1), `GET /api/projects/mine` (memberships — feeds the switcher),
member management (`projects:manage-members` or Super Admin).

---

## 5. Frontend routing / IA impact

### 5.1 Admin — no URL migration in v1

Admin URLs stay `/admin/...`. Active project is client state, not path:

- **`ProjectProvider`** (in `frontend/src/app/providers.tsx` tree): holds
  `{id, slug, name}`, initialised from cookie `kdl_active_project`, overridable by
  `?project=<slug>` query param (deep-link escape hatch); validates against
  `GET /api/projects/mine` and falls back to the first membership.
- **Project switcher** in the admin top bar (`frontend/src/app/admin/layout.tsx` header):
  memberships list + current project; Super Admin sees all projects. Switching sets the
  cookie and calls `queryClient.clear()` — a full React Query cache drop is the only safe
  invalidation across an axis every query depends on.
- **API client interceptor** injects `X-Project-Id` from the provider on every request —
  one place, mirroring the backend's one middleware.

Rejected for v1: `/admin/[projectSlug]/...` path segment — it moves every admin route
directory, breaks every bookmark, and forces the whole frontend to ship in one PR. It remains
the right v2 shape if per-project deep-linking becomes a support burden; the ProjectProvider
isolates that future change to routing config.

### 5.2 What breaks (and the fix)

| Break | Fix |
|---|---|
| `GET /api/theme-engine/tokens` (public, `optionalAuthenticate`) has no header source for anonymous visitors | The runtime CSS provider passes the project explicitly (`?project=<slug>`); `projectContext` also accepts the query param for the public-prefix allowlist (`/tokens`, `/page-builder/public`). Default project while flag is off. |
| Public pages `/p/[slug]` — slugs now collide across projects | Route becomes `/p/[projectSlug]/[pageSlug]`; `/p/[slug]` kept as a redirect to the default project's page so every pre-projects URL survives. |
| React Query cache — keys don't carry project | `queryClient.clear()` on switch (above); no per-key rewrite needed. |
| Theme runtime + Puck editor previews render the *default* project's theme until their fetches carry the header | Covered by the interceptor; e2e browser gate must assert theme changes track the switcher. |
| E2E fixtures assume global uniqueness (page slugs, tag names) | Fixtures create everything inside a seeded test project; leakage suite (§6) creates two. |
| `/share/[token]` | Unaffected — public-by-token stays cross-boundary by design. |

---

## 6. Leakage test plan (QA — concrete negative tests)

Fixtures: projects **A** and **B**; `userA` = `project-admin` of A only; `userAB` =
`project-admin` of A + `project-viewer` of B; `superadmin`. Seed one media file, one builder
page (same slug `home` in both), one theme value (same field, different colour), one tag
(same name) in each project.

Every test asserts the negative — B's data must be unreachable from A's context:

1. **Direct-id probe:** `userA`, header=A, `GET /api/media/{B.media.id}` → **404** (not 403 —
   scoped reads must not become an existence oracle; the extension's injected filter makes
   the row not-found). Same for `PUT`/`DELETE`, and for builder pages by id.
2. **List isolation:** every scoped list endpoint (`/api/media`, `/api/page-builder`,
   `/api/theme-engine/values`) with header=A contains zero rows whose id belongs to B's seed.
3. **Header spoof / non-membership:** `userA` with header=B on any protected scoped route →
   **403** from `requirePermission` (empty project term). Membership, not the header, grants.
4. **Slug collision proof:** both projects serve their own `/p/{slug}/home` with their own
   content; creating `home` in A when it exists only in B succeeds (composite unique).
5. **Theme isolation:** `POST /api/theme-engine/values` in A, then `GET /tokens?project=B`
   → B's CSS unchanged (compiler reads only B's rows); active-theme switch in A leaves B's
   `project_settings` row untouched.
6. **Search isolation:** Meilisearch query from A's context for a term that only matches B's
   media (unique marker string in B's title/OCR) → zero hits. Requires `project_id` in
   `filterableAttributes` (`backend/src/modules/media/media-search.service.js`
   `INDEX_SETTINGS`) and a **mandatory** `project_id = X` filter appended server-side to
   every search — assert the filter is present even when the caller passes their own filters.
7. **Cache poisoning:** `userAB` writes in A (200), then same session writes in B → **403**
   (viewer); flip order to prove no stale `perm:user:{id}` key without project qualifier is
   consulted. Then membership revoke in A → next A request 403 within the invalidation path
   (not after TTL).
8. **Missing header (post-PR-H):** scoped route without `X-Project-Id` → **400
   `PROJECT_REQUIRED`**; allowlisted public/global routes unaffected.
9. **Extension fail-closed:** unit test — querying `Media` with no project context throws
   `ProjectScopeError`; `create` on a scoped model stamps the context project even when the
   payload tries to smuggle `project_id: B`. (Mass-assignment guard.)
10. **Worker scope:** enqueue a media-processing job from A; assert the worker's writes
    (variants, versions) land with `project_id = A` and B's counts are unchanged.
11. **Schema assertion:** SQL test that every table in §1.2's NOT NULL list has a NOT NULL
    `project_id` FK — a new scoped table added without it fails the suite, not review.
12. **Positive control:** `superadmin` reads A and B (proves the tests fail for the right
    reason); share-token fetch of B's file with no auth succeeds (documented public door).

---

## 7. Phased build plan — PR-sized chunks

Rules: `docs/MERGE_DISCIPLINE.md` — rebase before CI, one concern per PR, lockfile in at most
one workspace, <400 changed lines of non-generated code each. The transition flag
`PROJECTS_ENFORCED` (env, default `false`) + backfill-to-default-project means **every PR
ships against green master with behaviour byte-identical** until PR-H flips enforcement.

| PR | Contents | Ships green because |
|---|---|---|
| **PR-A** | Migrations 1+2, `projects.prisma` + schema edits, seed (default project, PROJECT roles, `projects` permission module). Gate: `prisma validate`, UP→DOWN→UP, row counts. | Columns backfilled + composite uniques are supersets of old behaviour; no runtime code reads them yet. |
| **PR-B** | `projectContext` middleware + slug cache; Prisma scoping extension + `withoutProjectScope`; `AsyncLocalStorage` plumbing; worker payload stamping. Flag off → default project everywhere. | Every query resolves to the same rows as before (single default project). |
| **PR-C** | Projects module: `/api/projects` CRUD + `mine` + members, activity logging, unit tests. | New routes only. |
| **PR-D** | RBAC: `roles.scope`, resolver composition, cache keys `:proj:`/`:global`, membership invalidation triggers, scope-mismatch validation in role assignment. | Sole member of the default project is seeded for existing admins; resolved sets identical for current users. |
| **PR-E** | Theme-engine + page-builder scoping: values/reset/active-theme read `req.projectId`; active theme from `project_settings`; public tokens `?project=` param; `/p/[projectSlug]/[pageSlug]` backend route + legacy redirect. | Flag off → default project → same rows. |
| **PR-F** | Media scoping: routes/services, Meili `project_id` filterable attribute + mandatory server-side filter + full reindex (via `withoutProjectScope`), expiry/processing workers, activity `project_id` stamping. | Same reasoning; reindex is idempotent. |
| **PR-G** | Frontend: `ProjectProvider`, switcher, interceptor, `?project=` deep-link, `/p/[projectSlug]/[pageSlug]` page + redirect, e2e fixture updates. Frontend lockfile only, if touched. | Backend accepts the header already; absent header still defaults. |
| **PR-H** | Flip `PROJECTS_ENFORCED` default to `true`; 400 `PROJECT_REQUIRED` path; full leakage suite (§6); browser gate: create project B, switch, prove isolation + theme tracking. | Everything upstream is already live; this PR only removes the fallback and proves it. |

Sequencing: A→B→(C,D in either order)→E→F→G→H. C and D are parallelisable; E and F are
parallelisable after D. Credits (follow-on #2) can start its spec against PR-A's schema; its
implementation needs B+D merged.

---

## 8. Decisions taken here (flag on review if contested)

- **D-P1** Header (`X-Project-Id`) over path segment for the API; path segment for public
  pages only. (§3.1)
- **D-P2** Enforcement lives in a Prisma query extension with a scoped-model allowlist,
  fail-closed; membership is a factor of `resolvePermissions`, not a new middleware. (§3.2, §4.2)
- **D-P3** Catalogue/value split: `types`/`categories`/`setting_fields`/`media_meta_fields`
  stay global; only value/content tables are scoped. (§1.4)
- **D-P4** `onDelete: Restrict` + soft delete for projects in v1; no purge job yet. (§1.2)
- **D-P5** No admin URL migration in v1; cookie+header with `?project=` override. (§5.1)
- **D-P6** Cross-project probes return **404**, not 403 (no existence oracle). (§6.1)
- **D-P7** Modules, integrations, AI providers, notifications remain global in v1. (§1.4)

## 9. Open questions for the board (do not guess in implementation)

- **OQ-P1** Should project create/delete be Super-Admin-only in v1 (spec'd), or may
  `project-admin`s of any project create new projects? Affects PR-C only.
- **OQ-P2** Member invitation UX — pick from existing platform users only (spec assumption),
  or email-invite flow (new surface, suggests deferral to a follow-on)?
- **OQ-P3** Does the Template Engine "Studio" mode table (PRODUCT_MODES §3) eventually need
  **per-project** mode? Modules are global in v1 (D-P7), so mode is platform-wide; if the
  board wants per-project Studio/Toolkit, that lands as a `project_settings` key later and
  the conflict enforcement needs a project dimension — flag early, not a v1 blocker.
