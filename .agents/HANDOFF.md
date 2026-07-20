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

**"Links also broke" finding:** No routing/href regressions exist. All sidebar hrefs resolve to existing Next.js page routes. The reporter's "links" referred to the broken presigned media URLs, not navigation hrefs (confirmed by prior KDL-410 investigation: "No actual link routing bugs found").

**Verified:** `pnpm type-check → 0 errors`.

**⚠️ Correction (KDL-414):** The original claim that "restart picks up the env var without rebuild" was false. `NEXT_PUBLIC_IMAGE_HOSTS` is baked at `pnpm build` time into the standalone bundle; a container restart has no effect. A `docker compose build frontend` is always required when changing this value. The Dockerfile and compose file were reworked in KDL-414 to pass the value as a proper build arg.

**Next:** PR against master; request Code Reviewer gate.

## 2026-07-18 — KDL-410 Frontend design/link regressions from PR #75 dep bump (Frontend Coder)

**Scope:** Fix broken dark-mode toggle and icon typo introduced by PR #75 dep bump (next-themes 0.3→0.4, lucide-react 0.460→0.577). Commit `aeffa8b`, branch `fix/kdl-406-admin-css`.

**Root causes found:**
1. **Dark-mode toggle broken**: `CommandPalette` read `theme`/`setTheme` from `useUiStore` (Zustand, persists to `localStorage['kdl-ui']`), which never synced with next-themes' `ThemeProvider` (reads/writes `localStorage['theme']`). Clicking "Toggle theme" updated Zustand state but applied no class change to `<html>`. Fix: import `useTheme` from `next-themes` directly; remove redundant `theme`/`setTheme` from `ui.store.ts`.
2. **SendHorizonal typo**: `integrations/page.tsx` imported misspelled `SendHorizonal` instead of `SendHorizontal`. Currently aliased in lucide-react 0.577, but a deprecated no-op in future versions.

**Verified:**
- `pnpm type-check` → 0 errors
- `pnpm build` → green
- Light-mode screenshot: login page renders correctly
- Dark-mode screenshot (localStorage theme=dark): full dark theme applied correctly

**Auth pages and admin links**: all use standard Next.js `<Link href="...">` patterns with suppressHydrationWarning on html. No actual link routing bugs found beyond the theme toggle UX disconnect.

**Next:** PR with these 3-file change set. KDL-410 → done.

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

**Bug:** post-KDL-174/175/176/177/178/191, the Template Engine's 86 seeded panes (Types) all auto-promoted to top-level `AdminSidebar` menu items (`typeLeaves` from unfiltered `GET /types?is_active=true`), flooding "Application Settings" with every `webapp.*|tv.*|android.*|ios.*` pane. Root cause: no way to mark a Type/Category/SettingField as module-private data vs a standalone Application-Settings entry.

**Fix — general ownership contract (also future-proofs modules 9-14 reusing these tables):**
1. `owner_module String? @@index` added to `Type`, `Category`, `SettingField` in `core.prisma`; migration `20260714035014_add_owner_module_to_settings_tables`.
2. `template-engine/seed.js` stamps `owner_module: 'template-engine'` on every Type/Category/SettingField it upserts (idempotent — verified via direct re-run against the dev DB: 0 created, 3910 updated on first pass after migration, all rows backfilled).
3. `types|categories|setting-fields` `service.js`: `listX` defaults `where.owner_module = null` unless an explicit `?ownerModule=` query param is passed (added to each `schema.js`). This alone fixes the sidebar.
4. `setting-fields/service.js` `getTypeBySlug` (used only by the generic `/admin/settings/view/[slug]` → `GET /setting-fields/by-type/:slug`) now filters `owner_module: null` too, so a module-owned slug can't be reached by direct URL either — verified `webapp.branding` → 404, standalone type → 200.
5. `frontend/.../template-engine/page.tsx` platform switcher relabeled Android → "Android Native", iOS → "iOS Native" (ids unchanged); Web App/TV already matched.

**Verified live** against the dev-local Postgres (`localhost:5433/kdl_db`, isolated `npm ci` + `prisma generate` in a scratch worktree, backend started on a scratch port `4099`, real login as `admin@kdl.com`):
- `GET /types` (no param): **total 1** (was 87) — only the standalone "Theme Settigns" type; `?ownerModule=template-engine` → 86.
- `GET /categories` / `GET /setting-fields` same pattern: 1 / 902 and 2 / 3910.
- `GET /setting-fields/by-type/webapp.branding` → 404; `GET /setting-fields/by-type/theme-settigns` → 200.
- `template-engine/{schema,values,tokens}` endpoints unaffected (they query Prisma directly, never through the generic type/category/field services).
- Backend suite: **698/698 pass**, 59 files, 0 regressions.

