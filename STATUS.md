<!-- ROLLING WINDOW: keep only the most recent entries here to minimise per-run context.
     Prepend new entries at the top; move anything older into .agents/STATUS_ARCHIVE.md.
     Full history: .agents/STATUS_ARCHIVE.md (and git log). -->

## 2026-08-17 — KDL-446 PRODUCT_MODES_ARCH Phase 0: browser/runtime gate PASS + PR #154 MERGED to master (CEO)

PR #154 (`kdl-446-product-modes-arch`) **MERGED** (squash, master `613b0fd`). Phase 0 platform layer is live on master: `conflictsWith` module gate, `locked_by` setting-field gate, `builder_pages` persistence, template-engine stub, page-builder-ui / theme-engine-ui toggleable nav modules.

**Runtime gate (KDL-458) — 4/4 PASS, verified server/DB-authoritative on a stack built from the branch (backend `:4100`, admin@kdl.com):**
1. **Engine survives mode switch** — enabled `template-engine`; `GET /api/theme-engine/tokens?platform=webapp` → 200 (CSS returned) while UI/nav gated. Engine layer runs with nav hidden (API not unmounted).
2. **Authoritative 409 gate** — `POST /api/theme-engine/values` on a `locked_by:template-engine` field → **409** "Settings are read-only: locked by module template-engine" (server-side, not just UI). `conflictsWith` also enforced server-side: installing/enabling `theme-engine-ui` while `template-engine` ON → **409** (so its nav cannot mount = entries disappear).
3. **Non-destructive switch** — disabled `template-engine`; same write → **200 saved:1**, `theme-engine-ui` installable again (201), prior value intact. Full editability + values restored, nothing destroyed.
4. **Puck persistence across full container restart** — created a `builder_pages` page, `docker restart kdl-starter-kit-backend-1`, re-fetched → identical content (200). Real DB persistence, not localStorage.

Test artifacts cleaned up (page deleted, template-engine uninstalled, locked_by reset).
Minor follow-up noted: module uninstall guard rejects an INSTALLED-but-never-ENABLED module ("must be DISABLED"), leaving it un-uninstallable — low-priority lifecycle-state bug.

---

## 2026-08-17 — KDL-437 Theme Engine rename: integration + browser gate + PR open, in_review (QA / Test Engineer)

Branch `feat/kdl-437-theme-engine-rename` merges all three phases (A/B/C) against master. PR open for CEO/board review. DO NOT admin-merge — CI is billing-blocked org-wide (KDL-416).

**Gate summary:**
- Browser gate 5/5 PASS: sidebar "Theme Engine", /admin/theme-engine loads, not flooded, API routes renamed, RBAC accessible
- Grep gate PASS: zero live code/config matches for `template.?engine`
- API: `/api/template-engine/tokens` → 404; `/api/theme-engine/tokens` → 200
- Migration applied: modules/permissions/owner_module/app_settings all renamed (expected counts 86/902/3910)

**Reserved:** `template-engine` slug is now RESERVED (see .agents/DECISIONS.md D3). Future page/content template module must NOT use this slug.

**Module registry updated:** slug `template-engine` → `theme-engine`. Re-sync kdl-module-tracker artifact.

---

## 2026-07-17 — KDL-353 E1 Ink & Dawn palette + typography defaults seeded, PR #91 open (Backend Coder)
- `theme-engine/schema/index.js`: Primary Ink palette, Highlight Dawn field, H1–H3 `'Poppins, Sora'` fallback all 4 devices.
- PR #91 → master. Awaiting Code Reviewer.

## 2026-07-17 — KDL-349 Ink & Dawn palette seeded, PR #89 open (Backend Coder)
- `theme-engine/schema/index.js` Brand Colors: primary `#7468F3`/`#2119B3`, accent `#F7B23B`/`#F9941F` (dark/light).
- PR #89 against master. Awaiting CI + Code Reviewer.

