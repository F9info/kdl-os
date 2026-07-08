# Module Plugin System — KDL Starter Kit
# Module 2 Design Document (Install / Enable / Disable Feature Modules)

**Author:** Claude (Cowork) — approved by Prasanna (web@f9tech.com)
**Date:** 2026-07-03 (restored 2026-07-08 — twice deleted from disk uncommitted; now committed to git)
**Status:** COMPLETE — implemented and gate-approved 2026-07-06 (KDL-76/77/82). Reference for teams building new modules. DO NOT DELETE — historical spec + New Module Checklist source.
**Mode:** 24/7 unattended — Auto-Approval Protocol applies (defined in `.agents/USER_MANAGEMENT_ARCH.md`).

---

## Read Scope (TOKEN RULE — read ONLY your step's sections, never this whole file)

| Step | Read these sections ONLY |
|---|---|
| 1 | Multi-File Prisma Schema |
| 2 | Prisma Schema Additions, Module Anatomy, Backend Runtime (loader + moduleGate) |
| 3 | Backend Runtime (Lifecycle service + API Endpoints) |
| 4 | Module Anatomy, Overview (core modules paragraph) |
| 5 | Frontend section only |
| 6 | Scaffold Generator + New Module Checklist |
| 7 (review) | Whole doc + Known Risks |
| 8 (E2E) | Implementation Order Step 8 row |
| 9 (docs) | Overview, API Endpoints, New Module Checklist |

Every agent also obeys `CLAUDE.md → Token Efficiency Protocol`.

---

## Overview

Every future feature (Blog, Projects, Forms, CRM, GST Invoicing, …) is a **self-contained module** with a standard folder anatomy and a **manifest file**, managed through a lifecycle:

```
AVAILABLE (code shipped, not installed)
   → INSTALLED (migrated + permissions registered, disabled)
      → ENABLED (routes live, nav visible)
      ⇄ DISABLED (routes return 404, nav hidden, data retained)
   → UNINSTALLED (registration removed; data retained unless purge explicitly requested)
```

**Design decision — code-shipped modules, not runtime code upload.** Module code always arrives via the normal agent pipeline (written, reviewed, gate-verified, committed). "Install" and "enable" are database-driven runtime operations — no redeploy needed to toggle a module. Uploading executable code at runtime is explicitly out of scope: it would bypass the Maker ≠ Grader review chain and is a remote-code-execution surface.

**Core modules** (`auth`, `users`, `user-management`, `settings`, `media`, `modules` itself, plus `types`, `categories`, `setting-fields`) are flagged `is_core` — always enabled, cannot be disabled or uninstalled.

---

## Prisma Schema Additions

**File:** `backend/prisma/schema/modules.prisma`

```prisma
enum ModuleStatus {
  INSTALLED   // migrated, permissions registered, not serving
  ENABLED     // serving requests, visible in nav
  DISABLED    // installed but switched off; data retained
}

model Module {
  id           String       @id @default(cuid())
  slug         String       @unique
  name         String
  description  String?
  version      String
  is_core      Boolean      @default(false)
  status       ModuleStatus @default(INSTALLED)
  installed_at DateTime     @default(now())
  enabled_at   DateTime?
  settings     Json?
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt

  @@index([status])
  @@map("modules")
}
```

---

## Multi-File Prisma Schema

`backend/prisma/schema/` directory (Prisma 6 schema folder):

```
prisma/schema/
├── main.prisma          // generator + datasource blocks ONLY
├── core.prisma          // User, RefreshToken, AppSetting, Media, Type, Category, SettingField
├── user-management.prisma
├── modules.prisma
└── <module-slug>.prisma // each future module adds exactly one file
```

---

## Module Anatomy (the contract every module follows)

```
backend/src/modules/<slug>/
├── module.json              // manifest — REQUIRED
├── routes.js                // exports Express router — REQUIRED
├── controller.js / service.js / schema.js
├── seed.js                  // idempotent, runs inside install transaction
└── ...

frontend/src/app/admin/<slug>/     // module pages (ModuleGuard wrapped)
prisma/schema/<slug>.prisma
```

### module.json manifest

```json
{
  "slug": "blog",
  "name": "Blog",
  "version": "1.0.0",
  "description": "Posts and categories with publish workflow",
  "core": false,
  "apiPrefix": "/api/blog",
  "permissions": ["blog_posts", "blog_categories"],
  "nav": [
    { "label": "Blog Posts", "path": "/admin/blog/posts", "icon": "FileText", "permission": "blog_posts.view" }
  ],
  "dependsOn": ["media"],
  "queues": [],
  "env": []
}
```

