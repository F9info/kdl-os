# User Management Module — KDL Starter Kit
# Module 1 Design Document (Users, Roles, Permissions)

**Author:** Claude (Cowork) — approved by Prasanna (web@f9tech.com)
**Date:** 2026-07-03
**Status:** FINAL v1.0 — Implementation-ready. Handed to Paperclip AI build agents.
**Mode:** 24/7 unattended — Auto-Approval Protocol in force (see Implementation Order section). No human gate unless BLOCKERS.md conditions are met.
**Reference implementation:** `vision_developers_laravel` (spatie/laravel-permission) — this doc replicates its behavior with enhancements, on the KDL stack.

---

## Kickoff Instructions (Paperclip AI Orchestrator — read first)

1. Follow the standard Session Protocol from `CLAUDE.md` (read HANDOFF.md, STATUS.md, CONTEXT.md, lessons.md).
2. Work the Implementation Order table below strictly in sequence, Step 1 → Step 10. One step per session where practical.
3. Each step's gate auto-approves per the Auto-Approval Protocol — never wait for a human, never self-approve as the maker.
4. Before Step 1, fix the known HIGH from the 2026-07-03 foundation review (`.agents/REVIEW.md`): `.env.example` key `MEILISEARCH_API_KEY` → `MEILI_MASTER_KEY`. It is a one-line change; do it in the same session as Step 1.
5. Update HANDOFF.md + STATUS.md at the end of every session; write BUDGET.md entries per session.
6. On any escalation condition, write BLOCKERS.md and STOP the pipeline — do not continue past a blocked gate.

---

## Overview

Upgrade KDL's static `Role` enum (SUPER_ADMIN / ADMIN / USER) to a full dynamic RBAC system: database-driven **roles** and **permissions**, a **module × action permission matrix** UI (same mental model as the Vision Developers Laravel admin), per-user **multi-role** assignment, optional per-user permission **overrides**, Redis-cached permission resolution, and an **activity log** for every mutation.

All existing KDL conventions apply (CLAUDE.md is law): ES Modules, Zod on all inputs, `successResponse`/`errorResponse`, Prisma singleton from `config/database.js`, routes → controller → service → Prisma, frontend via `lib/axios.ts` + TanStack Query + Zustand.

### Behavior carried over from the Laravel app

- Permissions are grouped by **module** (e.g. `users`, `roles`, `media`); each module has 5 **actions**: `view`, `add`, `edit`, `delete`, `publish`.
- Role create/edit screen = checkbox matrix (modules as rows, actions as columns) with per-row and per-column "select all".
- Cannot delete a role that has users assigned.
- Cannot delete a module (permission group) that is granted to any role.
- Cannot delete your own account.
- Non-super-admins never see or assign the protected top role (Laravel: `Developer Admin`; KDL: `SUPER_ADmin` → `Super Admin` system role).
- Admin can reset any user's password directly.
- Every mutation writes an activity log entry (Laravel: spatie/activitylog → KDL: `activity_logs` table).
- Creating a new module auto-creates its 5 action permissions (Laravel did this with string prefixes; KDL does it relationally — see below).

### Enhancements over the Laravel version (approved 2026-07-03)

