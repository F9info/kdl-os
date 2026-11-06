# How to Add a Module

Stable reference material moved out of the always-loaded `CLAUDE.md` (KDL-336) to cut
per-run token cost. Read this on-demand when you are scaffolding or reviewing a module.

---

## Quick start — scaffold generator

```bash
cd backend
npm run module:create -- --slug=blog --name="Blog"
# OR: node scripts/create-module.js --slug=blog --name="Blog"
```

Creates `backend/src/modules/blog/` (module.json, routes.js, controller.js, service.js, schema.js, seed.js), `backend/prisma/schema/blog.prisma`, and `frontend/src/app/admin/blog/page.tsx`. Files that already exist are skipped (safe to re-run).

---

## Module anatomy

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

## module.json format

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
      "path": "/admin/blog",       // must be an existing admin page
      "icon": "FileText",          // a name listed in frontend/src/admin/lib/nav-icons.ts
      "permission": "blog:view",   // optional — hide entry if user lacks this
      "order": 60                  // optional — position among siblings (default 100)
      // "group": "Settings", "groupIcon": "UserCog", "groupOrder": 30   nest under a collapsible group
      // "activeWhen": { ... }     highlight on a different URL than `path` (stage pages)
    }
  ],
  "icon": "LayoutGrid",            // bundles (umbrella modules) only: icon of the bundle's own entry
  "dependsOn": [],                 // slugs that must be INSTALLED before this can install
  "queues": [],                    // BullMQ queue names (informational — not enforced yet)
  "env": []                        // required env var names — install fails if any are missing
}
```

**Navigation is configured in one place.** The sidebar and the command palette are both built from the enabled modules' manifests (`frontend/src/admin/lib/nav-model.ts`); the only entry that is not a module is the Dashboard (the app shell). To add a menu entry, add it to your `module.json`; to add an icon, add it to `nav-icons.ts`. Parts of an umbrella bundle (CMS > Frontend) are listed under the bundle automatically.

---

## New module checklist

Before submitting for code review, verify every item:

- [ ] `module.json` is Zod-valid; `slug` matches the folder name, `apiPrefix`, and prisma schema filename
- [ ] All Prisma models live in `prisma/schema/<slug>.prisma` only — never mixed with other modules
- [ ] `npx prisma migrate dev` applies cleanly; `npx prisma validate` exits 0
- [ ] All routes are behind `moduleGate(slug)` + `authenticate` + `requirePermission`
- [ ] Permissions are registered via the `permissions` array in manifest — never via manual seeder edits
- [ ] Every mutation calls `writeActivityAsync` (PII-scrubbed — no passwords or tokens in `properties`)
- [ ] Frontend pages are wrapped in `<ModuleGuard slug="<slug>">` and nav comes from the manifest only (never add links to `AdminSidebar.tsx`; `tests/regression/nav-config.test.ts` fails on an unknown icon, a duplicate link or title, a link to a page that does not exist, or an unregistered permission)
- [ ] Module works correctly when other non-core modules are disabled (no cross-module coupling)
- [ ] Disable → re-enable round-trip leaves no orphaned DB state