Rules: `slug` matches folder + schema filename + apiPrefix. `permissions` = PermissionModule names auto-registered on install (5 actions each). `dependsOn` = slugs that must be ENABLED before enabling this. `env` = required env vars, install fails if missing.

---

## Backend Runtime

**module-loader.js** (`src/shared/modules/`): at boot, scans `src/modules/*/module.json`, Zod-validates manifests (invalid → skip + log, never crash), mounts routers at apiPrefix behind `moduleGate(slug)` for non-core modules.

**module-gate.js** (`src/middleware/`): per-request status check via Redis `module:status:<slug>` TTL 60s with DB fallback on Redis outage; non-ENABLED → 404 before `authenticate`. Toggle takes effect without restart.

**Lifecycle service** (`src/modules/modules/service.js`):

| Operation | Behavior |
|---|---|
| install | manifest + dependsOn + env validation → transaction: registerPermissions + run seed.js + create Module row (INSTALLED) → writeActivity. Migrations run at deploy time, never runtime DDL |
| enable | dependsOn all ENABLED → status ENABLED → cache invalidate → writeActivity |
| disable | is_core 409; depended-upon 409 (with list) → DISABLED → cache invalidate → writeActivity |
| uninstall | must be DISABLED; is_core 409 → transaction: deregister permissions (409 if roles reference) + delete row → data retained → writeActivity |
| settings PATCH | via validate middleware (422 on bad body); merge Json |

**API:** `/api/modules` (list, `modules:view`), `/api/modules/enabled` (authenticated — feeds frontend), `POST :slug/install|enable|disable` (`modules:add`/`edit`), `DELETE :slug` (`modules:delete`), `PATCH :slug/settings` (`modules:edit`).

---

## Frontend

- `useModules()` hook — `GET /api/modules/enabled`, exposes `isEnabled(slug)`, `nav`, `nonCoreNav`.
- `ModuleGuard slug="x"` wraps every module page; AdminSidebar renders non-core nav dynamically from `nonCoreNav`.
- `app/admin/modules/page.tsx` — card grid with status badges, install/enable/disable/uninstall + ConfirmDialog, dependency warnings from 409s.

---

## Scaffold Generator

`npm run module:create -- --slug=blog --name="Blog"` → generates full anatomy (manifest, routes/controller/service/schema stubs with KDL conventions pre-wired, prisma file, seed, frontend page + ModuleGuard). `example` module in tree = living documentation.

### New Module Checklist (gate requirement for every new module)

- [ ] manifest Zod-valid; slug matches folder + schema file + apiPrefix
- [ ] models only in own `<slug>.prisma`; migration clean
- [ ] all routes behind moduleGate + authenticate + requirePermission
- [ ] permissions via manifest only
- [ ] every mutation → writeActivity
- [ ] frontend pages ModuleGuard-wrapped; nav via manifest only
- [ ] works when other non-core modules are disabled (no hard cross-module imports)
- [ ] disable → re-enable round-trip leaves no orphan state

---

## Implementation Order (COMPLETED 2026-07-06)

| Step | Task | Gate | Result |
|---|---|---|---|
| 1 | Multi-file schema refactor | empty migrate diff | ✅ |
| 2 | Module model + loader + gate | boot unchanged + unit tests | ✅ |
| 3 | Lifecycle + endpoints + cache | curl suite + no-restart toggle | ✅ |
| 4 | Core module manifests + seeder | clean-DB boot auto-registration | ✅ |
| 5 | Frontend | tsc exit 0 | ✅ |
| 6 | Scaffold generator + example module | full lifecycle round-trip | ✅ |
| 7 | Review | PASS (after H1-H3+M1-M5 fixes, KDL-77) | ✅ |
| 8 | E2E | 15/15 Playwright exit 0 | ✅ |
| 9 | Docs | cross-referenced | ✅ |

Carried-forward findings live in `.agents/REVIEW.md`.

---

## Known Risks (retained for future module builders)

- One broken manifest must never take the backend down — loader skips + logs.
- Cache staleness ≤60s between toggle and enforcement — accepted.
- Cross-module coupling is the long-term failure mode — checklist "works when others disabled" is the guard; reviewers test it, not trust it.
- Uninstall never drops tables. Data purge = manual, Prasanna-approved, destructive-op escalation by definition.
