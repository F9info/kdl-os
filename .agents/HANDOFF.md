## 2026-08-19 — KDL-503: template-engine Phase 1 — DAG state machine, server-side gates, additive migration, RBAC (Backend Coder)

**Branch:** `feat/kdl-501-template-engine-orchestrator` — PR #172

**Done:**
1. **Prisma additive migration** `20260819000000_add_template_engine_dag`: `TemplateEngineRun` + `TemplateEngineStage` models, `RunStatus`/`DagStage`/`StageStatus` enums, `@@unique([runId, stage])`, `@@index([projectId])`. `prisma validate` ✅
2. **9-stage DAG** (stages + slugs verbatim from §3): intake → palette → inference → approval → [guidelines ‖ collateral ‖ website] → preflight → export. Fan-out is independent — one failing branch does not fail siblings.
3. **Server-side gates**: `POST /runs/:id/stages/:stage/advance` returns 409 `STAGE_GATE_FAILED` with named `blockingReason` when §3 Depends-on unmet (KDL-446 precedent).
4. **Crash recovery** (§4.1): orphaned RUNNING → FAILED(INTERRUPTED) at advance time; `markInterruptedStages()` on resume endpoint; approval sub-step outputRef contract.
5. **Driver interface**: 9 stubs all throw `UPSTREAM_NOT_BUILT (503)`; preflight + export have real read-only implementations.
6. **RBAC**: custom actions `["view","run","approve","export"]`; `:approve` double-enforced in controller for stage 4; cross-project 404 leakage guard.
7. **Manifest**: `dependsOn` including brand-kit/collateral/credits; nav "Studio"/Sparkles; `conflictsWith` unchanged; `moduleGate` 404 when disabled.
8. **Activity scope** (§8.2): `templateEngineActivityScope()` cutover-guard helper.
9. **71 tests**: gate.test.js (30), dag.test.js (9), recovery.test.js (6), leakage.test.js (7), template-engine.test.js (19).

**Next:** Code Reviewer reviews PR #172; Phase 2 fills in one driver at a time once upstream modules ship.

---

## 2026-08-19 — KDL-501: template-engine orchestrator backend — 9-stage DAG per TEMPLATE_ENGINE_ARCH.md (Backend Coder)

**Branch:** `feat/kdl-501-template-engine-orchestrator` — PR against master

**Done:** Full 9-stage DAG orchestrator backend for the `template-engine` module (promotion of Phase-0 stub). This is a thin coordination layer — contains NO theming/rendering logic; drives existing engines via public APIs only.

Key deliverables:
1. **Prisma schema** `backend/prisma/schema/template-engine.prisma` — `TemplateEngineRun` + `TemplateEngineStage` models; `RunStatus`, `StageStatus`, `DagStage` enums; `@@unique([runId, stage])`; `outputRef Json?` stores pointers not payloads (§4).
2. **Additive migration** `20260819000000_add_template_engine_dag/migration.sql` — creates the two tables + enums; no destructive changes.
3. **`module.json`** updated from Phase-0 stub: permissions `[{name:"template-engine",actions:["view","run","approve","export"]}]`; `dependsOn` wired; nav entry `/admin/template-engine`.
4. **`service.js`** — `checkGate` (pure, per §3 Depends-on), `createRun`, `getRun` (cross-project 404 guard §10), `listRuns`, `markInterruptedStages` (crash-resume: RUNNING→FAILED INTERRUPTED), `advanceStage` (gate + orphan RUNNING detection + driver.execute + DB upsert/update), `getExportManifest`, `templateEngineActivityScope` (§8 D3 data-hygiene: cutover from `_prisma_migrations`, appends `created_at >= cutover` to activity_log queries).
5. **`drivers/index.js`** — 9 stage drivers. `preflight` aggregates named branch errors; `export` builds handoff manifest from outputRefs. Brand-kit/collateral/credits stubs throw `UPSTREAM_NOT_BUILT` (503) — DAG state machine is fully testable independently (Phase 1).
6. **`schema.js`** — Zod schemas using combined `z.object({params,body,query})` shape per validate middleware.
7. **`controller.js`** — `requireProjectId` header guard; `advanceStage` checks `template-engine:approve` for the APPROVAL stage; named error codes (STAGE_GATE_FAILED, STAGE_INTERRUPTED, UPSTREAM_NOT_BUILT) surfaced.
8. **`routes.js`** — full REST surface under module `apiPrefix`.
9. **Test suite** (5 test files, 79 files total, 960 tests passing): `template-engine.test.js` (19 tests: gate pass/block, crash recovery, activity scope, server-side gate, preflight driver); `gate.test.js` (all 9 stage gate conditions); `dag.test.js` (fan-out independence, gate rejection, UPSTREAM_NOT_BUILT recording); `recovery.test.js` (crash recovery); `leakage.test.js` (cross-project isolation). Prisma validates clean.

**D3 (slug conflict):** D3 was already RESCINDED in DECISIONS.md from PR #170; `template-engine` slug is locked to the orchestrator per board tie-breaker d326e28f.

**Phase 1 state:** Brand-kit (KDL-451), collateral (KDL-452), and credits modules are not yet on master → 7 of 9 drivers are stubs returning UPSTREAM_NOT_BUILT (503). Replace each with a real HTTP call once the upstream module ships. `preflight` and `export` drivers are fully implemented (pure read/aggregate, no upstream call needed).

