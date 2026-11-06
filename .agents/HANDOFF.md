## 2026-11-06 (per-device section visibility) — uncommitted

Every section now has `hideOnMobile` / `hideOnTablet` / `hideOnDesktop` (Show/Hide radios, Style tab). One wrapper does it for all 105 blocks: `frontend/src/frontend/blocks/packs/device-visibility.tsx` (`withDeviceVisibility`, applied in `composePacks`; adds the fields, wraps `render`, extends `resolveFields`). Visitors: no flag = no wrapper element; with flags a `display: contents` div with `max-md:hidden` / `md:max-lg:hidden` / `lg:hidden` (pure CSS; breakpoints 768 / 1024). Editor: `puck.isEditing` => no hiding, amber outline + "Hidden on ..." badge. `isStyleField` routes `hideOn*` to Style; `section-schemas.json` regenerated (+3 toggle fields per block; regenerate with `UPDATE_SECTION_SCHEMAS=1` after any field change). Backend `page-builder/validate.js`: warning `BLOCK_HIDDEN_EVERYWHERE` when all three are true. Also fixed: the editor panel ignored Puck's `field.label` (`app/admin/page-builder/blocks-panel.tsx` now uses `fieldDisplayLabel`, new `field-label.ts`); 7 existing blocks had labels that were never shown ("Header menu", ...), they show now. Tests: `DeviceVisibility.test.tsx` (13, incl. all 105 blocks), `field-label.test.ts`, backend validate (+2). Backend 1858 / frontend 674 green. Live (rebuilt): published page at 390/900/1280 px shows exactly the right sections, live window resize flips them with no reload, editor badges and labels OK, exported static site CSS contains all three rules.

Do not hide-flag a header/footer layout block expecting the layout preview to honor it (WebsiteLayoutPreview renders layout blocks outside Puck). **Open:** Landing/Forms sidebar decision; font CSP OK; commit; Section Builder interaction test (drag/duplicate/delete).

## 2026-11-06 (website delivery choice: Web application / Static website / both) — uncommitted

Backend (`modules/modules`): `products.js` `WEBSITE_DELIVERIES = ['web-app','static','both']` + `DELIVERY_SETTING_KEY = 'products.website_delivery'`; `schema.js` body takes optional `delivery`; `service.js` `getDelivery()`, `getModuleGraph()` now returns `delivery` (null until chosen), `applyProducts(selected, actorId, delivery)` stores it only when Website is selected (omitted = unchanged); controller passes it through. Frontend: `admin/lib/project-type.ts` (`projectTypeLabel`, `DELIVERY_OPTIONS`), `admin/lib/website-surfaces.ts` (`visibleSurfaces`), `admin/hooks/useWebsiteDelivery.ts` (shares the `['module-graph','stored']` cache), `ProductPicker` delivery radios + "Your project: ..." line (Products page and Setup Wizard; wizard defaults to web application), `WebsiteStage` Brands cards are now data-driven from `SURFACE_CARDS` + `visibleSurfaces` (also hides Landing Pages / Forms when those modules are off). Tests: backend `products-apply.test.js` (+5), frontend `project-type.test.ts` (7 combinations + card rules), ProductsPage (+3), SetupWizard (+2), website-stage (+4). Backend 1856 / frontend 658 green. Live (rebuilt): all three deliveries round-trip API -> Brands cards -> Products page; settings restored afterwards (`products.enabled` unchanged, delivery row removed = unset).

Existing installs: delivery unset behaves exactly as before (all cards). Gap doc `docs/planning/10-primary-workflow-gap-analysis.md` rows 5 and 6 marked resolved. **Open:** per-device section visibility; Landing/Forms sidebar decision; font CSP OK; commit.

## 2026-11-06 (admin login reset) — uncommitted

Owner could not sign in (README example password was being typed). Reset `admin@kdl.com` with `backend/scripts/reset-admin-password.js` to the dev password given by the owner (README + `docs/INSTALLATION_GUIDE_SIMPLE.md` examples now show it); the script also clears the Redis lockout and sets `must_change_password=false`. The script's minimum length is now 12 only when `NODE_ENV=production`, 8 otherwise (the app's own schemas accept 8+). e2e commands now need `E2E_ADMIN_PASSWORD` set to the new dev password (the old `Admin@123456` no longer works). Fixed `e2e/command-palette.spec.ts`: the first-run Setup Wizard modal (shown while company identity is incomplete) traps focus so Cmd-K never reached the palette; the spec now dismisses it ("Ask me later"), and passes (also exercises the manifest-driven palette). Not a product regression: no JS errors, the "?" sibling test passed. Fresh installs are unchanged (seed password rules in the README table still apply).

## 2026-11-06 (CMS work packages A, B, C) — uncommitted

**B/A (one nav config + icons):** navigation is declared ONLY in `module.json` (`nav[]`: label, path, icon, permission, order, group/groupIcon/groupOrder, activeWhen; bundle `icon`). Backend: `manifest-schema.js` extended, 19 manifests updated, `listEnabledModules` returns `icon`. Frontend: `admin/lib/nav-icons.ts` (registry), `admin/lib/nav-model.ts` (pure `buildNavModel`/`flattenNav`/`isNavActive`), `useModules()` returns `navModel`, `AdminSidebar.tsx` renders it (hard-coded FLAT_ITEMS/GROUPS/isStageNavActive and 5 copies of link markup removed; `NavLink`/`NavSectionBox`), `CommandPalette.tsx` uses the same model. Live sidebar identical in structure/order (25 links) with distinct icons. Guard tests: `tests/regression/nav-config.test.ts` (reads every real manifest; mutation-checked: bad icon / duplicate link / missing page / unknown permission each fail), ported `stage-nav-active.test.ts`, `useModulesHidden.test.tsx`. `docs/MODULE_GUIDE.md` documents the fields.

**C (optional demo):** `cms/seed.js` now creates nothing unless `onboarding.frontend == 'yes'`; `answerOnboarding('yes')` also runs `seedCmsSamples` when CMS is enabled. Verified in rolled-back transactions on the real DB (0/0 for unanswered and no, 20 rows + 5 pages for yes). Tests: `cms/seed.test.js` rewritten, 2 new in `onboarding.test.js`.

