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

## New module checklist

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
