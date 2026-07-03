## Handoff — 2026-07-03
Agent: Backend Coder (Agent 3)
Issue: KDL-23 KDLOS-7 — Test harness + regression tests

Completed:
- Backend test harness
  - Added `vitest` + `supertest` to `backend/package.json` devDependencies.
  - Created `backend/vitest.config.js` (globals, node env, `tests/**/*.test.js`, `tests/setup.js`).
  - Created `backend/tests/helpers/app.js` with `buildApp`, `agent`, `bearer`, and cookie helpers.
  - Fixed hoisted-mock issues in existing controller/service tests so they run correctly.
  - Added route-level regression tests in `backend/tests/regression/`:
    - `auth.security.test.js` — httpOnly cookie flags, refresh-token rotation, forgot-password generic response, reset-password token consumption.
    - `users.privilege.test.js` — ADMIN cannot assign/modify/delete SUPER_ADMIN users.
    - `settings.optional-auth.test.js` — anonymous vs admin settings visibility.
    - `media.presigned.test.js` — presigned URL not stored, fresh URLs generated on list.
  - Verification: `npm test` in `backend/` → 9 files, 36 tests passing.

- Frontend test harness
  - Added `vitest` to `frontend/package.json` and `test: vitest run` script.
  - Created `frontend/vitest.config.ts` with `@/` alias resolution.
  - Added `frontend/tests/regression/utils.date.test.ts` for `formatDate` invalid-date guard.
  - Added `ignoreBuildIssues: true` + `allowBuilds` to `frontend/pnpm-workspace.yaml` so `pnpm test` runs without interactive build approval.
  - Verification: `pnpm test` in `frontend/` → 1 file, 2 tests passing.

- AI Services test harness
  - Added `supertest` to `ai-services/package.json` devDependencies.
  - Created `ai-services/vitest.config.js`.
  - Fixed hoisted-mock issues in existing tests (`budget-tracker`, `knowledge.ingest`, `short-term.memory`, `transcribe.controller`).
  - Fixed `search.tool.test.js` assertion (MEILI_SEARCH_API_KEY is a plain Bearer token, not JSON).
  - Added `ai-services/tests/regression/compliance.test.js` for PII scrubbing.
  - Added `ai-services/tests/regression/budget.test.js` for budget check/record/status.
  - Verification: `npm test` in `ai-services/` → 9 files, 20 tests passing.

- CI/CD
  - Updated `.github/workflows/ci.yml`:
    - Backend: install → syntax check → `npm test` with CI JWT secrets.
    - Frontend: install → build → `pnpm test`.
    - AI Services: install → syntax check → `npm test` with CI JWT secret.

Next:
- Code Reviewer should run the three test commands in a fresh checkout to confirm CI parity.
- After merge, monitor first PR to verify GitHub Actions runs all new test steps successfully.

Do not touch:
- `backend/src/modules/auth/service.js` / `controller.js` cookie logic unless tests require it.
- `ai-services/src/tools/search.js` — only the test was fixed, not the source.

Blockers:
- None.