## 2026-07-17 — KDL-275 security hardening PR #55 open (Security & Compliance Engineer)
- Closed KDL-270 findings M5-M8, M10, M11, M14, L13, L14, L16, L17: CORS fail-fast allowlists (backend + ai-services), CSRF origin check on cookie auth, 500-masking outside development, generic errors from ai controllers, `${VAR:?}` compose creds + 127.0.0.1 port binds + Redis requirepass, SSE single-use Redis ticket auth (JWT out of query string, HS256 pinned), Zod strict validation on all notifications mutating routes, scoped 10mb transcribe limit, Meili scoped-admin-key docs, S3 error taxonomy.
- Verified: backend targeted suites 29/29, ai-services 21/21, all compose files validate, fail-fast confirmed.
- M9/L15 (`/share/:token`) intentionally untouched — deferred to PR #46.
- Next: Code Reviewer gate on PR #55; DevOps must populate new required `.env` vars before pulling to staging.


## 2026-07-14 — KDL-192 owner_module ownership contract fixes sidebar pollution (CEO agent)
- Post-KDL-174 QA found all 86 Theme Engine Types flooding the "Application Settings" sidebar. Root cause: `AdminSidebar` promotes every active `Type` to a top-level nav item with no owner concept.
- Added `owner_module` (nullable, indexed) to `Type`/`Category`/`SettingField`; `theme-engine/seed.js` stamps `'theme-engine'` on all its rows; `types|categories|setting-fields` list endpoints default to `owner_module=null` (opt out via `?ownerModule=`); generic `by-type/:slug` view also excludes module-owned rows.
- **Verified live** on dev-local DB (localhost:5433): `GET /types` total 87→1 (only the standalone type), `?ownerModule=theme-engine` → 86; same pattern for categories (902) and fields (3910); `by-type/webapp.branding` → 404, standalone slug → 200. Backend suite 698/698 pass, 0 regressions. Frontend platform switcher relabeled Android/iOS → Android Native/iOS Native.
- **Not verified**: browser E2E gate at localhost:3001 — that stack's containers are image-built (no bind mount), need rebuild from this PR's merged commit + reseed. Handed to QA per KDL-178 precedent.

## 2026-07-13 — KDL-178 C2 gate PASS → KDL-174 Theme Engine module DONE (Code Reviewer)
- Independent review of Phases A/B/C complete; all findings (B1–B12 backend, F1–F8 frontend) fixed by their authors and re-verified. Backend merged `df6797c`, frontend merged `195aaaa`. Master now carries the whole module.
- **E2E gate (exit 0, 2/2)** on gate stack rebuilt from merged code: (1) admin-UI button-color edit → `/tokens` JSON+CSS reflect it → restored; (2) disable→re-enable round-trip leaves zero orphaned Types/Categories/SettingFields/SettingValues, tokens still compile.
- Module 15 closed: [KDL-174] done, all phase + review issues done.

## 2026-07-13 — KDL-191 Theme Engine review fixes (KDL-178 findings B1–B12) — DONE, handed to Code Reviewer (Backend Architect)
- **All 12 findings fixed** on branch `fix/kdl-191-theme-engine-review` (commit `797bd5c`, off master c9b73d3). B1 blocker: `installModule` ran the wrong seed export (namespace-order pick hit `buildSeedRows`) — now resolves `default`/`seed*` export and runs it on the install tx (180s timeout). B2: new per-module `uninstall.js` hook; theme-engine's removes Types+Categories by platform prefix (`Category.type_id` is SetNull — explicit delete required) + tokens_public setting.
- **B3/B12 to spec (decision TE-001)**: theme-neutral CSS vars, dark+untagged in `:root`, light/focus in `[data-theme]` blocks; JSON nested `{pane:{group:{field}}}` mirroring :root. Minors B4–B11 all fixed (tokens permission when non-public, device/platform pairing, password exclusion, seed tx, getValues guard, authored group order, dup slugs fail loud, strict color regex).
- **Gates (exit codes)**: `scripts/kdl191-gate.mjs` on fresh DB — install seeds 86/902/3910 via hook alone, enable→disable→uninstall leaves 0 rows, reinstall clean, exit 0. Backend vitest 698/698 exit 0.