**Next:** Code Reviewer reviews this PR. KDL-502 (or similar) implements frontend stepper surface per STUDIO_IA.md. Once brand-kit lands, replace intake/palette/inference/approval/guidelines drivers with real calls.

---

## 2026-08-18 — KDL-485: STUDIO_IA.md — canonical source-app IA for the template-engine surface (Frontend Architect)

**Branch:** `docs/kdl-485-studio-ia` — docs-only

**Done:** `.agents/arch/STUDIO_IA.md` (OQ-1 output, per PM-001 resolution): extracted the real admin nav tree at master `3369250` with file:line cites (`AdminSidebar.tsx` `FLAT_ITEMS`/`GROUPS`, `useModules.ts` `nonCoreNav`, module `nav[]`); ruled prototype `enabled:false` ≙ module registry status DISABLED/INSTALLED (no per-entry flag); stated the Mode A boundary (+1 sidebar entry `/admin/template-engine`, −2 via `conflictsWith`, everything else untouched, non-destructive Mode B restore); L1–L8 LOCKED vs E1–E5 extensible freeze table; 9-stage → surface mapping with a stage-list-agnostic contract (single sidebar entry, deep-linkable `/{stage-slug}` routes, in-surface stepper).

**Gaps flagged (§6):** G1 the 9-stage list is enumerated NOWHERE in the repo (only the count at `PRODUCT_MODES_ARCH.md:158`) — KDL-486 must fix the canonical list; G2 manifest nav can't express subsections (intentional, don't extend); G3 core manifests' inert `nav[]` has drifted from rendered truth; G4 CommandPalette omits module entries (Studio unreachable via palette in Mode A); G5 no sidebar progress affordance (kept in-surface deliberately).

**Next:** Code Reviewer reviews the PR (review child issue filed); KDL-486 (Backend Architect) consumes this doc and owns the canonical stage list + D3→RESCINDED hygiene.

---

## 2026-08-17 — KDL-460: waived + dismissed 3 unpatchable dev-only Dependabot alerts (Security & Compliance Engineer)

**Branch:** `security/kdl-460-waivers` — PR #155

**Done:**
1. **Verified dev-only exposure** — `image-size@1.2.1` has exactly one dependent in `frontend/pnpm-lock.yaml`: `@storybook/nextjs@8.6.18` (devDependency; Storybook not shipped). `elliptic@6.6.1` reachable only via `browserify-sign`/`create-ecdh` ← `crypto-browserify` ← `node-polyfill-webpack-plugin` ← same Storybook chain. GitHub marks all 3 alerts `scope: development`, `first_patched_version: null`.
2. **Dismissed alerts #85, #84 (image-size HIGH), #47 (elliptic LOW)** via `gh api` as `tolerable_risk` referencing KDL-460 — **open Dependabot alerts now 0**.
3. **WAIVERS registry** added to `docs/DEPENDENCY_TRIAGE.md` (justification + tracking issue + review-by 2026-11-17 each); `dependency-audit.yml` waiver comments now point at the registry, elliptic GHSA added to the set for tracking.

**Next:** Code Reviewer to review/merge PR #155. Weekly audit (KDL-433) re-checks `first_patched_version` — fast-follow bump issue the moment upstream ships a fix.

---

## 2026-08-17 — KDL-448 Phase 0 FRONTEND: nav icons + locked_by badge + Puck persistence + template-engine stub (Frontend Coder)

**Branch:** `kdl-446-product-modes-arch` — commit `8978fd3`

**Done:** All 4 frontend deliverables:
1. **Nav icons** — Added `Palette`, `LayoutTemplate`, `Sparkles` to `MODULE_ICON_MAP` in AdminSidebar so theme-engine-ui, page-builder-ui, template-engine nav entries render correct icons (not Package fallback)
2. **locked_by read-only badge** — Theme Engine page imports `useModules`, checks `isEnabled('template-engine')`, shows amber "Managed by Template Engine" banner and wraps editor in `pointer-events-none`. Backend 409 is the authoritative gate.
3. **Puck persistence** — `store.ts` fully rewritten to call backend API (`GET/POST/PUT/DELETE /api/page-builder`). Listing page uses `useQuery/useMutation`. Editor uses `useQuery` + `useMutation` for save/publish. Public `/p/[slug]` uses backend public route. Pages survive container restart.
4. **Template-engine stub admin** — `/admin/template-engine/page.tsx` with ModuleGuard, mode status display, Phase 0 notice. Backend manifest updated with nav entry `{label: "Template Engine", path: "/admin/template-engine", icon: "Sparkles"}`.
5. **Type-check fix** — Installed missing `@axe-core/playwright` dev dep that prevented `pnpm type-check` exit 0.

**Gates:** `pnpm type-check` exit 0 ✅ | `pnpm build` exit 0 ✅ | RTL suite 147/147 exit 0 ✅

**Next:** CEO to run browser gate (localhost:3101, admin@kdl.com/Admin@123) and open single KDL-446 PR.

---

## 2026-08-17 — KDL-447 Phase 0 BACKEND: conflictsWith + engine/UI split + locked_by + Puck persistence (Backend Coder)

**Branch:** `kdl-446-product-modes-arch` — commit `6f9e3e7`