**Not done / open:** Landing Pages and Forms stay out of the sidebar (owner has not answered; 1-line manifest change). Website entries still declared in `menus`, not `cms`. WP E deferred. Font CSP change still waiting for OK. Note: do NOT run prettier on existing backend files (no config; it reflows unrelated lines).

## 2026-11-06 (rebuild + rerun, CMS architecture analysis) — uncommitted

**Rebuild/rerun:** all images rebuilt, whole stack up, smoke OK (backend/ai/frontend/nginx 200). Full e2e on the fresh stack found ONE real regression: the one-click static build failed with `ENOENT .static-build/src/app/layout.tsx`. Cause: `writeSite()` deletes and recreates `src/`, and any admin edit triggers a background regeneration, so a static build that copied the folder at that moment saw it half written. Fix: per-site in-process lock `withSiteLock(slug, fn)` in `template-engine/site/generator.js`, taken by `writeSite` and by the whole static build (`static-build.js`); edits made during a build are picked up by the next regeneration. Tests in `static-build.test.js` (2 new, both fail without the lock, verified). Backend 1845 passed; audit + CMS flow + static build e2e all pass in sequence. Limit: in-process lock (single backend instance), same as the job state.

**CMS analysis (no moves/deletions done):** `docs/planning/11-cms-consolidation-analysis.md`. Findings: nav declared in two places (manifests AND hard-coded `FLAT_ITEMS`/`GROUPS` in `AdminSidebar.tsx`; core manifest nav arrays are dead); website nav lives in `menus` not `cms`; 10 items use the generic Package icon; CMS install seed unconditionally inserts placeholder content and generates the starter website (overrides the wizard answer); 0 identical-content duplicate files. Proposed WPs: A icons/titles, B single nav config + `cms` owns website nav, C optional demo content, D Landing/Forms in sidebar (owner must choose, conflicts with Q12), E detail-route fold (deferred). **Waiting for owner approval** before A-D.

## 2026-11-06 (Developer role + role-aware dashboards) — uncommitted

Found: Admin had grants only on base modules (60), none on cms/page-builder/menus/forms/landing/..., and nothing granted permissions when a module was installed, so only super-admin could build a site. Fix: `user-management/shared/role-blueprints.js` (policy: developer = all except roles:delete/permissions:delete; admin = base modules + content modules, view-only theme-engine/template-engine/projects, no modules/integrations/credits, default-deny for unknown). Applied by `seedUserManagement` (fresh), `applyBlueprintsOnce` in `index.js` after `loadModules` (marker app_setting `rbac.blueprint_version`; live: +256 grants, admin 60->141, developer 175, restart applies nothing), and `registerPermissions` in `modules/service.js` for NEW permission modules only. Dashboard `app/admin/dashboard/page.tsx`: Build (Modules, Themes[theme-engine:edit], Integrations) and Content (Website, Pages, Sections, Media, Users) quick actions gated by permission + module enabled. Tests: `role-blueprints.test.js` (7), collateral install tests extended (2 new), `DashboardPermissions.test.tsx` (7). Backend 1843 / frontend 622 green. Live probe users (deleted after): developer modules 200, admin 403, dashboards differ.

**Open:** owner to confirm the Developer/Admin split; delivery choice (web app vs static) and per-device section visibility; CSP font hosts; commit.

## 2026-11-06 (gap analysis vs the "Primary Workflow" brief) — uncommitted

Full table in `docs/planning/10-primary-workflow-gap-analysis.md`. Fixed now: README (ports 3001/5001/9002/9003, no host `migrate dev`, accurate overview, links to the install guides) and `app/admin/dashboard/page.tsx` (permission-aware cards/queries; `tests/rtl/regression/DashboardPermissions.test.tsx`, 3 tests, 2 fail on the old page; verified live with a throwaway `user`-role account: welcome note, zero API errors; admin unchanged). Frontend 618 passed. **Open, need owner decisions:** Developer role + role-aware dashboards; "Web application vs Static" delivery choice in Products/Wizard; per-device visibility for sections; Section Builder interaction audit. Also pending: CSP font hosts (see entry below).

## 2026-11-06 (focus: admin flow + frontend CMS flow) — audit + 2 fixes (uncommitted)

User asked to skip the remaining mobile work (push, device sessions) and focus on the Admin and frontend CMS flows. New headless audit `frontend/e2e/flow-audit.spec.ts` (run: `E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD=... pnpm e2e e2e/flow-audit.spec.ts`): (1) signs in, expands every collapsed sidebar group, visits all 25 links on desktop 1440 and mobile 390, records console/page errors, API >=400, error screens, blank pages, mobile h-scroll; (2) CMS flow: create page via API -> draft is 404 publicly -> Pages screen loads -> editor opens it -> publish -> `/p/<slug>` renders -> unpublish -> 404 -> delete. Final: admin flow 50 visits, 0 issues; CMS flow passes.

**Fixed:** (1) `notifications/controller.js sseStream` leaked its per-user slot when the client left mid-handshake (disconnect handlers were registered after several awaits) — handlers now first, idempotent `release()`, 4 regression tests (3 fail on the old code). (2) `/admin/media/ai` 404 on `media.ai_autotag` every visit — data migration `20261106120000_media_ai_autotag_default` seeds the row (off).

**Not bugs (explained):** `/api/notifications/stream` 429 = the per-user cap of 3 live streams is held by the developer's own open browser tabs (verified via redis client list; direct and through the Next proxy a killed client releases in <4 s). `/admin/pages` is the website wizard's Pages stage (engine-assembled pages only), API-created pages are intentionally not listed.

**DECISION PENDING (blocked by the auto-mode classifier, not applied):** `frontend/next.config.ts` CSP is `style-src 'self' 'unsafe-inline'` / `font-src 'self'`, which blocks the Inter stylesheets (Google Fonts, rsms.me) the theme/editor load. Every admin and editor load logs 2 CSP errors and the editor throws an unhandled `Event` (the one remaining pageerror in the CMS flow). Proposed minimal fix: add `https://fonts.googleapis.com https://rsms.me` to style-src and `https://fonts.gstatic.com https://rsms.me` to font-src, plus a regression test that keeps the CSP tight (no `*`, no `https:`, no unsafe-eval). Needs the owner's explicit OK.