**Not verified — needs QA (Maker ≠ Grader), targets localhost:3001:** the `kdl-starter-kit-*` containers serving :3001/:4000 are built-from-source images (no bind mount), so this branch's code isn't live there yet. Per the KDL-178 precedent above, QA must rebuild `backend`+`frontend` images from this PR's merged commit, `prisma migrate deploy` + re-run `template-engine` seed (idempotent) against that stack's DB, then run the full gate: sidebar shows exactly one "Template Engine" item, zero `settings/view/{webapp.*|tv.*|android.*|ios.*}` entries, open it → 4 platform options (Web App/TV/Android Native/iOS Native), switch platform swaps pane sidebar, edit a Web App button color + Save → `GET /tokens` reflects it.

**Next:** PR opened, awaiting Code Reviewer + QA browser E2E gate on rebuilt :3001 stack.

## 2026-07-13 — KDL-178 C2 review + E2E gate: PASS — Template Engine module (KDL-174) COMPLETE (Code Reviewer)

- **Module 15 Template Engine is done and fully on master.** Backend fixes merged as `df6797c` (KDL-191, B1–B12); frontend admin UI merged as `195aaaa` (`feature/kdl-177-template-engine-ui` @ `785453b`, KDL-177 + F1–F8 fixes). Both branches reviewed independently (maker ≠ grader) before merge.
- **Final E2E gate re-run on the :3001/:4000 docker gate stack rebuilt from merged code** (backend image from master `df6797c`, frontend from `785453b`; freshness verified inside containers — `uninstall.js` present, template-engine catalogue 86 types / 902 categories / 3910 fields seeded, module ENABLED). Playwright `kdl-178-template-engine.e2e.spec.ts`: **2/2 passed, exit 0**.
  - Gate 1: UI edit of `webapp.buttons.dark.primary_button.background_color` → Save → `GET /tokens?platform=webapp&theme=dark` reflects the new value in JSON + CSS (both `format=css` and body `css`), then restored and cache invalidation confirmed.
  - Gate 2: disable → API gated 404 → re-enable → schema 200 with 11 webapp panes; row counts identical before/after; LEFT JOIN orphan checks 0/0/0/0 across categories/fields(×2)/values; tokens still compile.
- Prior gate-1 PASS against backend `c9b73d3` was treated as invalidated (B3/B12 changed the `/tokens` contract) and re-run — per the re-run-all-gates rule.
- **Next:** nothing open on Module 15. KDL-174/175/176/177/178/191 all closed.

## 2026-07-13 — KDL-191 KDL-178 review fixes: install seed, uninstall cleanup, token spec (Backend Architect)

- Branch `fix/kdl-191-template-engine-review` @ `797bd5c`, awaiting Code Reviewer merge. Do not touch Phase C frontend branch.
- **Install hooks contract changed** (`modules/service.js`): a module `seed.js` MUST export its seed as `default` (or a `seed*`-named export) and accept a Prisma client param — it now receives the install transaction client. Install/uninstall transactions run with `{timeout:180_000, maxWait:10_000}`. Optional `uninstall.js` (default export, receives tx client) removes module data from shared tables; template-engine's is the reference implementation.
- **Token contract now matches TEMPLATE_ENGINE_ARCH.md** (decision TE-001/TE-002 in DECISIONS.md): theme-neutral var names, `[data-theme="light|focus"]` override blocks, nested JSON `{pane:{group:{field:value}}}` (group keeps device tag, drops theme tag); unfiltered JSON mirrors `:root` = dark default. Password fields never compiled into tokens. `tokens_public=false` requires `template-engine:view` even when authenticated. Cross-platform `?device=` rejected 422.
- **Gate**: `backend/scripts/kdl191-gate.mjs` (fresh DB + `migrate deploy`, then run with DATABASE_URL/REDIS_URL) — 18/18 PASS exit 0. Full vitest 698/698. Note: run `npx prisma generate` if client is stale; `npm install` was needed for pre-existing missing `@zxing/library`.

## 2026-07-13 — KDL-176 Template Engine Phase B: values API + token resolver (Backend Coder)