1. **Structured permissions** — `module` + `action` are separate columns; no `'add-' . $name` string surgery. Display name is computed (`edit-users`) for familiarity. Eliminates the Laravel rename/delete fragility (PermissionController.php:103–114 syncs 6 rows by string matching — a rename that partially fails corrupts the set).
2. **Multi-role users** — `user_roles` many-to-many; effective permissions = union of all roles.
3. **Per-user overrides** — `user_permissions` with `mode: GRANT | DENY`. DENY beats role grants; GRANT adds on top. (Laravel spatie supports direct permissions but the app never used them; we make it a first-class feature.)
4. **Redis permission cache** — resolved permission set per user cached 10 min, invalidated on any role/permission/assignment mutation (spatie's PermissionRegistrar cache, done with our stack).
5. **User lifecycle** — `status` (ACTIVE / SUSPENDED / PENDING), `last_login_at`, soft delete (`deleted_at`), avatar via existing Media module.
6. **`GET /api/auth/me/permissions`** — frontend fetches the effective permission set once and gates UI elements (Laravel used blade `@can`; we need a client-side equivalent).
7. **System-flag protection** — seeded roles/modules have `is_system: true`; they cannot be renamed or deleted from the UI/API.

### Backward compatibility / migration

- `users.role` enum column is **kept** during migration and dropped in the final step. Migration seeds three system roles (Super Admin, Admin, User), maps each user's enum value to the matching role row, then removes the column.
- `requireRole('ADMIN','SUPER_ADMIN')` call sites are replaced by `requirePermission('<module>:<action>')`. Super Admin **bypasses all permission checks** (same as Laravel `Developer Admin` holding every permission, but enforced in middleware so new modules are automatically covered).
- Existing JWT payload gains `roles: string[]` (slugs) alongside legacy `role` until the enum is dropped.

---

## Prisma Schema Additions

**File:** `backend/prisma/schema.prisma` (append; also modify User)

```prisma
enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING
}

enum OverrideMode {
  GRANT
  DENY
}

model Role {
  id          String   @id @default(cuid())
  name        String   @unique            // "Content Editor"
  slug        String   @unique            // "content-editor"
  description String?
  is_system   Boolean  @default(false)    // seeded roles: not renamable/deletable
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  users       UserRole[]
  permissions RolePermission[]

  @@map("roles")
}

model PermissionModule {
  id          String   @id @default(cuid())
  name        String   @unique            // "users", "blog-posts"
  label       String                       // "Users", "Blog Posts"
  is_system   Boolean  @default(false)
  sort_order  Int      @default(0)
  created_at  DateTime @default(now())

  permissions Permission[]

  @@map("permission_modules")
}

model Permission {
  id         String   @id @default(cuid())
  module_id  String
  action     String                        // view | add | edit | delete | publish
  created_at DateTime @default(now())

  module PermissionModule @relation(fields: [module_id], references: [id], onDelete: Cascade)
  roles  RolePermission[]
  users  UserPermission[]

  @@unique([module_id, action])
  @@index([module_id])
  @@map("permissions")
}

model RolePermission {
  role_id       String
  permission_id String

  role       Role       @relation(fields: [role_id], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)

  @@id([role_id, permission_id])
  @@index([permission_id])
  @@map("role_permissions")
}

model UserRole {
  user_id String
  role_id String

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role Role @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@id([user_id, role_id])
  @@index([role_id])
  @@map("user_roles")
}

model UserPermission {
  user_id       String
  permission_id String
  mode          OverrideMode              // GRANT adds, DENY blocks (DENY wins)

  user       User       @relation(fields: [user_id], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)

  @@id([user_id, permission_id])
  @@index([permission_id])
  @@map("user_permissions")
}

model ActivityLog {
  id          String   @id @default(cuid())
  actor_id    String?                      // who did it (null = system)
  module      String                       // "user-management/users"
  action      String                       // "created" | "updated" | "deleted" | ...
  subject_type String?                     // "User" | "Role" | ...
  subject_id  String?
  description String
  properties  Json?                        // PII-scrubbed diff/context
  ip_address  String?
  created_at  DateTime @default(now())

  actor User? @relation(fields: [actor_id], references: [id], onDelete: SetNull)

  @@index([actor_id])
  @@index([module])
  @@index([created_at])
  @@map("activity_logs")
}
```

**User model changes:**

```prisma
model User {
  // existing fields stay; ADD:
  status        UserStatus @default(ACTIVE)
  avatar_media_id String?
  last_login_at DateTime?
  deleted_at    DateTime?                  // soft delete

  roles         UserRole[]
  permission_overrides UserPermission[]
  activity      ActivityLog[]

  @@index([status])
  @@index([deleted_at])
  // role enum column: kept until Step 10 of the migration plan, then dropped
}
```

---

## Seeder

**File:** `backend/prisma/seeders/user-management.seed.js` (called from `prisma/seed.js`)

- Modules (all `is_system: true`), each with all 5 actions: `users`, `roles`, `permissions`, `settings`, `media`, `activity-log`. Future modules (blog, projects, forms, …) register themselves the same way — mirrors the Laravel `RolesAndPermissionsSeeder` if-not-exists idempotent pattern; every block MUST be upsert-safe.
- Roles:

| Role | slug | is_system | Permissions |
|---|---|---|---|
| Super Admin | `super-admin` | ✅ | bypass — middleware short-circuit, no rows needed |
| Admin | `admin` | ✅ | all actions on all modules EXCEPT `roles:delete`, `permissions:*` |
| User | `user` | ✅ | none (app-level features only) |

- Existing seed user `admin@kdl.com` gets `super-admin`.

---

## Backend Module: `backend/src/modules/user-management/`

Follows the existing 4-file pattern per resource, grouped in one module folder:

```
user-management/
├── roles/        schema.js, service.js, controller.js, routes.js
├── permissions/  schema.js, service.js, controller.js, routes.js
├── activity/     schema.js, service.js, controller.js, routes.js
└── shared/
    ├── permission-resolver.js     // effective-permission computation + Redis cache
    └── activity-logger.js         // writeActivity({actor, module, action, ...}) — PII-scrubbed, try/catch isolated
```

The existing `modules/users/` is **extended** (not moved): role assignment, status, overrides, admin password reset are added to its schema/service/controller.

### New middleware

**File:** `backend/src/middleware/permission.js`

```
requirePermission('users:edit')
```

1. `req.user` must exist (401 otherwise — runs after `authenticate`).
2. If user holds `super-admin` role → `next()` (bypass).
3. Resolve effective set via `permission-resolver.js`:
   `union(role permissions) + GRANT overrides − DENY overrides`, cached in Redis key `perm:user:{id}` TTL 600s. **Use SCAN, never KEYS**, for invalidation patterns (CLAUDE.md rule).
4. Missing permission → 403 via `errorResponse`.

`requireRole` stays for the transition, delegating to role-slug membership, and is removed at migration Step 10.

### API Endpoints

All under `authenticate`. Notation: `module:action` = required permission.

**Roles** (`/api/roles`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/roles` | `roles:view` | paginated, includes user count + permission count |
| GET | `/api/roles/:id` | `roles:view` | includes full permission matrix |
| POST | `/api/roles` | `roles:add` | body: name, description, permission_ids[] |
| PATCH | `/api/roles/:id` | `roles:edit` | 409 if `is_system` and name change attempted; syncs permission_ids[] (give+revoke like Laravel update) |
| DELETE | `/api/roles/:id` | `roles:delete` | 409 if `is_system` or users assigned ("Unable to delete: users are assigned to this role") |

**Permissions** (`/api/permissions`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/permissions/matrix` | `permissions:view` | grouped: `[{module, label, actions: {view: id, add: id, ...}}]` — feeds the checkbox grid |
| POST | `/api/permissions/modules` | `permissions:add` | creates module + auto-creates its 5 action permissions in one transaction (Laravel parity) |
| PATCH | `/api/permissions/modules/:id` | `permissions:edit` | renames label/name; 409 if `is_system` |
| DELETE | `/api/permissions/modules/:id` | `permissions:delete` | 409 if any role/override references its permissions |

**Users** (extends `/api/users`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/users` | `users:view` | add filters: status, role slug, search; excludes soft-deleted |
| POST | `/api/users` | `users:add` | + role_ids[]; non-super-admin cannot assign `super-admin` (existing rule generalized) |
| PATCH | `/api/users/:id` | `users:edit` | + role_ids[] sync, status; non-super-admin cannot touch super-admin users |
| DELETE | `/api/users/:id` | `users:delete` | soft delete (`deleted_at`); 409 on own account ("You can not delete your own account") |
| POST | `/api/users/:id/reset-password` | `users:edit` | admin sets new password; revokes all refresh tokens for that user; activity-logged |
| PUT | `/api/users/:id/overrides` | `permissions:edit` | replace override set: `[{permission_id, mode}]` |
| GET | `/api/auth/me/permissions` | authenticated | effective permission strings + role slugs, for frontend gating |

**Activity Log** (`/api/activity-log`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/activity-log` | `activity-log:view` | paginated; filters: actor, module, date range. READ-ONLY — no write/edit/delete endpoints ever |

### Rules for the build agent

- Every mutation in this module calls `writeActivity(...)` — wrapped in try/catch so a logging failure never breaks the response (same isolation rule as `auditLogger` in ai-services, CLAUDE.md).
- Properties written to `activity_logs.properties` must be PII-scrubbed (no passwords, no tokens — name/email allowed, matching Laravel behavior).
- Cache invalidation: any change to roles / role_permissions / user_roles / user_permissions deletes affected `perm:user:*` keys via SCAN.
- All new Zod schemas use the `{ body, query, params }` wrapper convention (`req.validated.*`).
- Password reset must hash with the same bcrypt(12) path as auth service — import, don't duplicate.
- JWT: add `roles` claim on login/refresh; keep payload small (slugs only, never permissions — those change without re-login).

---

## Frontend: `frontend/src/app/(admin)/`

New pages (all inside AuthGuard, following existing DataTable/Modal/shadcn patterns):

```
roles/
├── page.tsx              // DataTable: name, users count, permissions count, actions
└── _components/RoleFormDialog.tsx   // name, description + PermissionMatrix
permissions/
└── page.tsx              // module list + "Add module" (auto-creates 5 actions)
activity-log/
└── page.tsx              // read-only DataTable with filters
users/                    // EXTEND existing page:
                          // multi-role select, status badge+filter, reset-password dialog,
                          // overrides tab (per-permission GRANT/DENY)
```

**`PermissionMatrix` component** (`components/shared/PermissionMatrix.tsx`) — the centerpiece, replicating the Laravel role screen:
rows = modules, columns = view/add/edit/delete/publish, checkbox per cell, "select all" per row and per column, controlled component emitting `permission_ids[]`.

**Client-side gating:** `usePermissions()` hook wraps `GET /api/auth/me/permissions` (TanStack Query, staleTime 5 min) exposing `can('users:edit')` and `hasRole('super-admin')`. Sidebar items and action buttons render conditionally. **Server remains the enforcement point — UI gating is UX only.**

TypeScript types for Role, Permission, PermissionModule, ActivityLog, UserStatus go in `types/models.types.ts` (keep in sync with schema — CLAUDE.md rule).

---

## Implementation Order (for Paperclip AI orchestrator)

| Step | Task | Agent | Gate |
|---|---|---|---|
| 1 | Prisma schema additions + migration + seeder | Backend Architect | `prisma validate` + `prisma migrate dev` exit 0 |
| 2 | permission-resolver + activity-logger + `requirePermission` middleware | Backend Coder | unit-testable resolver: role union, GRANT, DENY-wins, super-admin bypass |
| 3 | Roles + Permissions + Activity endpoints | Backend Coder | curl tests: matrix shape, 409 guards, cache invalidation |
| 4 | Users module extension (multi-role, status, soft delete, reset-password, overrides) + JWT `roles` claim | Backend Coder | curl: non-super-admin blocked from super-admin ops |
| 5 | Replace `requireRole` call sites with `requirePermission`; keep enum in sync | Backend Coder | all existing endpoints still pass curl suite |
| 6 | Frontend: PermissionMatrix, roles + permissions + activity pages, users page extension, usePermissions | Frontend Coder | `tsc --noEmit` exit 0; full flow in browser |
| 7 | Code review (separate session — Maker ≠ Grader) | Code Reviewer | verdict PASS, zero open CRITICAL/HIGH |
| 8 | Docs: API_REFERENCE.md, ENV_REFERENCE.md, CLAUDE.md schema section update | Documentation | docs match code |
| 9 | **Automated E2E gate** — Playwright suite: create role → assign to user → login as that user → verify UI gating + 403 on forbidden API calls | Code Reviewer (runs, does not write) | E2E suite exit 0 |
| 10 | Drop `users.role` enum column + remove `requireRole` | Backend Coder | `pg_dump` backup taken first; migration runs clean; full curl + E2E suites pass |

Budget/session rules, HANDOFF.md/STATUS.md protocol, and non-negotiables from CLAUDE.md apply to every step.

### Auto-Approval Protocol (24/7 unattended mode — Prasanna directive, 2026-07-03)

Phase gates in this module do NOT wait for human approval. A gate auto-approves when ALL of the following hold:

1. Every validation command for the step exits 0 (`prisma validate`, `node --check`, `tsc --noEmit`, curl suite, Playwright E2E as applicable). Exit codes only — an agent's self-assessment never counts.
2. Independent Code Reviewer session (Maker ≠ Grader) returns PASS with zero open CRITICAL or HIGH findings. MEDIUM/LOW are logged to STATUS.md and queued, not blocking.
3. A **Gate Verifier** session (separate from maker AND reviewer) re-runs all step-gate commands from a clean checkout and confirms exit 0.

**Escalate to Prasanna (write BLOCKERS.md, stop the pipeline) only when:**
- A CRITICAL finding is confirmed, or the same gate fails after 2 fix→re-review loops
- Any destructive/irreversible operation fails or cannot be backed up first (Step 10)
- Budget exhausted, or a change to auth/session/password code fails review
- Anything requires credentials, spend, or data deletion outside this spec

Everything else proceeds without human involvement. Steps auto-chain: gate pass → next step starts immediately.

---

## Known Risks / Watch Items

- **Enum-to-table migration** (Steps 1 & 10) touches auth — Step 5 must run the full existing curl suite, not just new endpoints.
- **Cache staleness**: a user whose role changes keeps old permissions up to 10 min if invalidation misses — invalidation must be in the service layer (single choke point), not controllers.
- **DENY semantics**: resolver order is fixed: `(union of role perms) ∪ GRANTs − DENYs`. Write unit tests for all 8 combinations before wiring the middleware.
- **Soft delete**: every user query in users/service.js AND auth/service.js (login!) must filter `deleted_at: null` — a soft-deleted user must not be able to log in.
- Suspended users: `authenticate` middleware must reject `status: SUSPENDED` with 403 even with a valid token.
