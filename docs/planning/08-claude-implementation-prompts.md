# 08 — Claude Implementation Prompts

Status: PROPOSAL. Run ONE prompt at a time, only after you approve that phase. Every prompt ends with "stop and wait". Shared preamble (prepend to each):

> Read CLAUDE.md, .agents/HANDOFF.md, STATUS.md, .agents/CONTEXT.md first. Follow the Coding Conventions in CLAUDE.md (ES modules, Zod, successResponse/errorResponse, try/catch -> next(error), Prisma singleton, storage.service.js). Do not change the locked tech stack. Do not touch more than one workspace lockfile. Rebase before push; never push to master. Verify with test exit codes, not self-assessment. Do not start any other phase.

---

## Prompt P1 — Application Identity

**Objective:** One global Application Identity (name, title, description, logo light/dark, favicon, brand colors, contact, social, copyright), editable without CMS, readable by admin and site via `GET /api/app-config`.
**Context:** Identity is currently split across `brand-profile` SettingFields, `BrandKit.logo_media_id`, the `logo` SettingField, and hardcoded `'KDL Admin'` in `frontend/src/app/layout.tsx`. See docs/planning/01 and 02.
**Inspect:** `backend/src/modules/settings`, `setting-fields`, `brand-kit/contact-fields.js`, `prisma/seeders/brand-profile-fields.seed.js`, `frontend/src/app/admin/website-details/page.tsx`, `components/layout/AdminSidebar.tsx`, `app/layout.tsx`.
**Required changes:** new `identity` module (routes/controller/service); public whitelisted `/api/app-config` with Redis cache + invalidation in the service layer; admin page at Settings > Application Identity gated only by `settings`; admin shell metadata/sidebar read identity; idempotent migration script from the 3 legacy sources (old rows untouched).
**DB:** use `app_settings` keys `identity.*` unless a row model is clearly better; justify in the PR. Non-destructive.
**API/UI:** Zod validation; `requirePermission('settings','edit')`; favicon + logos via `storage.service.js`; progressive disclosure (advanced = collapsed).
**Backward compat:** legacy fields remain readable; fall back to them when identity empty.
**Testing:** service + route tests (permission denied, whitelist leak), migration idempotency, component test, e2e: admin-only user sets name/logo/favicon.
**Acceptance:** admin-only install can brand the admin with no CMS/menus module; changing identity updates `<title>`, favicon, sidebar without rebuild.
**Completion report:** files changed, test output, migration dry-run result, open questions. Stop and wait.

---

## Prompt P2 — Products, resolver, wizard

**Objective:** Admin/Website/Landing as product flags; dependency-resolved module enabling; conditional Setup Wizard.
**Inspect:** `backend/src/modules/modules/service.js`, `shared/modules/module-loader.js`, `manifest-schema.js`, 33 `module.json` files, `projects/onboarding.js`, `FrontendOnboardingDialog.tsx`, doc 04.
**Changes:** `products.enabled` setting; optional `products` hint in manifest schema (backward compatible); resolver with `required_by` reference counting; `GET /api/modules/graph`; Settings > Products UI; wizard (identity always, other steps per product); product-aware sidebar.
**DB:** none, or a small `required_by` column/JSON on `Module` (justify).
**Testing:** table-driven resolver tests for all 7 combinations + conflict + removal; e2e of each wizard path.
**Acceptance:** Admin-only never sees CMS; disabling keeps data; adding a product later runs only its mini-wizard.
**Report + stop.**

---

## Prompt P3 — Live brand binding

**Objective:** Header/Footer/logo blocks read identity at runtime; remove need for Website-stage re-run on brand edits.
**Inspect:** `template-engine/drivers/website-seed-content.js` (`patchBrand`, `patchLayout`, `patchLogoAtoms`), `useWebsiteBrandContext.ts`, `header-nav-menu.tsx`, `_site/SitePage.tsx`, generated-site `generateMetadata`.
**Changes:** blocks fetch `/api/app-config` (SSR where possible); baked values kept only as fallback; site metadata + favicon from identity; deprecate brand path of `resyncWebsiteIfBuilt`.
**Compat:** old pages with baked values still render.
**Testing:** change company name -> site reflects it with no rebuild (test + manual steps).
**Report + stop.**

---

## Prompt P4 — Global Header/Footer

**Objective:** Server-persisted header/footer per Site; pages reference, not copy.
**Inspect:** `prisma/schema/site-layout.prisma` (unused), `lib/website-layout-overrides.ts`, layout stage routes, `/admin/layouts`.
**Changes:** schema + API + editor wiring; migrate localStorage overrides on first load; pages reference layout id.
**Testing:** two browsers see same layout; edit propagates to all pages.
**Report + stop.**

---

## Prompt P5 — Sites and Landing Pages

**Objective:** `Site` entity; multiple landing pages; public router by host/path; `forms` module; per-site overrides.
**Inspect:** `page-builder` module, `BuilderPage`, nginx `$site_host`, `site/generator.js`, `app/p/[slug]`.
**Changes:** `Site` model + backfill default site; `site_id` on pages; router; `landing` module + page templates; forms definitions/submissions/notifications; CTA binding; identity overrides.
**Compat:** existing website pages migrate to the default website Site; URLs unchanged.
**Testing:** two landing sites with independent slug/SEO; submit a lead form; website unaffected.
**Report + stop.**

---

## Prompt P6 — SEO and Publishing

**Objective:** Per-page SEO + global defaults, sitemap/robots, `PageVersion`, publish/unpublish/rollback, signed preview, pre-publish validation.
**Changes:** schema + API + editor UI + `generateMetadata`; cache revalidate on publish.
**Testing:** publish -> live; rollback -> prior content; invalid page blocked with reasons; preview token expiry.
**Report + stop.**

---

## Prompt P7 — Section registry, rename, docs

**Objective:** Explicit section schemas; custom sections as versioned definitions linked (not copied); label renames; theme unification; Diataxis docs; scenario e2e.
**Changes:** per doc 05/06; renames are label-only with redirects; migrate hardcoded palette classes to tokens incrementally (separate PRs per pack).
**Testing:** e2e for scenarios A–E; TTHW measured; docs How-To + Reference.
**Report + stop.**
