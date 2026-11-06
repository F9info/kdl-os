# 11 — CMS module and frontend architecture: analysis and proposal

Date: 2026-11-06. Branch `akhil_kdl`. **Analysis only: nothing has been moved or deleted.** Every change below needs approval first. Brief: "Additional Requirements – CMS Module & Frontend Architecture".

## 1. Where frontend/website functionality lives today

| Layer | Location | Note |
|---|---|---|
| Backend modules | `cms` (umbrella, `nav: []`, depends on 11 modules), `menus`, `landing`, `forms`, `faq`, `gallery`, `team`, `catalog`, `work`, `sectors`, `projects-content`, `testimonials`, `page-builder` (core), `page-builder-ui`, `custom-blocks` (core), `detail-page-types` (core), `theme-engine`(+`-ui`), `template-engine`, `brand-kit`, `collateral` | Each is its own module folder and manifest. The `cms` umbrella groups them by `dependsOn` and the sidebar groups them through a `parent` link. Logical consolidation already exists. |
| Admin screens | `frontend/src/app/admin/*`: pages, brands, layouts, website-details, color-palette, menus, landing-pages, forms, faq, gallery, team, catalog, work, sectors, projects-content, testimonials, page-builder, template-engine, theme-engine, static-website | Flat list of about 20 folders next to unrelated admin screens. |
| Public site | `frontend/src/app/(site)/`: `/` home, `/[prefix]`, `/[prefix]/[slug]`, `/p/[slug]`, `/preview/[token]`, `/catalog|work|sectors/[slug]`, `/share/[token]` | Plus sitemap/robots. |
| Section blocks | `frontend/src/frontend/blocks/*` (105 section types, packs) | Follows the Q10 layout rule (admin-only code in `src/admin`, public code in `src/frontend`). |
| Generated site | `backend/.../template-engine/site/templates/*` + closure of `src/frontend` copied by `generator.js` | Standalone project copy, by design. |

## 2. Findings against the brief

**F1. Navigation is configured in two places (violates "do not hardcode in multiple places").**
- Optional modules declare `nav` in `module.json` (rendered by the sidebar).
- `AdminSidebar.tsx` also hard-codes `FLAT_ITEMS` and `GROUPS` (Dashboard, Users, Modules, the Media group including *Cloud Imports*, Access Control, the Settings group). The `nav` arrays in the core manifests (`media`, `modules`, `settings`, `users`, `user-management`) are never displayed, so they are dead configuration that already disagrees with the hard-coded copy.
- `isStageNavActive()` hard-codes four CMS paths in the sidebar.

**F2. The website navigation belongs to `menus`, not `cms`.** Website Details, Color Palette, Brands, Navigation, Layouts, Pages and Sections are all declared in the `menus` manifest (Sections is gated by `page-builder:view`). `cms` has `nav: []`. It works because CMS depends on `menus`, but CMS cannot own, order or rename its own navigation.

**F3. Titles and icons.** 10 items use the generic `Package` icon (Navigation, Website Details, Catalog, FAQ, Sectors, Team, Work, Case Studies, Notifications, Integrations). `MODULE_ICON_MAP` is a fixed list and silently falls back to `Package`. Titles are mixed: "Brands" opens the website stage, "Layouts", "Pages" and "Brands" all open the same `/website` stage page with a different `view`.

**F4. Landing Pages and Forms are not in the sidebar.** That was your earlier Q12 decision (they appear as cards on Content > Brands). This brief lists "Landing Pages" as an example nav item, so the two instructions conflict: please choose.

**F5. Installing CMS creates demo content, unconditionally (violates item 4/5).** `cms/seed.js` runs inside the install transaction: it inserts placeholder rows (FAQ, gallery, testimonials, team, catalog, work, sectors, case studies) **and generates the starter website pages**, then records the wizard question as answered "yes". The Setup Wizard already asks whether to start with a sample website; the CMS install overrides that answer.
Separately, `frontend/projects/<slug>` (generated Next project, gitignored) and the optional `site-preview` compose service exist only for the "Prepare project folder / Frontend view" flows; neither is required to use the admin or to publish pages.

