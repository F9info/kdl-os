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

## 2026-09-26 — About page fully rebuilt with real content (Phase 1 of the full-site KDL-dynamic rebuild)

User's ask: rebuild the whole approved Subhadra Group HTML mockup (`after-delete-folder/`) inside
KDL Kit's dynamic architecture — header, home page, every inner page, fields, theme engine,
palette, website settings/layout, section builder, and a review of the whole
Settings→Fields→Theme→Intake→Palette→Website Settings→Layout→Section Builder→Inserts→Rendering
flow. That's 8+ subsystems in one ask — too large for one pass, so with the user's confirmation
this session did **Phase 1 only: the About page**, chosen because it's the smallest slice that
proves the approach end-to-end before repeating it for Contact/Sectors/Services/work-*.

**Before this session**, every inner page (About included) was still generic scaffold content —
`NavBar` (general pack, not the real header) + generic `Hero` "Welcome" copy + `Text` +
`ConstructionSafetyRecord` + `Footer`. Confirmed via direct DB read, not assumed.

**Section-by-section map against the real `about.html` body:**

| Section | Outcome |
| --- | --- |
| Header | swapped generic `NavBar` for the real `ConstructionHeader` (variant 1) — same instance data as Home |
| Page banner | `ConstructionInnerBanner` (this session, earlier) |
| "Who we are" | `ConstructionAboutSplit` — real 3-paragraph copy, real photo/badge (already-seeded) |
| Stats band | `ConstructionStatsStrip` — real values (30+/15/1 Lakh+/24×7), was generic ₹500 Cr+ placeholder |
| Founder Profile | **new** `ConstructionFounderProfile` — 2-person alternating photo/bio cards; no existing component fit (1-person-quote and 3-card-grid don't match) |
| "One shop for all industries" | **new** `ConstructionSectorsRadial` — center logo + numbered 11-sector chevron list; nothing like it existed |
| Mission & Vision | **new** `ConstructionMissionVision` — 2 alternating icon-badge cards; nothing like it existed |
| "Our Journey" | extended `ConstructionTimelineHistory` from 4 text-only entries to 7 entries + a per-entry image field (real 1996→Today milestones, was 4 generic placeholder ones) |
| Lead-form CTA | reused `ConstructionLeadFormFAQ` as-is, `faqs: []` (about.html has no FAQ there) |
| Clients grid | reused `ConstructionClientsGrid`, copied Home's real 39-client instance verbatim |
| Footer | swapped in the real `ConstructionFooter` (variant 1) — same instance as Home |

New images seeded: `founder.png`, `products/director.png`, `inside.webp`, `brand/shop.webp`
(the last already added for Inner Banner).

**Real bug found and fixed along the way**: this app's public pages are served at generated
`/p/te-<runid>-<slug>` paths, not clean `/about`/`/sectors`/`/` routes. `ConstructionInnerBanner`
hardcoded its breadcrumb's "Home" link to `href="/"` — 404 on every real page. Added a
`homeHref` field (defaults to `/` so nothing already published silently changes) and set it to
the real Home slug on this page's instance. Also caught the same class of mistake in my own new
content (`ConstructionSectorsRadial`'s sector links, `ConstructionAboutSplit`'s brochureHref) —
fixed those to the real slugs too before final publish.

**Content was written directly via `PUT /page-builder/:id`**, not by clicking through the editor
— faster for ~150 field values across 12 blocks. Caveat for next agent, **verified empirically,
not just assumed** (published a throwaway block with only `{id}` on a scratch Untitled page and
loaded the real public `/p/<slug>` route — body was completely empty, confirmed via
Playwright's `page.inner_text('body')` returning `''`, then also traced the actual mechanism in
`node_modules/@puckeditor/core/dist/index.js`: the public render path is `Render` →
`DropZoneRenderItem` → `useSlots`/`useFieldTransforms`, which passes `item.props` straight
through with **no `defaultProps` merge anywhere in that chain**):

> **`defaultProps` only merge into what's missing when a block is inserted through the editor UI
> (`insertBlockComponent` in `insert-block-modal.tsx`) or viewed live inside `<Puck>`'s own
> editing canvas** (that path — `componentConfig.defaultProps` spread under `item.props`, tagged
> `editMode: true // DEPRECATED` in the bundle — is editor-only). **The public `<Render>` output
> at `/p/<slug>` never applies a component's `defaultProps` to already-stored content** — any
> field missing from a block's saved `props` renders as empty/undefined there, full stop.
>
> **This corrects the 2026-09-24 entry below** ("ConstructionHero Content tab..." /
> Testimonials Slider `sectionEyebrow` note) — that note's "confirmed Puck merges a component's
> `defaultProps` into whatever's missing... at render time" was only ever true for the *editor
> canvas*, generalized too far. Any already-published page relying on a field added to a
> component *after* that page was last saved will show that field blank on the real public site,
> even though it looked fine in the editor. If a component gains a new field, re-save (publish)
> every page that already uses it, don't assume it back-fills.

Caught the raw-write version of this mistake once already this session (an empty
`ConstructionClientsGrid` block, `{id}` only) before publishing — copied Home's real instance
verbatim to fix it.

**Verified live** (not just `pnpm build`): full Playwright screenshot pass through the entire
published `/p/te-...-about` page (scrolled top to bottom) AND the real Puck editor canvas for
this page — both match, no console errors beyond a known pre-existing `429` from this session's
heavy repeated test-login traffic (see `dev-rate-limit-friction` memory: `docker compose restart
backend` if it starts blocking real logins) and an unrelated font-CSP warning.

**Still open from the original ask** (deliberately deferred, not forgotten):
- Contact, Sectors, Services, work-*, sector-* pages — still generic scaffold content, same
  treatment needed as About.
- Settings→Fields audit (what's missing/duplicated).
- Theme Engine / Palette configuration pass (currently Tailwind utility classes hardcoded per
  component, not driven by theme tokens).
- Website Settings / Website Layout review.
- `ConstructionMissionVision`'s icon badge is a plain lucide icon circle, not the reference's
  decorative ring SVG (dashed dots + partial arc) — flagged as a known simplification in the
  component's own comment.
- `ConstructionFounderProfile`'s "Read More" links point to `#` — no leadership/bio page exists
  yet in this project to link to.

## 2026-09-26 — Inner Banner block: 4 designs, dynamic page-title via new Puck `metadata` wiring

Added `ConstructionInnerBanner` (Section tab: "Inner Banner", placed right after "Welcome") —
Design 1 is a pixel clone of the reference site's `.page-banner` (about.html et al: full-bleed
photo, dark overlay, breadcrumb, `<h1>`, subtitle). Designs 2-4 are new alternates (split card /
compact centered strip / frosted-glass-over-photo) — the real site only has one inner-banner
design, so unlike Hero Slider there was no second/third/fourth reference to copy.

The `<h1>` and breadcrumb "current" label are never a per-block field — they always read
`puck.metadata.pageTitle`, the first use of Puck's `metadata` prop anywhere in this repo. Wired
into both `template-engine/edit/[id]/page.tsx` (`<Puck metadata={{ pageTitle: page.title }}>`)
and `p/[slug]/page.tsx` (`<Render metadata={{ pageTitle: page.title }}>`) — both already loaded
`page.title` for other purposes (`headerTitle`), just hadn't threaded it into block props before.

Insert-modal preview cards call `comp.render(props)` directly outside any `<Puck>`/`<Render>`
tree (see `insert-block-modal.tsx` `BlockCard`), so `props.puck` is `undefined` there — the
render function falls back to the literal string `'Page Title'` in that case (verified: modal
cards show "Page Title", a real inserted block on the Home page showed "Home", a real inserted
block on the About page showed "About" — both in the editor canvas and on the published
`/p/<slug>` route).

Verified live against the actual docker stack, not just `pnpm build`: the `frontend` container
runs a standalone `next start` build baked into its image at `docker build` time — no source
bind-mount, so **editing files here does nothing to `localhost:3101` until `docker compose
build frontend && docker compose up -d frontend` is run.** Cost real time this session (first
verification attempt showed the category missing entirely because the running container was
still serving the pre-existing image). Test insertions used for verification (Home + About
pages) were removed again via a direct `PUT /page-builder/:id` afterward — real project content
is unchanged from before this task.

Also found and fixed in passing: two `<a href="/">` in the new component tripped
`@next/next/no-html-link-for-pages` (blocking, not a warning) — switched to `next/link`'s
`Link`. First `git add` touching `packs/construction/index.tsx` and `edit/[id]/page.tsx` this
session triggered a full `prettier --write`/`eslint --fix` reformat of those files via the
pre-commit hook (they apparently were never run through it before) — large diffs, cosmetic
only, verified via `tsc --noEmit` before and after. Both files also carried pre-existing
uncommitted changes from earlier in this session that got swept into these same commits
(nothing lost, just coarser commit attribution than the messages describe).

Design spec: `docs/superpowers/specs/2026-09-26-inner-banner-design.md`.
Plan: `docs/superpowers/plans/2026-09-26-inner-banner.md`.

## 2026-09-24 — Hero brand logos: nested array field (multi-upload + reorder), real logos from index.html

User's screenshot showed the Hero's per-slide "Brands" row as plain text chips ("Schneider
Electric", "RR Kabel", ...) instead of real logo images like the reference site, and asked for
"multiple upload image option and change the order of brands" plus real logos/content copied
directly from `/Users/f9developer/Development/subhadra`.

**`d2Slides[].brands` converted from a newline-separated textarea to a nested Puck array field**
(`{name, logo}[]`, `logo` via the existing `imageField()` helper) — Puck's `arrayFields` values
can themselves be `type: 'array'`, so this is a plain array-inside-array, no new field-type work
needed. This is what gives "multiple upload" (an Upload button per brand row, add as many as
needed via the array's own "+" button) and "change the order" (array items are natively
drag-reorderable, same as the slide accordions from the previous entry) for free.

**Render** (`d2Slide.brands.map(...)`) now renders a real `<img>` per brand in a white
rounded chip (`bg-white rounded-lg ... object-contain`) when `logo` is set, falling back to a
plain text chip when it isn't — same `logo ? <img> : <span>` pattern already used by
`ConstructionOurBrands`/`ConstructionProjectsSlider` elsewhere in this file.

**Real logos**, one per brand, sourced from the exact files already copied into
`frontend/public/seed/subhadra/ourbrands/{electrical-products,design-execution-maintenance,
lifestyle-residential-products}/` earlier this session (from `subhadra/assets/images/ourbrands/`)
— matched against `index.html`'s `.v2-hero-brands-track` markup (`data-track="0"` through `"5"`,
one track per hero slide) so each slide's brand row is the *exact* real set: Central AC → Blue
Star; Electrical & Switchgear → Schneider Electric, RR Kabel, Crompton, Norisys, Cummins, APC;
Safety and Security → CP Plus, Honeywell, Ravel, Bosch, Ajax, Matrix; Home Automation →
Schneider Electric, Bticino, RTI, Toyama, eelectron; Home Theater → M&K Sound, Focal, Sony,
Optoma, SVS, Marantz; Premium Lighting → Futura, Wipro. Paths use `%20`/`%26` encoding for
spaces/`&` in filenames, matching the existing convention already used for this same folder
elsewhere in the file (`ConstructionOurBrands`). Verified all 25 referenced files actually exist
on disk (not just assumed from the earlier copy) and that the live canvas renders a real white
logo chip with no broken `<img>` (checked `naturalWidth === 0` on the mounted slide).

Migrated the live page's already-published Hero block's `d2Slides[].brands` via the same
Node/`pg` script pattern as the previous entry (panel reads raw stored props, not
defaultProps-merged render output). Also found and fixed an unrelated leftover: this project's
`sliderShowArrows`/`sliderShowDots` were `false` in the live DB — an artifact from this
session's own earlier interactive Style-tab testing that apparently got persisted at some point
without an explicit Publish being noticed; reset both back to `true` (the correct default) via
a scoped SQL patch, same pre-established pattern as the Footer fix.