## 2026-11-06 (later) — OpenAPI spec, no new dependency (uncommitted)

`GET /api/v1/openapi.json` (also `/api/openapi.json`; `authenticate` + `requirePermission('modules','view')`, built once and cached). `backend/src/shared/openapi/`: `spec.js` (`trackMounts(app)` wraps `app.use` to record `[prefix, router]` because Express 5 keeps no mount path — it is called right after `express()` in `index.js`, so mount order matters; `buildSpec` walks router stacks; `authenticate` recognised by function name, anything after `router.use(authenticate)` is secured), `zod-schema.js` (in-house Zod v3 -> JSON Schema, unknown types degrade to `{}`). `middleware/validate.js` now sets `handler.schema` so the generator can read body/query/params schemas. Tests `shared/openapi/openapi.test.js` (4); backend 1830 passed/3 skipped. Live (rebuilt): 401 without token, 200 with; 259 paths / 359 operations / 38 tags, 128 with request bodies, operationIds unique, every `{param}` declared, `/faq/public` lists `updated_since`.

**Limits:** no response bodies (200/401/422 stubs only); permissions not listed (`requirePermission` is an anonymous closure); routers nested inside routers are skipped; paths outside `/api` omitted. An external validator (swagger-cli via npx) was blocked by the auto-mode classifier, so validity was checked with my own structural checks only — run one yourself before generating clients. **Mobile list left:** device sessions + logout-all (needs a design review), push (needs FCM/APNs credentials).

## 2026-11-06 (after commit b0fa9299) — ETag verified + `updated_since` on public lists (uncommitted)

ETag needed no code: Express already sends weak ETags and answers `If-None-Match` with 304 (verified live on `/api/faq/public`). Added `shared/utils/updated-since.js` (`updatedSinceField` = ISO-8601 with offset, `applyUpdatedSince(where, query)` => `updated_at > date`) and wired it into the list schema + service of faq, sectors, projects-content, gallery, catalog, team, work (public lists). Tests: `shared/utils/updated-since.test.js`; backend 1826 passed/3 skipped. Live (rebuilt): invalid value 422, future date empty, epoch date full list, a value equal to the newest row excludes it.

**Limit (documented in the helper):** a delta cannot report deletions or rows just deactivated (public lists only return active rows) — clients need an occasional full fetch. **Mobile list left:** OpenAPI (new dependency => board approval, or hand-written spec), `device_sessions` + logout-all (Prisma migration), push (needs FCM/APNs credentials).

## 2026-11-06 (final) — API versioning `/api/v1` (uncommitted)

`backend/src/middleware/api-version.js` (mounted first in `index.js`): rewrites `/api/v1/<p>` to `/api/<p>` before routing, so every core and auto-mounted module is reachable under v1; `X-API-Version: 1` on all `/api` responses; `/api/v10` is not v1. `req.originalUrl` keeps the v1 path. Test `middleware/api-version.test.js` (4); backend 1823 passed/3 skipped. Live (rebuilt): v1 and plain app-config 200, v1 modules 401 without token / 200 with, unknown v1 404, header present, none on /health, works through :3001.

**Mobile list now:** app-config done (T1.1), versioning done. **Open:** OpenAPI (new dependency => needs board approval per locked stack; hand-written spec is the no-dependency alternative), ETag/`updated_since`, `device_sessions` + logout-all (M2, needs a Prisma migration), push (M4, needs FCM/APNs credentials from you).

## 2026-11-06 (last) — Chroma tenant isolation (uncommitted)

`ai-services/src/knowledge/tenant.js`: `getTenantCollection(base, tenantId)` (collection = `<base>_<sha256(tenant)[:24]>`, cached), `tenantOf(jwtPayload)` (`tenantId` claim else `user:<id>`), fails closed on a missing tenant. `ingestDocument/retrieveChunks/storeMemory/searchMemory/deleteMemory` take `tenantId` as the LAST arg; `ragChain` takes `options.tenantId` (stripped before the model call); `BaseAgent` requires `tenantId` in its constructor; `createRagTool(session, priority, tenantId)`, `createMemoryTool(tenantId)`. Chat controller passes `tenantOf(req.user)`. Tests: `tests/tenant-isolation.test.js` + chat additions; ai-services 141 passed. Live on real ChromaDB (rebuilt container): A's doc invisible to B; legacy shared collections `kdl_knowledge` / `kdl_long_term_memory` do not exist, so nothing was migrated.

**Behaviour change:** every user now has a PRIVATE knowledge base and memory. Org-shared knowledge needs the backend to sign a `tenantId` claim into tokens (not built; nothing ingests today — there is no ingest endpoint). **Still open:** Claude spend cap, mobile-app prerequisites (push, sessions, API versioning, OpenAPI, app-config).

## 2026-11-06 (later still) — ai-services limits, role gates, spend metering (uncommitted)

`ai-services/src/middleware/caller-limit.js`: `callerLimit(name, max)` (per caller id, not IP; env `AI_LIMIT_<NAME>`; in-memory store) and `allow({service, roles})`. `index.js`: brand-inference = service JWT only (backend brand-kit signs `{id:'svc:brand-kit', service:true}`), embed = service or admin/super-admin, chat/transcribe open to users but limited (60 / 20 per 15 min). `/embed` now checks the daily budget (503) and `openrouterEmbed` records its cost. Claude calls: `brain-router` records `estimateCostUsd` via `recordClaudeSpend` into `budget:claude:<day>` (not gated, so HIGH never waits on the OpenRouter budget; failures swallowed). Tests: `tests/spend-and-limits.test.js`, `tests/embed.controller.test.js`, router contract extended. ai-services 123 passed. Live (rebuilt container): user 403 / admin+service pass the gates as designed.

**Heads up:** any NEW caller of embed/brand-inference must use a service JWT or an admin account. **Still open:** Claude spend cap (metered only), Chroma tenant isolation, mobile-app prerequisites.

## 2026-11-06 (later) — Owner-decision items 1–2 closed (uncommitted)

**PII scrubber:** `ai-services/src/governance/compliance.js` now scrubs Aadhaar, PAN, Indian mobiles (order: card, phone_in, aadhaar, pan, then old patterns — order matters, see `compliance.test.js`). ai-services 114 passed.

