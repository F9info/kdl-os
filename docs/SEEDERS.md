# Migrations, seeders and module lifecycle

One rule for the whole project. Core modules are initialised by the core seed at installation; every optional
module is initialised by its own `seed.js` when it is installed. Nothing is inserted by hand.

| Layer | Owns | Where |
|---|---|---|
| Migrations | tables, columns, indexes, constraints, relations | `backend/prisma/migrations` (schema in `backend/prisma/schema/*.prisma`, one file per module) |
| Seeders | default records: module rows, permissions, roles, settings, templates, predefined pages | core: `backend/prisma/seed.js` + `backend/prisma/seeders/`; module: `backend/src/modules/<slug>/seed.js` |
| Application code | business logic, APIs, screens, gateway integrations | everything else. Never put executable behaviour in a seeder |

## Fresh installation

`npx prisma migrate deploy` then `node prisma/seed.js` (`npm run db:seed`). The core seed registers the core
modules (every manifest with `"core": true`) as ENABLED, creates their permissions, the roles (Super Admin,
Developer, Admin, User) and their grants, default settings and the first admin accounts. Optional modules are
only listed as AVAILABLE (from their `module.json`); none is initialised yet.

## Installing an optional module

`POST /api/modules/<slug>/install` (Admin > Modules > Install): validates dependencies (installing them first),
registers the module row, registers its permissions from `module.json` and grants them to Developer/Admin per
`role-blueprints.js`, runs `backend/src/modules/<slug>/seed.js` in the same transaction (a failure rolls the
whole install back), and clears the permission cache. Enable then switches routes, navigation and APIs on.
Navigation comes from the manifest `nav` array, so there is no navigation table to seed and no hardcoded
sidebar entry.

## What a module seed must do

`seed.js` exports a default function (or one named `seed*`) taking the transaction client.

1. **Idempotent.** Key every record by a stable unique slug/key, never by an id. Use `upsert` with an empty
   `update: {}` (create once) or `createMany({ skipDuplicates: true })`.
2. **Never overwrite what a user may have changed:** values, names, descriptions, templates, active flags, pages,
   credentials. An `update` branch may only sync structure (type, sort, relations), never user-editable content.
3. **Keep system defaults and demo content apart.** Demo data respects the owner's choice (for Frontend: skipped
   only if the Setup Wizard answered "no").
4. **Disable never deletes; re-enable reuses.** Do not remove rows in `onDisable`.
5. No hardcoded database ids.

## Verifying it

```
createdb kdl_audit
DATABASE_URL=postgresql://postgres:postgres@localhost:5443/kdl_audit npx prisma migrate deploy
DATABASE_URL=... REDIS_URL=... JWT_SECRET=... JWT_REFRESH_SECRET=... node scripts/verify-seeders.mjs
```

`backend/scripts/verify-seeders.mjs` (refuses to run on a non-scratch database; exit code 1 on any finding):
runs the core seed on an empty DB, installs and enables every optional module, runs every seed a second time
and fails on any added, changed or removed row outside log tables, checks that user edits (setting, theme value,
notification template, role name, type name, plan, page) survive, disables and re-enables everything and checks no
data is lost or duplicated, and checks navigation paths are unique. It discovers modules from their manifests, so
a new module is covered automatically.
