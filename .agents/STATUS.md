# User Management RBAC — Build Status

Last updated: 2026-07-03

## KDLOS-10 Implementation Order

| Step | Issue | Status | Gate Evidence |
|---|---|---|---|
| 1 | KDL-32 — Prisma schema + migrations + seeder | ✅ Complete | `prisma validate` + `prisma migrate dev` exit 0; seeder idempotent |
| 2 | KDL-34 — permission-resolver + activity-logger + requirePermission middleware | ✅ Complete | `npm test` 57 passing |
| 3 | KDL-35 — Roles + Permissions + Activity Log endpoints | ✅ Complete | `npm test` 69 passing; new files wired in `index.js` |
| 4 | KDL-36 — Users module extension (multi-role, status, soft delete, reset-password, overrides, JWT roles) | ⏳ Not started | — |
| 5 | KDL-37 — Replace `requireRole` call sites | ⏳ Not started | — |
| 6 | KDL-38 — Frontend RBAC UI (PermissionMatrix, pages, usePermissions) | ⏳ Not started | — |
| 7 | Code Review | ⏳ Not started | — |
| 8 | Documentation updates | ⏳ Not started | — |
| 9 | Automated E2E gate | ⏳ Not started | — |
| 10 | KDL-40 — Drop `users.role` enum + remove `requireRole` | ⏳ Not started | — |

## Current Blockers

None.

## Notes

- New Step 3 files live in `backend/src/modules/user-management/{roles,permissions,activity}/`.
- Prisma model `RbacRole` is mapped to the `roles` table because the legacy `Role` enum still occupies the identifier.
- Permission cache invalidation is centralized in the service layer (`invalidatePermissionCache`).
- All mutation endpoints write activity log entries via `writeActivityAsync` with PII scrubbing.