- **B1** `routes.js` created for the `template-engine` module — the missing piece that lets `module-loader.js` mount the module at `/api/template-engine`. Route chain: `moduleGate('template-engine')` (applied by loader at mount) → `authenticate` → `requirePermission('template-engine', <action>)` → `validate(Zod schema)` → controller. `GET /tokens` uses `optionalAuthenticate` instead (public-readable path); the controller enforces the `template_engine.tokens_public` app_setting flag for unauthenticated callers.
- **B2** `service.js`: `validateFieldValue` (color hex/rgba, number, slider min/max, select/radio enum, toggle boolean, multiselect JSON array, any-string for text/textarea/password/file/fonts/imglist); `upsertValues` (load pane fields, validate each entry, reject unknown field_id/slug with errors array, transaction upsert into `setting_values`, invalidate Redis token cache); `resetValues` (delete `setting_values` for pane, invalidate cache). Controller maps errors→422. Activity logged fire-and-forget on every mutation.
- **B3** `service.compileTokens`: loads all fields for platform, applies saved-value override over default, filters by theme/device segment in slug, emits CSS custom properties in `:root{…}`, `@import`/`@font-face` for `fonts` fields, `.{class}{…}` rules for `imglist` fields. JSON tree `{pane:{tokenKey:value}}` alongside. Redis cache key `te:tokens:{platform}:{theme}` TTL 600s, write-through on compile, invalidated on every save/reset. `GET /tokens?format=css` or `Accept: text/css` returns raw CSS with `Content-Type: text/css`.
- **Gates (exit codes, not self-assessed)**: `vitest run src/modules/template-engine/` → 0. **44/44 tests pass** across 3 test files: 8 Phase A schema tests, 3 seed tests, 33 Phase B api tests (B1 route structure + schema tree shape; B2 validateFieldValue across all input types, upsertValues valid+invalid+unknown, resetValues; B3 compileTokens CSS output, dark+light both present, changed field reflects saved value, Redis cache TTL 600s, fonts/@import, imglist CSS classes; controller getTokens JSON vs CSS, public flag enforcement).
- **Files created**: `backend/src/modules/template-engine/routes.js`, `backend/src/modules/template-engine/api.test.js`.
- **Files pre-existing from prior run (Phase A output — complete, no changes needed)**: `controller.js`, `service.js`, `schema.js`, `module.json`, `schema/index.js`, `seed.js`, `schema.test.js`, `seed.test.js`.

## 2026-07-13 — KDL-175 Template Engine Phase A: schema + Prisma model + seed (Backend Architect)
- **A1** `SettingValue` model + `SettingField.setting_values` back-relation in `backend/prisma/schema/core.prisma` (`setting_values` table: `field_id` unique FK→setting_fields cascade, denormalized `platform` indexed, string `value`, `updated_by`). Migration `20260713052617_template_engine_setting_values` applied clean. Existing `settings`/`app_settings` module untouched — diff is exactly the new model + back-relation.
- **A2** Verbatim port of the `template-engine.html` prototype (`~/Downloads/template-engine.html` — issue said committed on master but it is NOT in the repo; `.agents/TEMPLATE_ENGINE_ARCH.md` was also untracked and is committed with this work) into `backend/src/modules/template-engine/schema/index.js` as ESM: BASE_TABS / PANE_OVERRIDES / EXTRA_TABS / PLATFORMS, C/N/SL/SE/TG/TX/PW/RA/MS/FI/TA constructors, `slug()`, `scaleField()`, build loop producing `PLAT_TABS`.
- **A3** `seed.js`: schema-driven idempotent upsert-on-slug over Type (pane) / Category (section, theme/device tag in slug) / SettingField (field). TV px scaling applied by the schema build loop before write. Slug collision inside a build = throw, never overwrite.
- **Gates (exit codes, not self-assessed)**: `npx prisma validate` → 0; `npx prisma migrate dev` clean → 0; `vitest run src/modules/template-engine/` → 0 (11/11: 4 platforms build, pane counts webapp 11 / tv 37 / android 20 / ios 18, TV 720p/4K/8K px scaling x1/x3/x6, constructor→input_type/options/value encodings, seed idempotency vs unique-slug fake prisma). Real seed against dev DB ran twice: run1 `86 types / 902 categories / 3910 fields created`, run2 `0 created / 0 updated`; SQL dupe check 0; spot-check row present.
- **Spec deviation (verbatim port wins)**: the arch doc's example slug `webapp.buttons.desktop.primary_button.background_color` does not exist — in the prototype, Primary Button is theme-tagged (dark/light), not device-tagged. Real slugs: `webapp.buttons.dark.primary_button.background_color` = `#4f8ef7`, `...light...` = `#0a66f0`. Asserted explicitly in both test files.
- **Env note**: root `.env` now points `DATABASE_URL` at port **5443** (`kdl-dev-local-postgres-1`), not the old 5433 container. That DB had a full schema but no `_prisma_migrations` table (created via db push/dump) — `migrate dev` demanded a destructive reset. Repaired by baselining all 21 prior migrations with `prisma migrate resolve --applied`, then applying only the new one. No data lost.
- Work committed on branch `feature/kdl-175-template-engine-phase-a` (not merged to master — reviewer merges). Next: Phase B per KDL-174.

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
