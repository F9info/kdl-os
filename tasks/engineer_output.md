# Engineer Output — KDL-151: Media DAM remaining fixes (Folder toolbar + KDL-MEDIA-12 permissions)

**Agent:** CEO
**Date:** 2026-07-11
**Status:** Done — backend vitest 634/634, frontend `tsc --noEmit` exit 0, e2e 4/5 (1 pre-existing skip)

## Summary

Follow-up to KDL-150. A prior run had already implemented both items but died mid-flight (max-turns) leaving the work uncommitted. This run reviewed the full diff for correctness, ran every gate, then rebuilt and reseeded the docker stack to prove the RBAC gate against the live API and the folder-button fix against the live UI. No production code changes were needed — the prior implementation was correct.

## Item 1 — Folder toolbar button

`frontend/src/app/admin/media/page.tsx` — the toolbar **Folder** button (in the main library toolbar) calls the same `setCreateFolderOpen(true)` used by the Folders-panel `+` icon, opening the identical New-folder dialog.

**Gate verified live:** headless browser click on toolbar Folder → dialog opens → typed a unique name → Create → folder appeared in the folder tree. Test folder deleted after.

## Item 2 — KDL-MEDIA-12 granular per-feature permissions

### Files changed (by the prior run, reviewed this run)

| File | Change |
|---|---|
| `backend/src/shared/modules/manifest-schema.js` | `permissions` array entries can now be a bare string (default 5 CRUD actions) or `{ name, actions }` (explicit list) — generic module infra |
| `backend/src/shared/modules/permission-actions.js` (new) | `resolvePermissionEntry` / `permissionModuleLabel` helpers shared by the module-loader and both seeders |
| `backend/src/modules/media/module.json` | Registers all 23 media actions via the manifest's `permissions` array |
| `backend/src/modules/media/routes.js` | Every route guarded by `requirePermission('media', <action>)` — one action per feature, not the generic 5 |
| `backend/src/modules/media/controller.js` | `updateMedia` checks `visibility-toggle` separately from `metadata-edit` since both share `PATCH /:id` |
| `backend/src/modules/modules/service.js` | `registerPermissions`/`deregisterPermissions` use the new shared resolver instead of a hardcoded 5-action list |
| `backend/prisma/seed.js` | `seedCoreModules` now runs before `seedUserManagement` so Admin's auto-grant sees media's manifest-driven rows |
| `backend/prisma/seeders/modules.seed.js` | Same generic-actions refactor as `modules/service.js` |
| `backend/prisma/seeders/user-management.seed.js` | `media` removed from the hardcoded module list; its permission rows are pulled in from the manifest-registered set instead |
| `backend/prisma/seeders/media-phase-b.seed.js` | Deleted — superseded by the manifest-driven registration |
| `backend/tests/media/rbac.test.js` (new) | 6 tests: manifest registers every required action, AI-Providers nav requires `media:ai-providers`, view+upload-only role passes its own guards and 403s on every other feature, granting `edit-image` unblocks only that guard, Super Admin bypasses everything |
| `frontend/src/app/admin/media/page.tsx`, `DamExtensions.tsx`, `MediaLightbox.tsx` | Every control/tab/nav entry conditionally rendered from `usePermissions().can('media:<action>')` |

### Gates run this session

```
backend: npx vitest run              → 56 files, 634 tests, all pass
frontend: npx tsc --noEmit           → exit 0
e2e: E2E_BASE_URL=http://localhost:3001 npx playwright test e2e/media-dam.spec.ts
                                      → 4 passed, 1 skipped (pre-existing, clamd not configured)
```

### Live gate verification (rebuilt + reseeded docker stack)

Rebuilt `kdl-starter-kit-backend`/`-frontend` images (containers bake code at build, don't hot-reload), ran `prisma migrate deploy` + `node prisma/seed.js` inside the backend container, then:

1. Created a throwaway role with only `media:view` + `media:upload`, and a throwaway user assigned to it.
2. `GET /api/auth/me/permissions` as that user → `{"permissions":["media:view","media:upload"],"bypass":false}`.
3. `GET /api/media` → 200, `GET /api/media/folders` → 200.
4. `POST /api/media/folders`, `GET /api/media/trash`, `GET /api/media/ai/providers`, `POST /api/media/shares`, `GET /api/media/import/providers` → all 403.
5. Granted `media:edit-image` on the role → `POST /api/media/:id/edit` no longer 403 (422 validation error on the fake ID/body, i.e. the permission gate passed) while `POST /api/media/shares` (share-link) stayed 403.
6. Deleted the throwaway user, attempted role delete (409 — role still referenced by the soft-deleted user's `user_roles` row, expected FK-guard behavior, left as a harmless orphaned test role in the dev DB).

This matches the KDL-151 acceptance gate exactly: a view+upload-only role sees just the library + Upload; granting `edit-image` reveals only that feature.

## Known non-blocking loose end

Deleting the test role left a 409 (role still assigned via a soft-deleted user) — this is correct FK-guard behavior, not a bug, but means one orphaned `media-uploader-test` role remains in the `kdl-starter-kit` dev database. Harmless; can be hard-deleted by an admin if desired.