**Project scoping:** `middleware/project.js` `requireProject` accepts `'param'` and a resolver fn (undefined = 404). Wired into all credits routes (incl. hold release via hold->project), all 10 brand-kit `/:projectId` routes, and collateral (list=query, create=body, asset/render routes via row lookup). Test `modules/project-scoping.route.test.js` (30 cases: outsider 403, member passes, shared open, unknown id 404). `theme-colors.route.test.js` now mocks the middleware. Backend 1819 passed/3 skipped. Live check as admin: 200/404/401 as expected.

**Still open:** ai-services per-user limits + budget accounting, Chroma tenant isolation, mobile-app prerequisites.

## 2026-11-06 — KDL OS roadmap complete (T1.x–T8.2, Q1–Q14) on akhil_kdl (uncommitted)

Source of truth: `docs/planning/KDL_OS_IMPLEMENTATION_TRACKER.md` (every row Completed; per-task files, tests, limits there). Highlights: Application Identity is the ONLY company-details store (`identity.*`, Settings > Identity); products/modules resolver; Site/landing/forms/SEO/versions (Phases 3–6); linked sections + section schema JSON; Brands cards (Web app, Landing Pages, Forms, Collateral, Static website); docs in `docs/how-to` + `docs/reference`; T7.5 removed legacy brand-profile stores.

**T8.2 (latest):** one-click static export. `POST/GET /api/template-engine/site/static` + `GET .../static/download` (`site/static-build.js`, in-memory job: `npm install --include=dev` + `build:static` in the generated site folder, forces `NODE_ENV=production` — the container's `development` breaks next build). UI `/admin/static-website`, status poll 10 s (prod API limit is 100/15 min). e2e: `E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD=... pnpm e2e e2e/static-website.spec.ts`. Limits: job state lost on backend restart, single instance, zip in memory.

**Tests at close:** backend 1789 passed/3 skipped; frontend 615 passed; tsc/eslint/prettier clean. **Palette ratchet:** remaining classes are deliberate (on-photo white, scrims, error reds, picker thumbnails) — do not migrate. **Open (owner decision, from 2026-10-18 list):** Chroma tenant isolation, ai-services per-user limits/budget accounting, `requireProject` on credits/brand-kit/collateral, Aadhaar/PAN/+91 PII scrubber, mobile-app prerequisites (push, API versioning, OpenAPI).

## 2026-10-18 (later) — Full-code audit: security hardening + roadmap/mobile module plan (uncommitted)

Audits (backend, ai-services, mobile-readiness) → fixes with tests: `publicOnlyActive` on 6 public list routes; register/forgot-password limiters (authLimiter skipped successes = unlimited); menus URL allowlist (open redirect) + ownership/depth checks; shared `utils/safe-url.js` on sectors/case-study links; atomic refresh-token claim; SSRF guard on AI provider `base_url` + image-op output URL; ai-services chat: clamp client `priority`, per-user session key, one-line MANUAL_TASKS note; LLM client timeouts; `claude.brain.test` mock made vitest-4-safe. CLAUDE.md "not built yet" corrected. Backend 1385 / ai-services 101 / frontend 307 green.

**Still open (needs owner decision):** Chroma tenant isolation, ai-services per-user limits + budget accounting, `requireProject` on credits/brand-kit/collateral, Dependabot merges (Dependabot owns lockfiles), staging provisioning. Full plan + 12 Android/iOS modules + stages: `docs/PLATFORM_ROADMAP_AND_MOBILE_MODULES.md`.

## 2026-10-18 — CURRENT_ISSUES_AND_SOLUTIONS.md issues 1–9 resolved (uncommitted), 10–11 audited

**P0 tests (1–4):** `website.driver.test.js` mock now returns `{id,...patch}` from `updatePage` (+ reused-page mocks carry `project_id`, assertions count the new auto-publish call); `seed-content.test.js` mocks `config/database.js`; `template-engine-website-stage.test.tsx` rewritten for the real flow (typography → fontSettings → navigation → assemble, resume via localStorage, `useTemplateEngineRuns` in the hook mock); 3 variants registered in `construction.variants`. Backend 1329 / frontend 307 green.

**5 Autosave:** `hooks/useAutosave.ts` (1.5s debounce, no overlap, retry, flush on unmount, beforeunload) wired into `template-engine/edit/[id]/page.tsx` via `autosavePage` (data only — never changes status). Autosave goes LIVE (one `data` column) and queues a site rebuild per save — owner chose this.

**6 Mobile menu:** `MobileNavMenu` accordion (3 levels) in `header-nav-menu.tsx`, used by ConstructionHeader's mobile drawer. **7** was already done in code (all 4 designs use `menuTree`); only a stale comment fixed.

**8 SEO:** `sectors/[slug]/page.tsx` is now a server component with `generateMetadata` (helper `lib/sector-metadata.ts`, real endpoint `/api/sectors/public/:slug`); UI moved to `SectorDetailClient.tsx`. Generated sites copy these by import closure (verified).

**9 Per-project copy:** the doc's premise was wrong — `SettingValue` is the theme-engine token store; Vision/Mission live in global `SettingField.value`. Added `ProjectSettingValue` (migration `20261018083941_add_project_setting_values`, applied to local dev DB only) as a per-project override; public `GET /setting-fields/public/values?project_id=` and admin `by-type`/`value`/`values` accept a project; empty value deletes the override. UI: `/admin/settings/view/<slug>?projectId=<id>` (not yet linked from nav).

**10 Dependabot:** audit only — 7 open PRs all red (frontend: pnpm overrides mismatch → `@dependabot rebase`; backend/ai-services: fail on master-wide test drift fixed above). Nothing merged.
**11 Staging (repo side fixed, human side pending):** `docker-compose.preview.yml` image path now `ghcr.io/${IMAGE_REPO:-f9info/kdl-os}` (was a non-existent `kalamdreamlabs/...`); `cd-staging.yml` triggers via `workflow_run` after "CD" (no image race), passes IMAGE_REPO, ships the frontend source the site generator needs, drops the masked migration step (backend migrates at start), retries the health check; nginx now routes `/health` → backend (was falling through to site-preview); `staging-bootstrap.sh` rewritten for sudo/non-root deploy user + ufw; `staging-smoke.yml` trigger block fixed; dead "INTENTIONAL BREAK" CMD removed from `backend/Dockerfile`. Still needs a human: VPS, SSH key, DNS, GitHub secrets (`MANUAL_TASKS.md` KDL-403). Known gaps listed there (no TLS, MinIO 9002 not public, Meili keys, site-preview is `next dev`). Local-only: site-preview 500s on macOS Docker bind mounts (`Unknown system error -35`) — pre-existing.

## 2026-09-26 — Web app · Pages wizard grid now lists all 11 real Sector Detail pages

User's complaint: a stray, empty, recurring "Sector Detail" card kept showing in the Navigation
wizard's "Web app · Pages" grid (test debris — typing a label into the wizard's custom-add field
both creates a real `MenuItem` and auto-scaffolds a real generic `BuilderPage`, 3rd time this
class of bug hit this session), while the 11 *real* Sector Detail pages (Showrooms, Hotel, ...)
built earlier this session were only reachable from the separate `/admin/sectors` screen, not
from this wizard at all — "your flow and my flow is not match." Used `AskUserQuestion` to resolve
placement ambiguity; user chose **"list them in the Pages grid itself."**

