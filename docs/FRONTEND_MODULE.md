# Frontend module: architecture, workflows and extension guide

The **Frontend** module (slug `cms`) is the umbrella that turns KDL OS into a website platform: demo website,
header and footer layouts, the section-based page builder, landing pages and the content modules. This page is
for developers. Step-by-step screens for admins are in the flow guides (Admin > Documents).

Related: [ARCHITECTURE.md](ARCHITECTURE.md), [MODULE_GUIDE.md](MODULE_GUIDE.md), [SEEDERS.md](SEEDERS.md),
[TEMPLATE_ENGINE_FLOW.md](TEMPLATE_ENGINE_FLOW.md), [INSTALL_FLOW.md](INSTALL_FLOW.md).

## 1. What installing Frontend does

`backend/src/modules/cms/module.json` is an *umbrella*: it depends on `faq, gallery, testimonials, team, catalog,
work, sectors, projects-content, menus, landing, forms`. Installing it installs those first, then runs
`cms/seed.js` inside the same transaction (a failure rolls the whole install back).

| Step | Code | Result |
|---|---|---|
| Sample content rows | `cms/pages.js` `seedCmsSamples` | FAQ, gallery, testimonials, team, products, work, sectors, case studies |
| Starter website | `projects/onboarding.js` `createStarterSite` | Home, About, Services, Contact, FAQ and the content pages, with header and footer menus |
| Demo landing pages | `landing/demo.js` `seedDemoLandingPages` | Four landing pages: Business, SaaS, Agency, Startup |
| Landing templates | `landing/seed.js` `ensureBuiltinTemplates` | The template library (see section 4) |
| Record of what was created | app setting `frontend.demo_summary` | Shown on the "Frontend installed" screen |

Rules (all from [SEEDERS.md](SEEDERS.md)):

- The demo is skipped only when the Setup Wizard answered **no** to "start with a sample website" (setting
  `ONBOARDING_KEY`). With no default project yet nothing is created; `seedOnEnable` (called when Frontend is
  enabled) creates it later, and does nothing if a summary already exists, so re-enabling never brings back
  pages the owner deleted.
- Seeds are idempotent and never overwrite an edited page. Everything created is a normal row: the owner can
  edit, duplicate, replace or delete it. There is no lock flag.
- All demo text, images and structure live in seeders and templates (`landing/templates.js`,
  `projects/onboarding.js`, `drivers/website-seed-content.js`), never in the UI components.

Verified on a fresh database (empty Postgres, installer run end to end): 34 modules enabled, 12 website pages,
the four landing pages, 9 landing templates, header and footer menus. See section 9.

## 2. Header, footer and top header (layout library)

A **layout** is a named header, footer or top header of a project. Table `layout_presets`
(`backend/prisma/schema/layout-presets.prisma`, migration `20261127120000_layout_presets`):

| Column | Meaning |
|---|---|
| `kind` | `TOP_HEADER`, `HEADER`, `FOOTER` |
| `status` | `DRAFT` (not shown) or `PUBLISHED` |
| `is_default` | the project's default of that kind; always published; only one per kind |
| `variant` | the design, see below |
| `config` | the design's own settings, strings only |
| `version` | bumped when `variant` or `config` change |

`builder_pages.header_layout_id` and `footer_layout_id` assign a layout to one page (null = the default).

**Which layout a page shows** (`projects/layout-presets.js` `resolveLayoutForPage`): the layout assigned to the
page (when published and not deleted), else the project default of that kind (published), else the project's
single site layout selection (sites made before the library keep their look). Sites that already had a site
layout get it imported as their first, published default the first time the library is listed.

**`variant` values** (validated in `projects/schema.js` and `template-engine/schema.js`, regex
`^([1-5]|f9|landing:[1-4]|custom:<id>)$`):

| Value | Design |
|---|---|
| `1` to `5` | Built-in Construction pack designs |
| `landing:1` to `landing:4` | The Landing header or footer, designs 1 to 4 (header and footer only) |
| `f9` | The F9 Tech header or footer blocks |
| `custom:<id>` | A block saved in the Section Builder (`CustomBlockTemplate`) |

**API** (`projects/routes.js`, permission `projects:view` or `projects:update`):
`GET|POST /api/projects/:id/layouts`, `PATCH|DELETE /:layoutId`, `POST /:layoutId/duplicate`,
`POST /:layoutId/default`. A copy is always a draft and never the default, so duplicating cannot change the
live site. The default cannot be unpublished or deleted.