**Done:** All 4 deliverables on `kdl-446-product-modes-arch`:
1. `conflictsWith` — manifest schema + symmetric bidirectional 409 in installModule/enableModule
2. Engine/UI split — theme-engine→core (no nav), +theme-engine-ui; page-builder→core (no nav), +page-builder-ui; template-engine stub (conflictsWith + seed/uninstall for locked_by)
3. locked_by — migration (`ALTER TABLE setting_fields ADD COLUMN locked_by TEXT`) + 409 gate in theme-engine upsertValues
4. Builder persistence — migration creating `builder_pages` table (service/controller/routes already existed)

**Gates:** prisma validate exit 0; backend vitest 886/886 exit 0; ai-services vitest 21/21 exit 0.

**Next:** KDL-448 (frontend child: nav hide + locked_by badge + browser gate) must complete before CEO opens the single KDL-446 PR.

---

## 2026-08-17 — KDL-440 Phase C integration + browser gate + PR (QA / Test Engineer)

**Scope:** Integration branch `feat/kdl-437-theme-engine-rename` merges BE (`feat/kdl-437-theme-engine-be`) + FE (`feat/kdl-437-theme-engine-fe`). Phase C browser gate + grep gate complete. PR open for CEO/board review.

**Gate results:**
- Browser gate (KDL-440 5-test Playwright suite): **5/5 PASS** — sidebar "Theme Engine", /admin/theme-engine loads, sidebar not flooded (<40 links), API routes renamed, /admin/theme-engine accessible
- API route checks: `GET /api/template-engine/tokens → 404 ✓`, `GET /api/theme-engine/tokens → 200 ✓`
- th-consume-gate renamed spec: (c), (e), (f) pass; (a), (b), (d) have pre-existing failures (networkidle timeout + Tailwind CSS specificity — not caused by rename)
- Final grep gate: `git grep -iE "template.?engine"` returns 47 lines — all in DECISIONS.md (D3 reserved note), HANDOFF.md/HANDOFF_ARCHIVE.md (historical), backend/prisma/migrations (SQL WHERE clauses), template-engine.html (prototype). Zero live code or config matches.

**Module registry change:** slug `template-engine` → `theme-engine`, name "Template Engine" → "Theme Engine". kdl-module-tracker artifact should be re-synced.

**Reserved:** The name `template-engine` is now RESERVED and unused — future page/content template module must use a different slug (see .agents/DECISIONS.md D3).

---

## 2026-07-18 — KDL-385 a11y skip-to-main-content (Frontend Coder)

**Done:** Added skip navigation link (WCAG 2.4.1 Level A) — PR #106 open for review.

- `frontend/src/app/admin/layout.tsx`: skip link is first focusable element, `sr-only` + visible on focus
- `frontend/src/components/layout/AdminShell.tsx`: `id="main-content"` on `<main>`
- Branch: `feat/kdl-385-skip-to-main`, base: master
- Note: cherry-picked from `2c9757b` which was mistakenly bundled in `feat/kdl-386-aria-modal`; that branch still contains the skip-link changes — will be a no-op diff when KDL-386 eventually merges after KDL-385 merges first.

---

<!-- ROLLING WINDOW: keep only the most recent ~8 entries here to minimise per-run context.
     Prepend new entries at the top; move anything older than the window into HANDOFF_ARCHIVE.md.
     Full history: .agents/HANDOFF_ARCHIVE.md (and git log). -->

## 2026-08-17 — KDL-438 Template Engine → Theme Engine rename complete (Backend Coder)

**Scope:** Backend + DB migration + shared docs. Branch: `feat/kdl-437-theme-engine-be`.

**Changes:**
- `backend/src/modules/theme-engine/` — renamed from `template-engine` via git mv (history preserved)
- `module.json`, `seed.js`, `service.js`, `controller.js`, `uninstall.js`, `routes.js`, `kdl191-gate.mjs` all updated
- Redis token cache key prefix: `te:tokens:*` → `th:tokens:*` (old keys expire at TTL=600s)
- App settings keys: `template_engine.*` → `theme_engine.*`
- Prisma migration: `20260817000000_rename_template_engine_to_theme_engine` (modules, permissions, owner_module, app_settings)
- Shared docs: TEMPLATE_ENGINE_ARCH.md → THEME_ENGINE_ARCH.md; D3 decision recorded
- Deleted junk dups: `uninstall 2.js`, `kdl191-gate 2.mjs`

**Phase C gates:** `prisma validate` exit 0; vitest 95/95; grep returns 0 live matches.

**Deploy note:** Redis `te:tokens:*` flush on deploy (or let TTL expire naturally).

**Next:** Frontend sibling task to rename frontend components; Code Reviewer to verify PR.

---

## 2026-07-18 — KDL-414 NEXT_PUBLIC_IMAGE_HOSTS must be Docker build arg (Frontend Coder)

**Scope:** Rework PR #118 (branch `fix/kdl-412-admin-images`) — KDL-413 code review blocker.

**Problem:** `NEXT_PUBLIC_IMAGE_HOSTS` was set only in docker-compose `environment:` (runtime), which is invisible during `pnpm build`. Because the frontend uses `output: 'standalone'`, CSP headers and `images.remotePatterns` are resolved at build time and baked into `routes-manifest.json`. The standalone `server.js` never re-reads `next.config.ts`, so only the `localhost:9000` fallback was ever baked in regardless of the compose runtime env.