Deleted the stray menu item + page (again). Added a `sectorPages` query to `WebsiteStage.tsx`
(`GET /api/sectors?project_id=`) and rendered each sector with a `detail_page_id` as its own
orange-badged "Sector" card in the same grid as the existing purple "Page" cards — same Edit
button pattern, linking to the identical per-sector editor `/admin/sectors` already uses (no
new/duplicate editor). Grid header now reads e.g. "7 pages + 11 sector detail pages assembled...".
Verified via direct DB query: all 11 sectors have a non-null `detail_page_id` (Builder, Convention
Center, Educational Institute, Gated Communities, Government, Hospital, Hotel, Industry, Premium
Flats, Showrooms, Villa) — all 11 render as cards.

**Also fixed this session** (same investigation arc, see prior entries below for the sector
architecture itself): `/admin/sectors` dead-ended with "Add ?projectId=... to the URL" when
opened from the sidebar directly — same bug independently confirmed on Team/FAQ/Case-Studies/
Menus. New shared `useDefaultProjectId()` hook (`frontend/src/hooks/useDefaultProjectId.ts`)
resolves `?projectId=` from the URL, else falls back to the project with `is_default: true` —
applied to all 5 screens. `/admin/sectors`'s action buttons redone (primary "Edit page" button,
gear-icon "Settings" for base fields) after user confusion between the real sector editor
(working) and the unrelated stray page above. Root-caused and fixed 3 more real bugs found while
chasing user reports: `layoutHeaderProps()` hardcoded `transparent:true, lightText:true` for
every Layout-picker-assembled page (white-on-white nav on any page without a dark hero) —
defaulted both to `false`; `runWebsiteAssembly()` (Navigation step's own advance call) never sent
the `layout` field at all, so pages touched only via Navigation never got the chosen Header/
Footer design applied; `createItemMutation` always sent `url: null` for auto-created nav pages
even though a real page always gets created — added `slugifyLikeBackend()` so nav links resolve.
"Add a page then refresh and it's gone" reproduced as **zero saving-state UI**, not silent data
loss (an add genuinely round-trips, but a refresh mid-flight loses it, invisibly) — added an
`isSavingNav` flag driving a "Saving…/Live" badge, disabled controls during save, and a
`beforeunload` guard.

## 2026-09-26 — Scalable sector detail-page architecture: /sectors/[slug], auto-provisioned pages

User's ask: 5 sectors today, maybe 100+ later — sector detail pages (e.g. `sector-hotel.html`)
must not become one hardcoded route/template per sector. One reusable architecture, admin-managed,
no developer work per new sector.

**`Sector.detail_page_id`** — loose reference to a `page-builder` `BuilderPage` (same non-relational
cross-module convention as `MenuItem.page_id`). `createSector` now auto-creates and links a starter
detail page for every new sector (zero manual page-creation step); backfilled the 11 existing
sectors. Starter content reuses the SAME generic block library every other page uses (Inner Banner/
Text/Lead Form+FAQ), pre-filled from the sector's own fields, plus whatever Header/Footer blocks
already exist on any other real page in the project (`siteChrome()` helper) — so a brand-new
sector's page looks like the rest of the site with zero brand-resolution logic duplicated.

**New dynamic route `/sectors/[slug]`** (mirrors `/p/[slug]`, keyed by `Sector.slug` instead of
`BuilderPage.slug`) — one route serves any number of sectors. Falls back to a plain render of the
sector's own base fields if its page has no content/isn't published, so a new sector is never a
dead link. Basic client-side SEO (title/meta description/canonical) from new `seo_title`/
`seo_description`/`og_image`/`canonical_url` fields — full SSR-crawlable metadata would need a
server-component conversion, flagged as deeper follow-up work, not done here.

**Listing page now generates real links**: `ConstructionSectorDetailList`'s "Read more" computes
`/sectors/{slug}` directly from the real slug for DB-sourced sectors, not a stored `cta_href`.
Admin UI (`/admin/sectors`) gained SEO fields, stricter slug validation, an "Edit Content" action
straight to the existing Puck editor for that sector's page (same editor as every other page — no
new editing UI built), and "View live".