**Public render.** `frontend/src/lib/apply-site-layout.ts` runs when a page is rendered. It swaps the page's own
top bar, header and footer blocks for the chosen design: a built-in number restyles the block, `f9` and
`landing:N` replace it with the F9 or Landing block carrying the layout's `config`, and a switched-off slot is
dropped from the output only (the stored page keeps its block). A Landing page that uses its own
`LandingHeader` is left alone unless the layout is a `landing:N` one.

**Admin screens:** `/admin/template-engine/projects/<id>/website/layouts` (library list, edit, preview, assign
pages, set default) and the Layout settings card on the Website step. Previews are drawn by
`admin/components/layouts/LayoutPreview.tsx`, inside an iframe of the chosen device width so the design's
responsive rules apply.

## 3. Page builder and sections

The editor is Puck. A **section** is a block (React component plus a field list) registered in a **pack**:

| Pack | Folder | Blocks | Notes |
|---|---|---|---|
| general | `frontend/src/frontend/blocks/packs/general` | 17 | The default starter |
| construction | `.../construction` | 75 in 18 categories | The default website pack |
| medical | `.../medical` | 12 | Domain pack |
| landing | `.../landing` | 19 | Landing page sections |
| composer | `.../composer` | custom | Blocks users build themselves |

**Four designs per section.** A section has four designs in one of two ways, both shown to the user as
"Design 1 to 4":

