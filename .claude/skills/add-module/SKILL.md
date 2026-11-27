---
name: add-module
description: Use when creating a new backend module (a new feature area with its own routes, permissions and manifest) in KDL OS. Do not use for editing an existing module.
---

# Add a module

1. Read `docs/MODULE_GUIDE.md` (scaffold, `module.json`, anatomy, pre-review checklist).
2. Scaffold: `cd backend && npm run module:create -- --slug=<slug> --name="<Name>"`.
3. Fill `routes -> controller -> service`, Zod schemas, `requirePermission('<slug>', action)` on every route.
4. A module nobody listed is Developer-only. To grant other roles, edit `backend/src/modules/user-management/shared/role-blueprints.js` and `role-blueprints.test.js`, and bump `ROLE_BLUEPRINT_VERSION`.
5. Do not insert demo or placeholder rows on install unless the owner chose a starter site (see `demo-seeds.test.js`).
6. Add tests, run the `run-tests` skill, then hand the diff to `code-reviewer`.