**Real recurring bug root-caused (3rd occurrence this session, same class each time)**:
`ConstructionFooter`'s "Company" links read a static `links` prop the template-engine driver's
`patchNavLinks` periodically overwrites with a stale `navigationPages` snapshot — including
leftover test-page names typed into the wizard days earlier. Cleaning the value each time it was
found was a symptom fix. Root cause fixed here: Footer now reads the live Menu exactly the way
`ConstructionHeader` Design 1 already does (static field is now only a project-with-no-menu
fallback) — the exact gap flagged by the earlier "is anything hardcoded" audit ("Footer is a
second, unconnected nav system"). Editing navigation once now updates Header **and** Footer
everywhere, matching "global change propagates everywhere" for the whole site, not just sectors.
Cleaned the stale field on all 5 real pages too.

**Verified end-to-end**: migration + backfill, listing page links resolve to real `/sectors/{slug}`
URLs, `/sectors/hotel` renders full real content (banner/body/lead-form/header/footer), zero broken
images/console errors, Footer confirmed clean and live-Menu-driven on both a sector page and Home.

## 2026-09-26 — Sectors page: new module + 4-variant Section Builder block (sectors.html recreated)

User's ask: recreate the approved `sectors.html` page exactly (content/images/UI/layout), fully
dynamic through the existing KDL Kit architecture, with 4 selectable variants for the section (1 =
exact reference clone, 2-4 = original alternatives) — same "reusable, not Subhadra-specific"
mandate as Menus.

**New Sectors module** (`backend/src/modules/sectors/`) — `Sector` model (eyebrow/name/slug/
category/description/image/cta_label/cta_href/order/is_active), migration, CRUD + public read
endpoint, admin UI at `/admin/sectors` — mirrors the Team/FAQ/Projects-Content module shape exactly
(same scaffold → schema → service → controller → routes → seed → admin-CRUD pipeline).

**New `ConstructionSectorDetailList` block** (added to the existing "Sectors" page-builder
category) — Design 1 is an exact clone (jump-pills anchor row + 11 alternating image/text rows,
reversed every other row); Designs 2-4 are card-grid / centered-numbered-list / dark-alternating-
bands originals. Same DB-wins-if-non-empty pattern as every other content block this session:
reads `/api/sectors/public`, falls back to its own static `sectors` field only when a project has
no real sectors yet.

**Extended `ConstructionLeadFormFAQ`** with optional `checklistItems`/`trustStats` fields —
sectors.html's lead-CTA section has a 3-item checklist and a 3-stat trust row the shared component
didn't support. Additive/backward-compatible: existing Home/About instances don't set these
fields, so nothing changes for them.

**Real bug found and fixed**: `useScrollReveal`'s IntersectionObserver checks a 0.15 threshold
against the *observed element's own* bounding box. Wrapping the entire 11-row list (~4500px tall)
in one `ref` meant it could never reach 15% visible in any real viewport — confirmed via direct DOM
inspection, computed `opacity: 0` permanently, no scroll position ever revealed it. Fixed with a new
per-row `SectorRevealItem` helper (reveals each row independently) — applied to all 4 variants, not
just the one that surfaced it, since all 4 stack this many items. Matches the approved reference's
own per-`<article> data-aos="fade-up"` more faithfully than a single section-level reveal would
have anyway.

**Seeded real data**: all 11 sectors verbatim from sectors.html. Government/Premium Flats/Gated
Communities keep the reference's own Unsplash stock photos (no local asset exists for these 3 —
matches existing precedent elsewhere in this codebase for stock-photo fallbacks, flagged rather
than silently swapped). "Read more" CTAs point at `#` — the 10 sector-detail pages are future work,
not built yet, same precedent as Founder Profile's own placeholder link. Copied the one missing
local asset (`hospital.jpg`) so there's zero dependency on `after-delete-folder`.

**Verified end-to-end**: migration + module install/enable (auto-seeded), public endpoint returns
all 11 correctly ordered, live page screenshot (zero broken images, zero console errors, all
jump-pills resolve to real anchor ids), all 4 variants visually confirmed distinct before restoring
the real page to Design 1, admin CRUD screen screenshotted with real data.

## 2026-09-26 — Menus module: 3-level nav system, WordPress-style drag-drop admin UI, ConstructionHeader dropdown

User's ask: dynamic, fully-configurable navigation (3 levels: main/sub/sub-sub) manageable
through a WordPress-Menus-style drag-drop admin UI, explicitly **reusable across future KDL Kit
sites, not Subhadra-specific** — "the database structure should properly support the hierarchy."

**Architecture**: `Menu` + `MenuItem` Prisma models (`backend/prisma/schema/menus.prisma`) — plain
adjacency-list self-relation (`parent_id`), unique `(project_id, key)` per menu (e.g. "header"),
cascade delete. Depth capped at 3 in application logic (both `_tree.ts` client-side and
`service.js` server-side), not the DB — first hierarchical/self-referencing model in this schema.

`backend/src/modules/menus/` — full CRUD + unauthenticated public tree-read
(`GET /public?key=&project_id=`), plus a batch `reorder` endpoint that accepts the whole tree's
flattened `{id, parent_id, order}[]` shape in one write (client sends the full new shape after any
drag operation, rather than one request per move).

`frontend/src/app/admin/menus/` — WordPress Menus-style two-pane UI (Pages/Custom-Link picker on
the left, tree on the right). **Native HTML5 drag-and-drop, no new dependency** — drag onto a row
nests it (up to 3 levels), drag to a row's top/bottom edge reorders as a sibling; cursor-Y-ratio
in `rowDragOver` decides the zone. Expand/collapse, edit (label/URL/new-tab/enabled), delete, all
wired to the same tree state, "Save changes" button batches the reorder call.

**Phase-1 rendering scope**: `ConstructionHeader` (Design 1 desktop nav) only — Footer/mobile-nav/
Designs 2-4 still use the flat `links` fallback, deliberately deferred. New
`frontend/.../packs/header-nav-menu.tsx`: `useHeaderMenuTree(projectId)` hook (`null` = no menu
configured yet → caller falls back to its own static field) + `HeaderNavMenu` — pure-CSS
hover-dropdown/flyout via Tailwind named groups (`group/l1`, `group/l2`), no JS open/close state.

**3 real bugs found and fixed during verification** (not just "compiles"):
1. `createMenuItem`'s depth check was off-by-one (`parentDepth + 1 >= MAX_DEPTH` instead of `>`)
   — rejected every legitimate depth-3 item. Caught by actually trying to build the user's own
   example tree (About → Vision & Mission → Vision/Mission) via the API, not just unit-testing
   the happy path.
2. Menu item URLs accepted `javascript:`/`data:`/`vbscript:` — stored XSS, flagged by an
   automated background security review mid-session. Fixed with an allowlist in the Zod schema
   (write side: http/https/mailto/tel/relative-path/`#anchor`) plus a `safeHref` render-side
   sanitizer in `header-nav-menu.tsx` (defense-in-depth for pre-existing rows).