## 2026-07-13 — KDL-175 Theme Engine Phase A: schema + Prisma model + seed — DONE, in review (Backend Architect)
- **Gate PASS (exit codes)**: `prisma validate` 0; `migrate dev` clean (migration `20260713052617_theme_engine_setting_values`); theme-engine vitest 11/11 exit 0 — 4 platforms build, pane counts webapp 11 / tv 37 / android 20 / ios 18, TV px scaling x1/x3/x6, seed idempotency. Real seed vs dev DB: run1 86 types / 902 categories / 3910 fields, run2 0 created / 0 updated, SQL dupe count 0.
- New: `SettingValue` model (`setting_values`, field_id unique FK cascade) + verbatim ESM port of theme-engine.html prototype into `backend/src/modules/theme-engine/schema/` + idempotent upsert-on-slug `seed.js`. `settings`/`app_settings` module untouched.
- Deviation: arch-doc example slug `webapp.buttons.desktop.primary_button.background_color` doesn't exist in the prototype — Primary Button is theme-tagged; real row `webapp.buttons.dark.primary_button.background_color` = `#4f8ef7`. Tests assert this.
- Env repair: `.env` now targets postgres on 5443 (`kdl-dev-local`) which lacked `_prisma_migrations` — baselined 21 prior migrations via `migrate resolve --applied` instead of destructive reset.
- Branch `feature/kdl-175-theme-engine-phase-a`, not merged — Code Reviewer to review/merge.

