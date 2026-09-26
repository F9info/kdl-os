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

## 2026-09-24 — ConstructionHero Content tab: native array-based slide accordions + real content/images + resolveFields panel bug fix

User asked for the Content tab's flat `d1Slide1Image`/`d1Slide1Badge`/... field wall to become
per-slide accordions (like the screenshot: "slide 1, slide 2 etc") with an "add new slide"
button after the last one and a remove option per slide, fixed (non-slide) content shown below
the accordions, and all default content/images replaced with real Subhadra material from
`/Users/f9developer/Development/subhadra/` — no more Unsplash placeholders.

**Converted all 4 Hero designs from flat `d{n}SlideN{Field}` props to Puck's native `type:
'array'` field** (same pattern as `ConstructionTestimonialsSlider`/`ConstructionProjectsSlider`,
built earlier this session) — this *is* the accordion-with-add/remove UI the user described;
no custom accordion component needed, Puck's ArrayField already renders each item collapsed
(titled via `getItemSummary`), with a drag handle, a delete icon per item, and an "Add" button
after the last one.
- `d1Slides` (full-bleed slider): `{image, badge, headline, subheadline, ctaLabel, ctaHref}[]`
- `d2Slides` (dark split hero, the currently-live design): `{dotLabel, image, lead, highlight,
  description, brands}[]` — field names deliberately kept identical to the old per-slide object
  shape already used inside the render function, so the entire ~250-line JSX body for all 4
  variants needed **zero changes** beyond swapping the manual `[{...},{...},{...}].filter(...)`
  construction for the incoming (now-array) prop, filtered the same way.
- `d3Slides` (rotating quote): `{image, quote, author, role}[]`
- `d4Slides` (fixed headline + feature slider): `{icon, title, description}[]` — `icon` reuses
  the shared `DISCIPLINE_ICON_FIELD` select (snowflake/housegear/tv/plug/fire/lightbulb) instead
  of the old one-off hardhat/shield/star options, so it matches `ConstructionDisciplinesGrid`'s
  icon picker.
Each design's own fixed/non-slide fields (d2's badge/CTA/avatars/trust-line/stats, d3/d4's
eyebrow/headline/subheadline/CTA) were reordered to sit **after** their slide array in the
`fields` object, so the panel shows accordions first, fixed content below — matching the
screenshot ("below show the fixed content editable").

**Real content, sourced only from the actual site** (`index.html`'s `.v2-hero` section — the
6-slide dark-split hero is the *only* hero design that exists on the real site):
- Copied the 6 real hero images from `subhadra/assets/images/hero-slider/*.{jpg,jpeg}` into
  `frontend/public/seed/subhadra/hero-slider/` (this project's established real-asset
  convention) — replaces the Unsplash stock photos on all 6 `d2Slides` items, and on 3 of
  `d1Slides` (reused for the full-bleed design, which has no real-site equivalent of its own).
  `d2Slides`' headline/description text already matched the site's `data-headline`/`data-desc`
  attributes verbatim from earlier this session — only the images and a few incidental strings
  needed fixing: `d2TrustText` was "1000+ businesses trust us", real copy is "1000+ businesses
  **across Andhra Pradesh** trust us"; `d2CtaLabel` gained the real arrow ("Get a Quote →");
  `d2Avatar1-3` were Unsplash headshots, now real client logos
  (`/seed/subhadra/clients/client-01/14/21.png`) matching the real trustline's `<img>` set;
  per-slide `brands` (blank before) now list the real brand names from each slide's
  `.v2-hero-brands-track` (e.g. Home Theater → "Focal\nSony\nMarantz").
- `d3Slides`/`d4Slides` have no real-site equivalent (the site only has ONE hero design) — reused
  real content already sourced elsewhere this session rather than inventing new copy: `d3Slides`
  reuses 3 of `ConstructionTestimonialsSlider`'s real client testimonials; `d4Slides` reuses 3 of
  `ConstructionDisciplinesGrid`'s real discipline blurbs (Central AC/Home Automation/Home
  Theater); `d3Headline`/`d3Subheadline` reuse the real Footer tagline ("...since 1996").
- **Did not touch** `backend/.../drivers/website-seed-content.js`'s `CONSTRUCTION_HERO_HOME` —
  that's the *generic* construction-template fallback used when scaffolding any brand-new
  project, not Subhadra-specific; putting Subhadra's real content there would be the wrong layer.
  Flagging this instead of silently skipping it, in case "make it seeder" meant something else.

**Real bug found + fixed along the way**: `blocks-panel.tsx`'s `SplitFieldEditor` builds the
Style/Content tabs by reading `config.components[type].fields` directly — it never called each
component's own `resolveFields`, so a Design-1..4 component (Hero, and presumably
Header/TopBar) showed **all 4 designs' fields at once** regardless of which `variant` was
actually selected (this is exactly why an earlier screenshot showed `d1Slide1Image` etc. even
though the selected instance was Design 2 — d1's fields just happen to be first in the object).
Fixed by calling `component.resolveFields(selectedItem, { fields: staticFields })` when present,
same as Puck's own field editor would. Verified: Content tab for the live (Design 2) instance
now shows only `d2Slides` + d2's fixed fields — no `d1Slides`/`d3Slides`/`d4Slides` leaking in.

**Migrated the live page's already-published Hero block** — its stored props still had the old
flat `d2Slide1DotLabel`/etc. shape (Puck's defaultProps-merge fills *missing* keys for `render`,
which is why the canvas already showed correct real content/images immediately after the code
deploy, but the *editor panel* reads the raw unmerged `selectedItem.props`, so `d2Slides` showed
as an empty array with no accordions until the real data existed there too). Wrote a small
Node/`pg` script (`pg` is already a backend dependency), copied into the backend container and
run once, merging the same real `d1-d4Slides` arrays + the `d2Avatar/TrustText/CtaLabel` fixes
directly into `builder_pages.data->content` for this page's `ConstructionHero` block — same
scoped-SQL-style approach as the earlier Footer fix, this time via a parameterized query (no
manual string-escaping risk with the apostrophe in one of the real testimonial quotes). Verified
via fresh page load (not just editor state) that the trustline/CTA/6 slide accordions are real.

Verified end-to-end via Playwright: canvas renders the real Blue Star hero banner image, real
"1000+ businesses across Andhra Pradesh trust us", real "Get a Quote →" with arrow; Content tab
shows 6 accordion rows titled by real dot labels (Central AC, Electrical & Switchgear, Safety
and Security, Home Automation, Home Theater, Premium Lighting) with a "+" add button below the
last one, and the fixed d2 fields (badge/CTA/avatars/trust/stats) below that.
## 2026-09-24 — ConstructionHero: Style-tab "Slider Settings" + "Typography" accordions (Slick-style controls)

User asked (after reading the Slick carousel docs at kenwheeler.github.io/slick, which I
fetched and summarized first) for the Hero slider's Style tab to expose slider behaviour
controls (arrows show/hide, dots show/hide, autoplay + speed, loop, fade-vs-slide) plus a
Typography group covering title/tagline/paragraph/button, matching Slick's settings table.

**Scope**: `ConstructionHero` only (all 4 variants: full-bleed slider, dark split hero,
rotating quote, fixed-headline slider) — the block shown in the screenshot. Not yet applied
to the other carousel blocks (`ConstructionTestimonialsSlider`, `ConstructionProjectsSlider`,
etc.); same pattern is reusable there if asked.

**New fields on `ConstructionHero`** (variant-agnostic — no `d{n}` prefix, so `variantFields`
shows them regardless of which design is selected):
- `sliderShowArrows` / `sliderShowDots` — radio Show/Hide, gate the existing prev/next + dot
  controls in all 4 variants.
- `sliderAutoplay` (radio On/Off) + `sliderAutoplaySpeed` (number, ms) — drives a single
  `setInterval` `useEffect` computed from a variant-aware `heroTotal`, called unconditionally
  before any variant branch/early return (hooks-order safety — the 4 variants used to diverge
  on `return` before any hook after `useState`, so the effect has to sit above that split).
- `sliderLoop` (radio On/Off) — when off, prev/next buttons disable (`opacity-30
  cursor-not-allowed`, `disabled` attr, guarded `onClick`) at the first/last slide instead of
  wrapping.
- `sliderTransition` (select Slide/Fade) — each variant now renders only the *active* slide
  (previously variant 1 stacked all 3 slides absolutely and cross-faded via per-slide
  `opacity`; simplified to match the other 3 variants, which already rendered only the active
  slide) with `key={idx}` + a Tailwind keyframe class (`animate-hero-fade-in` /
  `animate-hero-slide-in`, added to `tailwind.config.ts`) so switching slides replays the
  animation.
- `typoTitleSize/Weight/Color`, `typoTaglineSize/Weight/Color`, `typoParaSize/Weight/Color`,
  `typoButtonSize/Weight/Color` (12 fields) — resolved via a `typoStyle()` helper into inline
  `style` (not Tailwind classes — inline always wins over the component's own responsive
  `text-3xl md:text-5xl`-style classes, which a same-specificity utility class can't reliably
  override). Size/weight selects default to an empty string ("Default" option, added after
  first pass looked wrong — an empty value with no matching `<option>` made the browser
  visually show the *first* option ("Small") even though the real stored value was empty and
  no override was actually applied); empty means "don't touch this element's own style."

**blocks-panel.tsx**: `isStyleField()` gained `/^slider/` and `/^typo/` so these route to the
Style tab (not Content). `SplitFieldEditor` (style group only) now splits into three buckets —
general fields flat as before, then any `slider*`/`typo*` fields each in their own
`<FieldAccordion>` (native `<details open>`, no new state/dependency) titled "Slider Settings"
/ "Typography". Any block gets both accordions for free just by naming fields this way — no
per-component panel wiring needed.

Verified with a Playwright script driving the real editor (login → select Hero → Style tab):
screenshotted both accordions rendering with the "Default" fix, then drove the actual radio/
text inputs (Puck serializes radio option values as JSON strings like `{"value":true}`, so the
click target is the `<label>` wrapping the input, not the value string) — toggling
`sliderShowArrows`/`sliderShowDots` to Hide removed the prev/next buttons and dot row from the
canvas (arrow button count 1→0), and setting `typoTitleColor` to `#00aa55` changed the live H1
`getComputedStyle(...).color` to `rgb(0, 170, 85)`. Did not click Publish — nothing persisted
to Postgres, this was editor-behavior verification only.

**Housekeeping**: trimmed `.agents/HANDOFF.md`'s 2026-09-24 window from 14 entries down to 8
(the instructed ~8-entry cap wasn't being enforced through the rest of this long session) —
moved "Featured Projects slider inserted" through "Tagline Strip section added" (7 entries) into
`.agents/HANDOFF_ARCHIVE.md`.