3. **The big one**: the live dropdown never rendered on the real public page at all. Root cause
   traced through 3 layers: `page-builder`'s `getPublishedBySlug`/`listPages` never selected
   `project_id`, `createPage` never accepted it, and — the actual origin —
   `template-engine/drivers/index.js`'s `websiteDriver` never passed `run.projectId` into either
   the create-page or reuse/patch-existing branch. Every page this driver has ever created
   (any project, not just Subhadra) has `project_id: null`, so `puck.metadata.projectId` is
   always `undefined` on the public route, so `useHeaderMenuTree`'s query never even fires. Fixed
   all 3 layers (see the preceding `wip(template-engine)` commit for the driver fix). Backfilled
   `project_id` on Subhadra's 17 existing pages directly in the dev DB via the deterministic
   `template_engine_runs.projectId` → slug-prefix mapping (`te-<runId>-*`) — **this was a
   client-specific data backfill, not wired into any generic seeder**; a fresh KDL install
   creating new pages going forward gets `project_id` set correctly at creation time via the
   driver fix, no backfill needed for future projects.

**Verified end-to-end**: migration + module install/enable, public endpoint curl tests, nested
create/reorder/depth-violation/XSS-rejection via direct API calls, admin UI screenshot (tree
renders with correct indentation, Pages picker, add/edit/delete), and — the actual proof — a
Playwright hover screenshot on the real live `/p/te-cmt18teqh000101rxwfzfndow-about` page showing
the "About" dropdown chevron and "Company" flyout item, using a temporary test child (deleted
after, menu restored to its real flat 5-item state: Home/Products & Services/Sectors/Contact/
About).

**Known limitation, not fixed** (out of scope this pass): Footer/NavBar/mobile-nav dropdown
rendering — Design 1 desktop nav is the only consumer of the Menu tree so far; the other 3
`ConstructionHeader` designs and the mobile hamburger panel still read the flat `links` field.

## 2026-09-26 — FAQ + Projects Content modules, Settings→Fields for simple text (continues Team)

Continuation of the Team module work — same session, "yes, continue for all remaining
modules" approval. Also carried a new constraint: production must not depend on
`after-delete-folder/` (user will delete it once verification is done). **Audited this first**:
extracted every `/seed/...` path referenced in the live Home+About page JSON (152 unique,
properly URL-decoded) and confirmed every one resolves to a real file under
`frontend/public/seed/` — zero dependency on the source folder already, confirmed empirically
not assumed. The only 2 repo references to `after-delete-folder` are code comments (this
module's own `seed.js`, and 2 comments in Inner Banner's Design 1) — not read at runtime.

**FAQ module** (`backend/src/modules/faq/`) — `FaqEntry` model, same shape as Team's module
(migration, CRUD, `/api/faq/public`, `/admin/faq`, real 6-Q&A seed). `ConstructionLeadFormFAQ`
now prefers the DB list over its own `faqs` field once a project has any entries — simpler
pattern than Team's per-slot picker since FAQ is inherently a full list, not a single reference.