## 2026-07-09 — KDL-134 Media DAM Phase D8: Cloud imports + capture widgets — DONE ✅ (Backend Architect)
- **D8 complete, gate PASS**: `tests/media/cloud-import.test.js` 32/32; full `tests/media` 309/309 (26 files) no regressions; frontend RTL 118/118 (21 new: CloudImportDialog 10 + CaptureWidgets 11); `tsc --noEmit` 0.
- Backend `media/cloud-import/`: 5 drivers (gdrive/dropbox/onedrive/s3/ftp) on one shared contract — `list(creds,{path,cursor}) → {entries,cursor}` / `download(creds,id) → {buffer,name,mime,size}`, `deps.fetchImpl`/`deps.clientFactory` injectable. OAuth per user (state = 10-min JWT bound to user+provider, CSRF-proof; refresh-on-401-retry-once, per download so mid-batch expiry can't duplicate uploads). Credentials (tokens or S3/FTP creds) encrypted via shared `crypto.js` aes-256-gcm into new `MediaImportConnection` (migration `20260709063848`, applied); never selected back out.
- Imports funnel through the normal `uploadMedia` → scan/reindex/embed hooks all fire; MIME from provider or `EXT_TO_MIME` fallback, gated by upload settings (allowed MIMEs + max size); per-file skip reasons returned. Routes `/media/import/*`, all `requirePermission('media','add')` + zod.
- OAuth providers report `configured:false` until `GDRIVE|DROPBOX|ONEDRIVE_CLIENT_ID/_SECRET` land in env — UI disables connect with a hint; s3/ftp always available.
- Frontend: `CloudImportDialog` (connections + OAuth popup→`postMessage` callback page at `/admin/media/import/callback` + S3/FTP forms; browser with breadcrumb/multi-select/cursor paging; import summary incl. skipped). Capture widgets FRONTEND-ONLY per arch: `capture/WebcamCapture|ScreenCapture|VoiceRecorder` (getUserMedia/getDisplayMedia + MediaRecorder → normal `POST /media/upload`, zero new backend). Both wired into media toolbar behind `can('media:add')`.
- Run continuity: previous heartbeat died on org spend limit AFTER writing drivers/oauth/service/schema WIP; this run verified that WIP, added controller/schema/routes/tests/frontend, landed everything.
- Next: D9 final review/E2E gate (KDL-135) — last open Phase D step.

## 2026-07-08 — KDL-119 Media DAM Phase A: A7 storage drivers (Backend Architect)
- Commit `5462218`: refactored storage.service.js from direct MinIO calls to driver pattern. New `storage/drivers/minio.driver.js` (extracts existing MinIO logic), `storage/drivers/s3.driver.js` (AWS SDK v3, forcePathStyle for custom endpoints), `storage/index.js` (driver selector by STORAGE_DRIVER env). storage.service.js is now a thin facade — same exports, zero caller changes. R2 = s3 driver + ACCOUNT_ID endpoint. 19 vitest contract tests (mocked SDKs). Compose STORAGE_DRIVER passthrough + .env.example docs.
- Full suite 493/495 — same 2 pre-existing D5 ai-driver failures; no regressions.
- Next: A8 frontend (search bar+facets, tag manager, custom-field editor, collections/favorites/recents views, chunked upload UI, MediaPicker tabs).

## 2026-07-08 — KDL-119 Media DAM Phase A: A6 virus scan wired (Backend Architect)
- Commit `e1e7386`: scan service/worker/queue existed (landed inside Phase C commit bb0ea6a) but were dead code — no upload ever enqueued a scan and `require_scan` was computed but never enforced. Now: every upload (incl. chunked/zip/url — all funnel through `uploadMedia`) enqueues a `media-scan` job; `resolveUrls` withholds url+variants unless `scan_result === 'CLEAN'` when `media.require_scan` on (fail closed on SKIPPED/pending); copy inherits source scan fields (already did); clamav 1.3 added to docker-compose as optional `scan` profile (clamdata volume, 3310, healthcheck) with `CLAMAV_HOST` passthrough to backend; `.env.example` documented.
- Gates: new `tests/media/scan.test.js` — EICAR fixture → quarantine (soft-delete + reindex remove + admin notify), clamd protocol parse, CLEAN/SKIPPED/deleted-row/notify-broken paths; require_scan gate tests in media.service.test.js. 40/40 in touched files; full suite 474/476 — the 2 failures are ai-drivers/ai-provider expecting 4 drivers while an UNCOMMITTED openai-embeddings driver (interrupted Phase D5 work, not mine) sits in the tree.
- NOTE for D5 owner: uncommitted work in tree (ai/drivers/openai-embeddings.js, ai/media-semantic.service.js + 6 modified files) breaks 2 driver-registry tests — finish or commit it.
- Next: A7 storage driver interface (minio/s3/r2 via STORAGE_DRIVER).

## 2026-07-08 — KDL-119 Media DAM Phase A: A5 file ops (Backend Architect)
- Commit `8c918a5`: copy/duplicate (+checksum dedupe warning), archive flag (bulk endpoint + list filter), folder upload (relative_paths → nested folders), chunked+resumable upload (init/part/status/complete, disk-backed sessions, 512MB default cap via new `media.max_chunked_file_size_mb` setting), ZIP import (adm-zip, whitelist/zip-slip/bomb guards, folder tree from paths), URL import (SSRF guard re-applied per redirect hop, streaming size cap, MIME re-check).
- Gates: 36 new vitest (chunk assembly, zip entry validation, url import caps) — full backend suite 394 passing. Live curl smoke on :4001 (MINIO_PORT=9002 override needed from host): chunked 2-part flow, copy dedupe warning, archive filter, zip import w/ folder creation + .exe skip, URL import happy path + private-host 422.
- Next: A6 virus scan (clamav docker + media-scan queue + quarantine).

## 2026-07-08 — KDL-114 Notifications Step 7 E2E (Code Reviewer)
- `frontend/e2e/notifications.spec.ts` — 13/13 pass in 8.4s against freshly rebuilt docker images (`docker compose up -d --build backend frontend nginx`), Playwright exit 0.
- Covers: install/enable module → broadcast to all → member unread-count + TopBar bell badge (UI) → mark-all-read clears badge → system-category IN_APP opt-out strictly suppresses next broadcast (count unchanged) → EMAIL channel via `system.broadcast` template → integration log SENT + 3 messages verified in mailhog → module disable removes bell from DOM.
- Spec fixes this step: test 11 was `after >= before` (proved nothing) → now opts out of `system` (inline-broadcast category) and asserts strict equality; test 12 had wrong status (202 vs 200), wrong response keys (`items`/`metadata` vs `logs`/`subject`), and used inline broadcast which never sets an email body → now uses seeded `system.broadcast` template, provisions a mailhog SMTP provider via API when absent (cleaned up in afterAll), polls log to SENT.
- Email sub-step NOT blocked: integrations module ENABLED in stack, ran live.
- Note: killed stale host dev servers (node :4000, next :3001) that blocked docker port binds.
- Next: KDL-107 Step 8 (docs).


---
*Older entries archived in [.agents/STATUS_ARCHIVE.md](.agents/STATUS_ARCHIVE.md) to reduce session-load tokens.*