**Empirical proof (from KDL-413):** gate container ran with `NEXT_PUBLIC_IMAGE_HOSTS` in `process.env` yet served `img-src ... http://localhost:9000`.

**Fixes:**
- `frontend/Dockerfile` builder stage: added `ARG NEXT_PUBLIC_IMAGE_HOSTS=http:localhost:9000` + `ENV NEXT_PUBLIC_IMAGE_HOSTS=$NEXT_PUBLIC_IMAGE_HOSTS` before `RUN pnpm build` (same pattern as `NEXT_PUBLIC_API_URL`).
- `docker-compose.yml` frontend service: changed `build: ./frontend` → `build: {context, args: {NEXT_PUBLIC_IMAGE_HOSTS: http:localhost:9002}}`. Kept runtime `environment:` entry with a comment marking it inert (visibility only).
- **Corrected false claim** in KDL-412 HANDOFF entry below: "restart picks it up without rebuild" was wrong — a `docker compose build frontend` is always required when changing `NEXT_PUBLIC_IMAGE_HOSTS`.

**Deploy note:** Any environment changing this value needs `docker compose build frontend` — a container restart alone has no effect.

**Verified:** `pnpm type-check → 0 errors`. Dockerfile + compose syntax clean.

**Next:** PR #118 updated; request Code Reviewer re-gate (KDL-413 → in_review).

## 2026-07-18 — KDL-412 Fix broken admin images/icons + broken links (Frontend Coder)

**Scope:** Broken logo preview (Theme Settings), broken media library thumbnails, and reported "broken links" (KDL-408). Branch `fix/kdl-412-admin-images`.

**Root cause:** Docker compose maps MinIO's host port as `9002:9000`, and the backend sets `MINIO_PUBLIC_PORT=9002` so presigned URLs use `http://localhost:9002/…`. The frontend's CSP `img-src` defaulted to `http://localhost:9000` (hardcoded fallback in `next.config.ts` when `NEXT_PUBLIC_IMAGE_HOSTS` is unset). Every presigned URL the browser tried to load was blocked by CSP → broken-image glyph.

**Fix:**
- `docker-compose.yml`: added `NEXT_PUBLIC_IMAGE_HOSTS: http:localhost:9002` to the `frontend` service environment. `next.config.ts` reads this at server startup to build both the `img-src` CSP directive and `images.remotePatterns`.
- `.env.example`: documented the var for non-Docker users (no default needed — bare pnpm dev keeps MinIO on the same `localhost:9000` that the code already falls back to).
- `.agents/WORKSPACE_MAP.md`: corrected MinIO port from `9000` (container) to `9002` (host).

**Verified:** `pnpm type-check → 0 errors`.

**Next:** PR against master; request Code Reviewer gate.

## 2026-07-18 — KDL-410 Frontend design/link regressions from PR #75 dep bump (Frontend Coder)

**Scope:** Fix broken dark-mode toggle and icon typo introduced by PR #75 dep bump (next-themes 0.3→0.4, lucide-react 0.460→0.577). Commit `aeffa8b`, branch `fix/kdl-406-admin-css`.

**Root causes found:**
1. **Dark-mode toggle broken**: `CommandPalette` read `theme`/`setTheme` from `useUiStore` (Zustand, persists to `localStorage['kdl-ui']`), which never synced with next-themes' `ThemeProvider` (reads/writes `localStorage['theme']`). Clicking "Toggle theme" updated Zustand state but applied no class change to `<html>`. Fix: import `useTheme` from `next-themes` directly; remove redundant `theme`/`setTheme` from `ui.store.ts`.
2. **SendHorizonal typo**: `integrations/page.tsx` imported misspelled `SendHorizonal` instead of `SendHorizontal`. Currently aliased in lucide-react 0.577, but a deprecated no-op in future versions.

**Verified:** `pnpm type-check` → 0 errors, `pnpm build` → green.

**Next:** PR with these 3-file change set. KDL-410 → done.

---

## 2026-07-17 — KDL-353 E1 Ink & Dawn palette + typography fallback seeded into TE defaults (Backend Coder)

**Scope:** `backend/src/modules/theme-engine/schema/index.js`

**Changes:**
- Brand Colors Primary: `#4f8ef7`→`#7468F3` (dark), `#0a66f0`→`#2119B3` (light) — Ink
- Brand Colors Highlight: new field `#F7B23B` (dark) / `#F9941F` (light) — Dawn
- Typography H1–H3 family: `'Poppins'`→`'Poppins, Sora'` across all 4 device breakpoints
- FONTS: added `'Poppins, Sora'` and `'Sora'` as selectable options

**PR:** #91 → master.

---

## 2026-07-17 — KDL-349 Ink & Dawn palette seeded into TE schema defaults (Backend Coder)

**Scope:** `backend/src/modules/theme-engine/schema/index.js` Brand Colors only.

**Changes:** 2 lines — primary (`#7468F3` dark / `#2119B3` light) and accent/highlight (`#F7B23B` dark / `#F9941F` light) set in `BASE_TABS[branding]` Brand Colors sections.

**PR:** #89 → master.

---

## 2026-07-17 — KDL-275 M4 config/CORS/error-leak/infra + notifications hardening (Security & Compliance Engineer)