**Projects Content module** (`backend/src/modules/projects-content/`) — `ProjectCaseStudy`
model (named to avoid colliding with the existing tenancy `projects` module/table). Targets
`ConstructionProjectsSlider` specifically — the ONE project-family component that already had
real content (3 real case studies: CMR Family Shopping Mall, Novotel Visakhapatnam, The Amara
Residency); `ConstructionProjectGallery`/`ProjectsGridCards`/`ProjectShowcaseSplit`/
`ProjectMapStrip`/`FeaturedProject`/`CaseStudyGrid` are still static/generic, not converted this
pass. Same DB-wins-if-non-empty pattern, **plus**: disabled the inline-canvas-edit affordance
(`InlineEditableText`'s `isEditing`) on the per-slide fields whenever DB content is showing, so a
canvas click can't silently edit the now-dead static `slides` prop instead of the case study
actually on screen — same fix pattern as Team, but this component uses
`InlineEditableText` (Team didn't), so needed its own explicit gate.

**Skipped a dedicated Blog module** — checked `after-delete-folder/*.html` first: no blog page
exists at all, "gallery" hits in sector/work pages are just photo lightboxes (Projects content,
not articles). Nothing real to seed, so no module built — flagging the decision rather than
fabricating placeholder blog posts. **Folded Gallery into Projects Content** rather than a
separate module (a case study's own `image` field covers it at this scale) — per the user's own
"don't create a dedicated module for every small piece" caution.

**Settings→Fields** (`backend/src/modules/setting-fields/`) — real gap found: every existing
route requires `authenticate`, including the read-by-slug endpoint — meaning the public
`/p/[slug]` renderer could never read a field's value, only the logged-in editor could. Added
`GET /public/values?slugs=a,b,c` (no auth, bulk, plain-value-only — no file/media resolution).
New "Website Content" Type + 10 fields (Vision/Mission/About heading+paragraphs×2, tagline) via
`prisma/seeders/website-content-fields.seed.js` — **field definitions** are wired into the
generic `prisma/seed.js` pipeline (client-agnostic, mirrors `brand-profile-fields.seed.js`
exactly), but the real Subhadra **values** are set by a separate function in the same file,
invoked directly for this project — same split as every other client-specific seeder this pass.
`ConstructionAboutSplit`/`ConstructionMissionVision`/`ConstructionTaglineStrip` now read these
via a new shared `useSettingsFieldValues` hook (one bulk request per component, not one per
field) — DB value wins over the block's own static prop, same pattern throughout.

**Known limitation, not fixed** (out of scope, pre-existing architecture): `setting-fields` has
no per-project concept at all (global `SettingField.value`, no `project_id` anywhere) — unlike
Team/FAQ/Projects-Content. Fine for this single-tenant demo install; would need real work before
two different client projects on the same KDL Kit instance could have different Vision/Mission
text.

**Verified live**, not just "compiles": both public pages reloaded after the docker rebuild —
FAQ list, project slider, and all 4 pieces of Settings-Fields copy render from their new sources,
zero console errors, no visual regression versus the previously-verified About/Home pages.

## 2026-09-26 — Team module: first proper content module (schema → migration → admin CRUD → Puck data-binding)

User's ask: stop storing reusable content (Team, FAQ, Blog, Gallery, Projects) as JSON blobs
inside Puck block props — give each its own module (Prisma model, migration, seeder, service,
admin CRUD, frontend rendering), matching the existing `module:create` scaffold's
module→schema→migration→model→seeder→service→admin→frontend pipeline. Keep simple one-off text
(Vision/Mission/About copy, taglines) in the existing Settings→Fields system instead — confirmed
already fully working (`setting-fields` module), not a stub. Confirmed via investigation: **zero
Team/FAQ/Blog/Gallery/Project tables existed anywhere** before this — literally every block's
content was copy-pasted JSON, no single source of truth.

Scoped to **Team only** as phase 1 (user's choice, to prove the pattern before repeating for
FAQ/Blog/Gallery/Projects) — full architecture:

- `backend/prisma/schema/team.prisma` — `TeamMember` (project_id, name, role, bio, photo_url,
  order, is_active). `photo_url` is a plain string, not a Media-table FK — matches every other
  image field already in the page-builder packs (`imageField` also stores a plain URL).
- `backend/src/modules/team/` — full CRUD (routes/controller/service/schema), scaffolded via
  `npm run module:create -- --slug=team --name="Team"` then filled in following the `categories`
  module's exact pattern (closest analog: simple CRUD, no owner_module complexity). `GET
  /api/team/public` is unauthenticated (mirrors page-builder's own `/public/:slug` — consumed by
  both the editor canvas and the real public site).
- `backend/src/modules/team/seed.js` — the 2 real founders (K Leela Prasad, K N V Uday Kumar).
  **Deliberately not wired into `prisma/seed.js`** — that pipeline bootstraps a brand-new,
  client-agnostic KDL install; this is one specific client's data. Invoked directly for this
  project instead (`node --input-type=module -e "...seedTeam()..."`).
- `/admin/team` — new CRUD screen (list/create/edit/delete), project-scoped via `?projectId=`.
- `ConstructionFounderProfile` gains `person1MemberId`/`person2MemberId` (a new
  `teamMemberField()` custom Puck field — dropdown of Team members, global list since a custom
  field has no access to `puck.metadata` to scope it by project). Render: if a memberId is set,
  fetches that member from `/api/team/public` and uses their live name/role/bio/photo; otherwise
  falls back to the block's own static fields — **fully backward compatible**, no existing
  instance breaks.
- Threaded `projectId` into Puck's `metadata` (same mechanism as Inner Banner's `pageTitle`) in
  both `edit/[id]/page.tsx` and `p/[slug]/page.tsx`, so render-time fetches can be project-scoped.

**Module install gotcha for next agent**: creating `module.json` + `routes.js` on disk is not
enough — `module-loader.js` mounts the router unconditionally, but `moduleGate` blocks every
request with 404 until a `Module` row exists in the DB with `status: 'ENABLED'`.
`seedCoreModules` (in `prisma/seed.js`) only registers modules with `"core": true` in their
manifest — it will NOT pick up a new optional module. The real path is
`POST /api/modules/:slug/install` then `POST /api/modules/:slug/enable` (what the real
`/admin/modules` UI calls) — and that install step also runs the module's own `seed.js`
automatically. Also: `backend`, like `frontend`, is a **baked-image docker container, no source
bind-mount** — `docker compose restart backend` after adding a module does nothing; needs
`docker compose build backend && docker compose up -d backend`, same lesson as Inner Banner's
frontend-container finding.

**Verified end-to-end, not just "looks right"**: published a page with a Founder Profile block
linked to Leela Prasad's real `TeamMember` row, confirmed the public page showed his real DB
bio (and the *other* person's static fallback, unlinked, showed correctly too) — then edited his
bio through `PATCH /api/team/:id` **only**, reloaded the public page with **zero republish**,
and the new bio appeared. That's the actual value proposition proven, not just plumbing that
compiles.

**Still open** (deliberately deferred): FAQ/Blog/Gallery/Projects modules (same pattern, not yet
built); moving Vision/Mission/About-text/taglines to Settings→Fields (still living as static
Puck props); Certifications-badges/Org-Chart/Team-Stats (the other 3 Team-category designs)
still store their people as static props, not wired to `TeamMember` — only Founder Profile was
converted this pass.

## 2026-09-26 — Founder Profile moved from About category to Team category

User feedback: Founder Profile ("The people behind Subhadra Group" — K Leela Prasad/K N V Uday
Kumar) belongs under Team, not About. Removed `ConstructionFounderProfile` from `founder`
category's `components` (About no longer offers it, and its already-published instance was
removed from the live About page content via `PUT /page-builder/:id` — 12→11 blocks). Added it
to `team` category **in place of** `ConstructionTeamCrew`, per "show only four ui if needed
replace one" — kept Team at exactly 4 designs (Founder Profile, Certifications & Safety Badges,
Org Chart, Team Stats). Picked TeamCrew to drop since it was the most redundant with Founder
Profile (both people-cards) and its content was generic placeholder people (Ramesh Kapoor etc.)
vs Founder Profile's real ones — `ConstructionTeamCrew`'s code is untouched, just no longer
offered in any category's picker. Verified live in the actual Team picker popup.

## 2026-09-26 — Mission & Vision given 4 selectable designs (audited every category first)

User asked for "every section" to have 4 designs like Hero Slider, pointing at Mission & Vision's
picker showing only 1 card as the broken example. Before touching code, audited every category in
`typedCategories` (both packs — `compose.ts` auto-merges same-key categories across packs by
concatenating their `components` arrays) against "reaches ≥4 selectable designs, whether via a
`variant` field on one component or via ≥4 distinct components grouped under the category":
everything else already clears 4 this way (e.g. Counters = 3 construction components + general's
`StatsStrip` = 4; Footer = construction's `ConstructionFooter` + general's 4-variant `Footer` =
5). **Mission & Vision was the only real gap** — one component, no `variant` field at all,
confirmed exactly matching the user's own screenshot.

Added a `variant` field to `ConstructionMissionVision` (1–4), same picker UX as Hero
Slider/Inner Banner: Design 1 is the existing alternating-badge-card layout, untouched and kept
as `Current`; 2 (side-by-side cards), 3 (centered minimal), 4 (dark split band) are new. Verified
in the actual picker popup — all 4 render distinctly, Design 1 correctly marked Current.