**F6. Routes and slugs.** Conventions are consistent: `/` home, `/<key>`, `/p/<slug>` for any published page, landing slug equals its site slug and is rejected with 409 when taken, so landing and website pages coexist. Duplicate mechanism: three hard-coded detail routes (`/catalog|work|sectors/[slug]`) next to the generic `detail-page-types` route `/[prefix]/[slug]`.

**F7. Duplicates.** A content-hash scan of `frontend/src` and `backend/src` (excluding generated templates and tests) found **0 identical files**. The duplicates are structural: F1 (nav), the three stage nav items in F3, and F6 (detail routes).

**F8. Physical consolidation is risky.** Moving the 14 website module folders under `modules/cms/` breaks the module loader (it scans `modules/*/module.json`), the `dependsOn` graph, and many imports and tests, for no behavior gain. Recommendation: keep logical consolidation (umbrella + `parent`) and make it complete (F1, F2), not a folder move.

## 3. Proposed work packages (each needs your approval; none started)

| WP | What | Risk | Recommended order |
|---|---|---|---|
| A | **Icons and titles**: extend the icon map, give every nav item a meaningful icon, tidy titles | Low | 1 |
| B | **One navigation config**: manifests carry `group`, `order`, `icon`, `permission` for *every* module (core too); the sidebar and the command palette render from them; delete the hard-coded `FLAT_ITEMS`/`GROUPS` and the dead manifest duplicates; `cms` owns the website items instead of `menus` | Medium | 2 |
| C | **Optional demo**: installing CMS creates no placeholder content or pages unless the wizard answer is "yes" or the user clicks "Add sample content"; empty state offers "Create your first page" | Low-Medium | 3 |
| D | Landing Pages (and Forms) back in the sidebar under Content, if you choose so (F4) | Low | with B |
| E | Fold the three hard-coded detail routes into the generic detail-page route | Medium-High | defer |

## 4. Test plan after approval
Install, enable and disable CMS; check sidebar titles, links, icons and permissions per role; disabled modules leave the sidebar; no demo content or project folder after a clean CMS install; static export and landing pages still work; all seven product combinations; a duplicate scan; full unit suites, rebuild and the headless flow audit.

## 5. Status (2026-11-06)

| WP | Status |
|---|---|
| A icons | **Done.** Every nav entry has a distinct, registered icon (`frontend/src/admin/lib/nav-icons.ts`); titles keep the approved terminology (T7.2). |
| B one nav config | **Done.** `module.json` is the only place navigation is configured (new fields: `group`, `groupIcon`, `groupOrder`, `order`, `activeWhen`, bundle `icon`). The sidebar and command palette render one model (`admin/lib/nav-model.ts`); the hard-coded `FLAT_ITEMS`/`GROUPS`/`isStageNavActive` and the five copies of the link markup are gone; the command palette now also lists the CMS entries it used to miss. Guard test: `tests/regression/nav-config.test.ts`. `cms` still bundles the parts via its umbrella; the website entries stay declared in `menus` (moving them needs the bundle `parent` model reworked, not done). |
| C optional demo | **Done.** Installing CMS installs the tools only. Starter pages and placeholder FAQ/team/gallery/... rows are created only when the wizard answer is "yes" (or later via `POST /api/projects/onboarding {frontend:'yes'}`, idempotent, which now also seeds the sample rows when CMS is on). Proven in rolled-back transactions on the live DB: not answered / "no" = 0 rows, 0 pages; "yes" = 20 rows, 5 starter pages. |
| D Landing / Forms in sidebar | Not changed: kept as cards on Content > Brands (Q12). To add them, give `landing`/`forms` a `nav` entry in their manifests (one line each). Awaiting your decision. |
| E detail routes | Deferred. |