1. *One block, four renderings*: a `variant` field (`'1'` to `'4'`) picked with `variantField(labels, thumb)`
   (`packs/variant-field.tsx`; `liveThumb` draws the thumbnail from the block's own render). The same props feed
   every design, so switching never loses content. A block saved without `variant` renders Design 1. The pack
   lists these blocks in its `variants` map so the Insert-a-block dialog shows one card per design.
2. *Four blocks in one category*: used by the Construction pack's categories (About, Video, Team, FAQ, ...).

Current coverage (checked by script, see section 9): Landing 19 of 19 sections have four designs; Construction
every one of the 18 categories has four or more (Counters through the Stats strip's four designs plus two other
blocks); General: Welcome, Services, Counters, Footer, Tagline strip and Content (CMS) have four; Medical: all
12 blocks have four.

**What users can do** (Admin > Frontend > Sections and the page editor): add a section from the picker, edit its
fields in the Content and Style tabs, duplicate, reorder, delete, hide per device (desktop, tablet, mobile), save
a section for reuse, and build a new section design with the no-code composer (stored in the database as a
`CustomBlockTemplate`, usable in any page and as a header or footer layout).

**Section schema file.** `frontend/src/frontend/blocks/section-schemas.json` records every block's fields and
their tab. It is generated, and the backend reads the same file to check a page before it is published
(`page-builder/validate.js`). After changing a block's fields run
`UPDATE_SECTION_SCHEMAS=1 npx vitest run tests/rtl/regression/SectionSchemas.test.tsx` in `frontend/` and commit
the result; the same test fails when the file is out of date.

**Theme tokens.** Blocks must use theme tokens (`text-title`, `bg-surface`, `bg-primary/10`, `bg-inverse`,
`border-divider`, ...), not palette colours. `tests/regression/theme-token-ratchet.test.ts` fails when a block
file gains a hard-coded colour class.

## 4. Landing pages

Templates are rows (`kind` landing, `builtin: true`) created by `landing/seed.js`. The library has nine:
`blank`, `lead-gen`, `product-launch`, `event`, `offer`, `business`, `saas`, `agency`, `startup`
(`landing/templates.js`). A built-in is never overwritten after a user edit, and a deleted one is not brought
back. On the Landing Pages screen a user can **Use this template**, **View**, **Duplicate**, **Rename**,
**Delete**, save any landing page as a template, or start **New landing page** in the section builder. The four
seeded demo pages (Business, SaaS, Agency, Startup) are ordinary pages: edit, duplicate or delete them.

A landing page is public at `/p/<slug>`, rendered by the app frontend (`/p/[slug]`).

## 5. Detail pages and "Add detail"

A detail layout shows one item (a service, a gallery album) and is shared by every page of its type. Module
`detail-page-types`: `POST /api/detail-page-types {project_id, name}` creates the type, two sample entries
("Sample <Name> 1" and "2", with a bundled photo) and a header-menu link; the type then shows in Layout settings
as **Layout <Name> Detail** with a numbered link per page. `DELETE /api/detail-page-types/:typeKey` removes the
type, its pages and its menu links.

In the Navigation step every page chip (except Home) has an **Add detail** button that calls this endpoint, so
only the clients that need a detail layout get one. The generic "Service detail", "Blog detail" etc. chips and
the automatic doubling of a page named "... detail" were removed.

## 6. Database, migrations and seeders

- One Prisma schema file per module in `backend/prisma/schema/`, migrations in `backend/prisma/migrations/`.
  Fresh install: `npx prisma migrate deploy`, then the core seed. A new column or table needs a migration;
  a new `variant` value does not (it is a plain string).
- Module seeds live in `backend/src/modules/<slug>/seed.js` and run on install ([SEEDERS.md](SEEDERS.md)).
- `node backend/scripts/verify-seeders.mjs` is the gate: on a scratch database it runs the core seed, installs
  and enables every module, runs every seed twice (no row added, changed or removed outside log tables), checks
  user edits survive, and disables and re-enables every module. It must exit 0 before a release. It needs
  `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `APP_ENCRYPTION_KEY` (64 hex characters).

## 7. How to extend

**Add a design to a section.** Give the block a `variant` field (`variantField` with labels and `liveThumb`),
branch the render on `variant` (default branch = Design 1), add the block to the pack's `variants` map, run the
section-schema command above, and add a test like `tests/rtl/regression/CounterDesigns.test.tsx` (same content in
all four designs, four different renderings, no variant = Design 1).

**Add a section (block).** Add it to the pack's `typedComponents` and to its category in `typedCategories`;
component keys are unique across all packs (`composePacks` throws on a clash). Repeating items use an array
prop edited as Add/Remove/Reorder (see `numbered-families.json`).

**Add a layout design.** Add the value to the two variant regexes in `projects/schema.js` and
`template-engine/schema.js`, render it in `admin/components/layouts/LayoutPreview.tsx`,
`admin/hooks/useLayoutChrome.ts` and `lib/apply-site-layout.ts`, add it to the Design list in
`LayoutEditorDialog.tsx`, and add tests (`projects/layout-variant.test.js`, `tests/regression/apply-site-layout.test.ts`).

**Add a seeded landing page or template.** Add it to `landing/templates.js`; it appears for new installs through
`ensureBuiltinTemplates`. Keep seeds idempotent and never touch user-edited rows.

**Add a module.** `npm run module:create -- --slug=blog --name="Blog"` and follow [MODULE_GUIDE.md](MODULE_GUIDE.md).

## 8. Develop, test, deploy

```
cd backend  && npm test                         # needs JWT_SECRET and JWT_REFRESH_SECRET (32+ characters)
cd frontend && npx tsc --noEmit && npx vitest run
cd backend  && node scripts/verify-seeders.mjs  # seeder and module lifecycle gate (scratch database)
cd frontend && E2E_BASE_URL=<frontend url> npx playwright test e2e/<spec>
```

The Docker frontend and backend are built images: after changing source run
`docker compose build frontend backend && docker compose up -d frontend backend`. Deployment is in
[DEPLOY_SERVER.md](DEPLOY_SERVER.md); local multi-project ports in [MULTI_PROJECT_LOCAL.md](MULTI_PROJECT_LOCAL.md).
`next dev` does not hydrate in a browser here: the site's Content-Security-Policy has no `unsafe-eval`; test
against a production build.

## 9. Verification record (2026-11-28)

Run on an isolated stack with an empty database (project `kdlfresh`, own volumes and generated-sites folder):

| Check | Result |
|---|---|
| Installer, 7 steps, admin created, launch, sign-in, installer closed afterwards | pass (`e2e/installer-fresh.spec.ts`) |
| Seeders and module lifecycle on a scratch database (`verify-seeders.mjs`) | pass, exit 0 |
| Module install, enable, nav appears, disable, API 404 (`e2e/module-plugin.spec.ts`) | pass, 5 of 5 |
| Roles and permissions (`e2e/rbac.spec.ts`) | pass, 8 of 8 |
| Admin routes, platform sweep, flow audit, product scenarios, link integrity, command palette | pass |
| Four demo landing pages render, each with its own header and a working menu link | pass |
| Demo content after install | 12 website pages, 4 landing pages, 9 landing templates, header and footer menus |
| Frontend unit and component tests | 1111 pass |
| Backend tests | 2568 pass, 3 skipped |

Open items found during verification are listed in the release report (landing pages are not reachable through
the nginx entry point, three e2e specs are out of date).