**Scope:** KDL-270 audit findings M5, M6, M7, M8, M10, M11, M14, L13, L14, L16, L17. Deliberately did NOT touch `/share/:token` media routes (M9/L15 deferred to PR #46). PR #55 → master.

**Fixes:**
1. **M6** `backend/src/index.js` — fail-fast at boot when `CORS_ORIGIN` unset; comma-separated explicit allowlist (no more origin reflection with `credentials:true`).
2. **M7** `ai-services/src/index.js` + `middleware/auth.js` — bare `cors()` replaced with `CORS_ORIGIN`/`FRONTEND_URL` allowlist; cookie-authenticated calls now require an allowlisted `Origin` header (CSRF defense), Bearer-header calls exempt.
3. **M8** `backend/src/middleware/errorHandler.js` — 500 details masked unless `NODE_ENV==='development'` (was `!=='production'`, so staging leaked).
4. **M10** ai-services `chat|embed|transcribe` controllers — upstream `err.message` logged server-side, generic 500 returned.
5. **M11** `docker-compose.infra.yml` — `${VAR:?}` fail-fast creds from `.env` (no baked-in postgres/minio/meili defaults), all ports bound `127.0.0.1:`.
6. **M5** `notifications/routes.js` + `frontend/src/hooks/useNotificationStream.ts` — SSE auth via single-use 60s Redis ticket (`POST /notifications/stream/ticket`, `GETDEL` consume); JWT no longer in query string. HS256 pinned on the notif JWT verify (L1's notif site).
7. **M14** `notifications/{schema,routes,controller}.js` — real Zod schemas (`.strict()`) + `validate()` on all mutating routes; controllers read `req.validated.body`; `is_system` not settable.
8. **L13** ai-services `trust proxy 1`; 10mb JSON limit scoped to `/api/ai/transcribe` only (default 100kb elsewhere).
9. **L14** `docker-compose.yml` + `docker-compose.staging.yml` — all host ports `127.0.0.1:`; Redis `--requirepass` + password-form `REDIS_URL`; staging overlay documented CI/E2E-only.
10. **L16** `config/meilisearch.js` + `.env.example` — `MEILISEARCH_API_KEY` documented as scoped admin key with generation recipe; master key confined to Meili container.
11. **L17** `storage-settings/service.js` — raw S3/MinIO SDK errors mapped to 8-entry client-safe taxonomy; raw message stays in server log.

**Verified:** backend notifications schema/controller + new `tests/error-handler.test.js` masking matrix — 29/29; ai-services full suite incl. new transcribe generic-500 test — 21/21; all 3 compose files `docker compose config` clean with vars set and hard-fail without; `node --check` clean; `ioredis@5.11.1` has `getdel`.

**Deploy note (DevOps):** `.env` now REQUIRES `POSTGRES_USER/PASSWORD/DB`, `REDIS_PASSWORD` (+password-form `REDIS_URL`), `MINIO_ROOT_USER/PASSWORD`, `MEILI_MASTER_KEY`, and backend refuses to boot without `CORS_ORIGIN` (ai-services without `CORS_ORIGIN`/`FRONTEND_URL`). Frontend SSE now needs the ticket endpoint — deploy backend before/with frontend.

**Next:** PR #55 awaiting Code Reviewer (Maker ≠ Grader).


## 2026-07-14 — KDL-192 sidebar pollution fix: Type/Category/SettingField ownership contract (CEO agent, standing in as Backend Coder)

**Bug:** post-KDL-174/175/176/177/178/191, the Theme Engine's 86 seeded panes (Types) all auto-promoted to top-level `AdminSidebar` menu items (`typeLeaves` from unfiltered `GET /types?is_active=true`), flooding "Application Settings" with every `webapp.*|tv.*|android.*|ios.*` pane. Root cause: no way to mark a Type/Category/SettingField as module-private data vs a standalone Application-Settings entry.

**Fix — general ownership contract (also future-proofs modules 9-14 reusing these tables):**
1. `owner_module String? @@index` added to `Type`, `Category`, `SettingField` in `core.prisma`; migration `20260714035014_add_owner_module_to_settings_tables`.
2. `theme-engine/seed.js` stamps `owner_module: 'theme-engine'` on every Type/Category/SettingField it upserts (idempotent — verified via direct re-run against the dev DB: 0 created, 3910 updated on first pass after migration, all rows backfilled).
3. `types|categories|setting-fields` `service.js`: `listX` defaults `where.owner_module = null` unless an explicit `?ownerModule=` query param is passed (added to each `schema.js`). This alone fixes the sidebar.
4. `setting-fields/service.js` `getTypeBySlug` (used only by the generic `/admin/settings/view/[slug]` → `GET /setting-fields/by-type/:slug`) now filters `owner_module: null` too, so a module-owned slug can't be reached by direct URL either — verified `webapp.branding` → 404, standalone type → 200.
5. `frontend/.../theme-engine/page.tsx` platform switcher relabeled Android → "Android Native", iOS → "iOS Native" (ids unchanged); Web App/TV already matched.

**Verified live** against the dev-local Postgres (`localhost:5433/kdl_db`, isolated `npm ci` + `prisma generate` in a scratch worktree, backend started on a scratch port `4099`, real login as `admin@kdl.com`):
- `GET /types` (no param): **total 1** (was 87) — only the standalone "Theme Settigns" type; `?ownerModule=theme-engine` → 86.
- `GET /categories` / `GET /setting-fields` same pattern: 1 / 902 and 2 / 3910.
- `GET /setting-fields/by-type/webapp.branding` → 404; `GET /setting-fields/by-type/theme-settigns` → 200.
- `theme-engine/{schema,values,tokens}` endpoints unaffected (they query Prisma directly, never through the generic type/category/field services).
- Backend suite: **698/698 pass**, 59 files, 0 regressions.

**Not verified — needs QA (Maker ≠ Grader), targets localhost:3001:** the `kdl-starter-kit-*` containers serving :3001/:4000 are built-from-source images (no bind mount), so this branch's code isn't live there yet. Per the KDL-178 precedent above, QA must rebuild `backend`+`frontend` images from this PR's merged commit, `prisma migrate deploy` + re-run `theme-engine` seed (idempotent) against that stack's DB, then run the full gate: sidebar shows exactly one "Theme Engine" item, zero `settings/view/{webapp.*|tv.*|android.*|ios.*}` entries, open it → 4 platform options (Web App/TV/Android Native/iOS Native), switch platform swaps pane sidebar, edit a Web App button color + Save → `GET /tokens` reflects it.

**Next:** PR opened, awaiting Code Reviewer + QA browser E2E gate on rebuilt :3001 stack.

## 2026-07-13 — KDL-178 C2 review + E2E gate: PASS — Theme Engine module (KDL-174) COMPLETE (Code Reviewer)

- **Module 15 Theme Engine is done and fully on master.** Backend fixes merged as `df6797c` (KDL-191, B1–B12); frontend admin UI merged as `195aaaa` (`feature/kdl-177-theme-engine-ui` @ `785453b`, KDL-177 + F1–F8 fixes). Both branches reviewed independently (maker ≠ grader) before merge.
- **Final E2E gate re-run on the :3001/:4000 docker gate stack rebuilt from merged code** (backend image from master `df6797c`, frontend from `785453b`; freshness verified inside containers — `uninstall.js` present, theme-engine catalogue 86 types / 902 categories / 3910 fields seeded, module ENABLED). Playwright `kdl-178-theme-engine.e2e.spec.ts`: **2/2 passed, exit 0**.
  - Gate 1: UI edit of `webapp.buttons.dark.primary_button.background_color` → Save → `GET /tokens?platform=webapp&theme=dark` reflects the new value in JSON + CSS (both `format=css` and body `css`), then restored and cache invalidation confirmed.
  - Gate 2: disable → API gated 404 → re-enable → schema 200 with 11 webapp panes; row counts identical before/after; LEFT JOIN orphan checks 0/0/0/0 across categories/fields(×2)/values; tokens still compile.
- Prior gate-1 PASS against backend `c9b73d3` was treated as invalidated (B3/B12 changed the `/tokens` contract) and re-run — per the re-run-all-gates rule.
- **Next:** nothing open on Module 15. KDL-174/175/176/177/178/191 all closed.

## 2026-07-13 — KDL-191 KDL-178 review fixes: install seed, uninstall cleanup, token spec (Backend Architect)

- Branch `fix/kdl-191-theme-engine-review` @ `797bd5c`, awaiting Code Reviewer merge. Do not touch Phase C frontend branch.
- **Install hooks contract changed** (`modules/service.js`): a module `seed.js` MUST export its seed as `default` (or a `seed*`-named export) and accept a Prisma client param — it now receives the install transaction client. Install/uninstall transactions run with `{timeout:180_000, maxWait:10_000}`. Optional `uninstall.js` (default export, receives tx client) removes module data from shared tables; theme-engine's is the reference implementation.
- **Token contract now matches THEME_ENGINE_ARCH.md** (decision TE-001/TE-002 in DECISIONS.md): theme-neutral var names, `[data-theme="light|focus"]` override blocks, nested JSON `{pane:{group:{field:value}}}` (group keeps device tag, drops theme tag); unfiltered JSON mirrors `:root` = dark default. Password fields never compiled into tokens. `tokens_public=false` requires `theme-engine:view` even when authenticated. Cross-platform `?device=` rejected 422.
- **Gate**: `backend/scripts/kdl191-gate.mjs` (fresh DB + `migrate deploy`, then run with DATABASE_URL/REDIS_URL) — 18/18 PASS exit 0. Full vitest 698/698. Note: run `npx prisma generate` if client is stale; `npm install` was needed for pre-existing missing `@zxing/library`.

## 2026-07-13 — KDL-176 Theme Engine Phase B: values API + token resolver (Backend Coder)

- **B1** `routes.js` created for the `theme-engine` module — the missing piece that lets `module-loader.js` mount the module at `/api/theme-engine`. Route chain: `moduleGate('theme-engine')` (applied by loader at mount) → `authenticate` → `requirePermission('theme-engine', <action>)` → `validate(Zod schema)` → controller. `GET /tokens` uses `optionalAuthenticate` instead (public-readable path); the controller enforces the `theme_engine.tokens_public` app_setting flag for unauthenticated callers.
- **B2** `service.js`: `validateFieldValue` (color hex/rgba, number, slider min/max, select/radio enum, toggle boolean, multiselect JSON array, any-string for text/textarea/password/file/fonts/imglist); `upsertValues` (load pane fields, validate each entry, reject unknown field_id/slug with errors array, transaction upsert into `setting_values`, invalidate Redis token cache); `resetValues` (delete `setting_values` for pane, invalidate cache). Controller maps errors→422. Activity logged fire-and-forget on every mutation.
- **B3** `service.compileTokens`: loads all fields for platform, applies saved-value override over default, filters by theme/device segment in slug, emits CSS custom properties in `:root{…}`, `@import`/`@font-face` for `fonts` fields, `.{class}{…}` rules for `imglist` fields. JSON tree `{pane:{tokenKey:value}}` alongside. Redis cache key `te:tokens:{platform}:{theme}` TTL 600s, write-through on compile, invalidated on every save/reset. `GET /tokens?format=css` or `Accept: text/css` returns raw CSS with `Content-Type: text/css`.
- **Gates (exit codes, not self-assessed)**: `vitest run src/modules/theme-engine/` → 0. **44/44 tests pass** across 3 test files: 8 Phase A schema tests, 3 seed tests, 33 Phase B api tests (B1 route structure + schema tree shape; B2 validateFieldValue across all input types, upsertValues valid+invalid+unknown, resetValues; B3 compileTokens CSS output, dark+light both present, changed field reflects saved value, Redis cache TTL 600s, fonts/@import, imglist CSS classes; controller getTokens JSON vs CSS, public flag enforcement).
- **Files created**: `backend/src/modules/theme-engine/routes.js`, `backend/src/modules/theme-engine/api.test.js`.
- **Files pre-existing from prior run (Phase A output — complete, no changes needed)**: `controller.js`, `service.js`, `schema.js`, `module.json`, `schema/index.js`, `seed.js`, `schema.test.js`, `seed.test.js`.

## 2026-07-13 — KDL-175 Theme Engine Phase A: schema + Prisma model + seed (Backend Architect)
- **A1** `SettingValue` model + `SettingField.setting_values` back-relation in `backend/prisma/schema/core.prisma` (`setting_values` table: `field_id` unique FK→setting_fields cascade, denormalized `platform` indexed, string `value`, `updated_by`). Migration `20260713052617_theme_engine_setting_values` applied clean. Existing `settings`/`app_settings` module untouched — diff is exactly the new model + back-relation.
- **A2** Verbatim port of the `theme-engine.html` prototype (`~/Downloads/theme-engine.html` — issue said committed on master but it is NOT in the repo; `.agents/THEME_ENGINE_ARCH.md` was also untracked and is committed with this work) into `backend/src/modules/theme-engine/schema/index.js` as ESM: BASE_TABS / PANE_OVERRIDES / EXTRA_TABS / PLATFORMS, C/N/SL/SE/TG/TX/PW/RA/MS/FI/TA constructors, `slug()`, `scaleField()`, build loop producing `PLAT_TABS`.
- **A3** `seed.js`: schema-driven idempotent upsert-on-slug over Type (pane) / Category (section, theme/device tag in slug) / SettingField (field). TV px scaling applied by the schema build loop before write. Slug collision inside a build = throw, never overwrite.
- **Gates (exit codes, not self-assessed)**: `npx prisma validate` → 0; `npx prisma migrate dev` clean → 0; `vitest run src/modules/theme-engine/` → 0 (11/11: 4 platforms build, pane counts webapp 11 / tv 37 / android 20 / ios 18, TV 720p/4K/8K px scaling x1/x3/x6, constructor→input_type/options/value encodings, seed idempotency vs unique-slug fake prisma). Real seed against dev DB ran twice: run1 `86 types / 902 categories / 3910 fields created`, run2 `0 created / 0 updated`; SQL dupe check 0; spot-check row present.
- **Spec deviation (verbatim port wins)**: the arch doc's example slug `webapp.buttons.desktop.primary_button.background_color` does not exist — in the prototype, Primary Button is theme-tagged (dark/light), not device-tagged. Real slugs: `webapp.buttons.dark.primary_button.background_color` = `#4f8ef7`, `...light...` = `#0a66f0`. Asserted explicitly in both test files.
- **Env note**: root `.env` now points `DATABASE_URL` at port **5443** (`kdl-dev-local-postgres-1`), not the old 5433 container. That DB had a full schema but no `_prisma_migrations` table (created via db push/dump) — `migrate dev` demanded a destructive reset. Repaired by baselining all 21 prior migrations with `prisma migrate resolve --applied`, then applying only the new one. No data lost.
- Work committed on branch `feature/kdl-175-theme-engine-phase-a` (not merged to master — reviewer merges). Next: Phase B per KDL-174.

## 2026-07-09 — KDL-122 Media DAM Phase D6: AI image ops (CEO/AI Services)
- Found `ai/image-ops.service.js` (`runImageOpJob`) and the `replicate` driver already sitting uncommitted in the tree from an earlier interrupted session — the D1 driver registry (`ops: bg-removal/upscale/enhance/object-removal`) and the `ai-image-op` processing-job case were already wired, just never exposed over HTTP and never tested.
- Added the missing layer: `aiImageOpSchema` (schema.js), `aiImageOp` controller (enqueues `ai-image-op` job with `{op, scale, mask, note, createdBy}`), route `POST /:id/ai-image-op` gated by `requireFeature('image_ops')` (501 when no `replicate` provider configured) + `requirePermission('media','edit')`.
- New gate: `backend/tests/media/ai-image-ops.test.js` (8 vitest, mocked driver) — unsupported-op→422 before touching the provider, unconfigured→501, non-image→422, object-removal-without-mask→422, success path (bg-removal) asserts driver input shape + `createMediaVersion` call + result shape, scale/mask passthrough, download-failure→error. Full backend suite 570/570 (was 562), only the pre-existing unrelated `auth.controller.test.js` DATABASE_URL failure remains.
- Frontend: `AiImageOpsPanel` in the media detail drawer (`admin/media/page.tsx`) — Remove background / Upscale 2x / Enhance buttons, shown only when `/media/ai/status` reports `image_ops.configured`. `object-removal` is NOT exposed in the UI — it needs a mask-drawing tool in the editor that wasn't built (mask is accepted backend-side as a URL to a pre-uploaded mask image); see `.agents/DECISIONS.md` MEDIA-005. RTL regression suites (MediaPage/MediaPhaseB/MediaPicker, 27/27) still pass; `tsc --noEmit` clean except one pre-existing unrelated failure (`IntegrationsPage.test.tsx` imports a non-existent page — not Phase D).
- Both frontend (pnpm) and backend (npm) `node_modules` were missing in this workspace checkout — installed both (`pnpm install --frozen-lockfile`, `npm ci`) to run the gates; not a code change.
- Next: D7 (recognition/QR — optional, default OFF) → D8 (cloud imports) → D9 (consolidated E2E + docs). Prior run failed on an org monthly Claude spend cap (unrelated to the code); this run's tool calls worked fine.

## 2026-07-09 — KDL-119 Media DAM Phase A: A9 review + E2E — PHASE A COMPLETE ✅ (Backend Architect)
- **Phase gate PASS: adversarial review + Playwright exit 0.** Phase B (KDL-120) is unblocked.
- Adversarial review (feature-dev:code-reviewer over A1–A8) surfaced 3 real defects, all fixed in commit `b4aa86b`:
  - **CRITICAL** `svg-sanitizer.js`: literal-substring scheme check bypassable via XML numeric entities (`&#106;avascript:`) + in-scheme whitespace/tabs. Now entity-decodes + strips control/whitespace before the scheme test; non-raster `data:` URIs (e.g. `data:image/svg+xml`) treated as dangerous. 4 bypass regression tests added.
  - **HIGH** tag/meta denorm drift: `renameTag`/`deleteTag`/`updateMetaField`(slug)/`deleteMetaField` never reindexed the media carrying them → Meili served stale tag names/meta forever. Now enqueue reindex for all affected media (collected before the delete cascade). 4 tests added.
  - **MEDIUM** url-import SSRF DNS-rebinding TOCTOU: guard validated one resolved IP, `fetch` re-resolved independently. `importFromUrl` now pins the connection to the validated IP via a custom `lookup` over node http/https (Host/SNI keep the hostname); test-only `fetchImpl` path preserved.
- **Frontend A8 was rewritten to the real backend contract** (the earlier pass, commit 59f16ce, assumed wrong shapes): search returns `{hits,facets,pagination}` not `{media}`; media rows carry `tags:string[]` + `meta:{slug:value}` (flattened pivots); tag/untag are bulk-by-name (`POST /media/tag|untag {media_ids,tags}`); chunked routes are `PUT /media/upload/chunked/:id/part?index=` with init taking `{filename,size,mime_type,total_parts}` and status returning `received_parts[]`; recents route is `/media/recent` (singular). Search hits are flat Meili docs (no url/variants) → grid maps to stubs, clicking fetches the full row via `GET /media/:id`. `media.types.ts` + `DamExtensions.tsx` + `page.tsx` + RTL all realigned; tsc 0, 80/80 RTL.
- **A9 E2E** `frontend/e2e/media-dam.spec.ts` — 5/5, Playwright exit 0, run against the live docker stack: 60MB chunked upload with interrupt+resume (status shows partial, early-complete 422, resume completes), zip import (2 entries incl. nested, 0 skipped), tag+custom-meta MeiliSearch hit (free-text on meta value + tag facet filter), smart-collection live rule eval, and **EICAR→quarantine verified against a real clamd** (soft-delete).
- **Infra fixes** (commit `b4aa86b`+`8b337b1`): compose `MEILISEARCH_HOST=http://meilisearch:7700` override (root `.env` points it at localhost, which broke search inside the container → 500); clamav image `1.3`→`1.4_base-debian` (`1.3` removed upstream, `1.4_base` amd64-only; debian base is multi-arch + DB baked in, ~20s ready on arm64, no freshclam download). To scan for real: `CLAMAV_HOST=clamav docker compose --profile scan up -d clamav backend`.
- Backend suite 500/502 — the 2 failures remain the uncommitted D5 openai-embeddings driver (5th driver breaks the "4 v1 drivers" count) + its ai-provider test; NOT Phase A, still owned by the D5 agent.
- Commits: `59f16ce` A8, `dbfb121` A8 docs, `b4aa86b` A9 review fixes + frontend realign, `8b337b1` A9 E2E + clamav tag.


---
*Older entries archived in [HANDOFF_ARCHIVE.md](HANDOFF_ARCHIVE.md) to reduce session-load tokens.*
