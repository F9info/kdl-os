# Construction Pack Homepage — Design

## Problem

The user provided a detailed 16-part homepage brief (sticky header, hero
slider, stats strip, alternating offerings, about, process, sectors,
featured project, products showcase, why-choose-us, clients, testimonials,
lead-form+FAQ, tagline strip, 4-column footer, floating actions) for an
industrial/B2B company — logo + real nav labels, everything else
dummy/placeholder content and `https://placehold.co` images.

An existing `construction` Puck pack
(`frontend/src/app/admin/page-builder/packs/construction/index.tsx`, 1387
lines, 11 components) already exists from an earlier phase, matches the
same industry, but was never wired to real seed content
(`backend/.../drivers/website-seed-content.js`'s `seedConstructionPageData`
exists but isn't reachable from the live Templates flow yet). Confirmed by
direct read: roughly a third of its components already match the new
brief closely; the rest need real rework or don't exist yet.

## Goal

A complete, real "Home" page for the `construction` pack, built entirely
from Puck components in that pack (reusing/adapting the ~5 that already
fit, adding the rest), seeded as static starter content via
`seedConstructionPageData` so it's committed to the repo and reproducible
— not something built once by hand in the Puck editor.

## Scope

**In scope:** every section in the user's brief, as Puck components in
`packs/construction/index.tsx`, wired into `seedConstructionPageData` with
dummy copy + `placehold.co` images for everything except the logo (from
the project's brand kit, same as every other seeded page) and nav labels
(Home, About, Products, Services, Sectors, Contact — real, per the brief).

**Out of scope:**
- Wiring this to the live Templates-step UI (the pack-selection UI was
  removed per earlier session notes; `seedConstructionPageData` stays
  reachable the same way `seedMedicalPageData` currently is — via
  `SEEDER_BY_PACK`, an internal driver detail, not a new user-facing
  toggle). If the user wants a real "pick construction pack" UI control,
  that's a separate follow-up.
- Real client logos/testimonials/company facts — dummy/generic per the
  brief's own explicit instruction.
- Bootstrap Icons and the AOS library — user confirmed inline SVG icons
  (this pack's existing convention) and a small IntersectionObserver-based
  scroll-reveal hook instead, per the locked tech stack.
- Changing any of the ~5 already-matching components' prop *shape* —
  only their seeded default *values* change (they get real dummy copy
  instead of whatever placeholder text they currently ship with).
- About/Services/Sectors/Contact pages' own content — this spec covers
  the Home page only. Other pages keep using the generic per-page
  fallback content already fixed earlier this session.

## Architecture

### Component plan (all in `packs/construction/index.tsx`)

**Reuse as-is (new seeded values only, no code change to shape):**
- `ConstructionStatsStrip` → Stats strip (§2)
- `ConstructionProcessTimeline` → How We Work (§5)
- `ConstructionWhyChooseUs` → Why Choose Us (§9)

**Adapt (existing component, real shape change):**
- `ConstructionHero` → Hero (§1): add badge text, one gradient-highlighted
  word span in the headline, a trust-avatar row (3 flat avatar-image
  fields + client count text), and a right-side slide array (flat
  `slide1Image`/`slide1Tag`/`slide1Title`/`slide1Subtitle` ×
  5, matching this pack's established per-item-field convention) with
  dot navigation. Becomes a two-column split (text left, slider right)
  instead of centered-over-full-bleed-image.
- `ConstructionProjectGallery` → Sectors grid (§6): add a numbered tag
  overlay, a one-line description field per item, a dark gradient
  overlay on the image, and an `href` per card (anchors on a future
  sectors page — out of scope, so a plain `#sector-n` placeholder).
  8 items instead of 6 (2 more flat item-field groups).
- `ConstructionTestimonials` → Testimonials (§11): add a star-rating
  (fixed 5, matches "do not invent facts") and an avatar-initials circle
  per quote; keep the flat 3-quote shape.

**Build new (no existing component fits):**
- `ConstructionHeader` — sticky header: logo left, center nav (flat
  link fields matching `NavBar`'s pipe-delimited-lines convention so it's
  consistent with the rest of the app), right side Login (outline) +
  Get a Quote (primary) buttons, a hamburger toggling a slide-out mobile
  panel (same links + both buttons). Client component (`'use client'`
  Puck components already exist elsewhere in this app, e.g.
  `BlockComposer`) since it needs open/close state — first *stateful*
  component in this pack; every other one is a pure render function.
- `ConstructionOfferingsRows` — Core Offerings (§3): 3 flat item groups,
  each `{numberTag, image, heading, description, brandNames, href}`,
  alternating image-left/image-right by index parity (no per-item field
  needed for that — it's a `i % 2` render-time decision, matching how
  `ConstructionProjectGallery`'s `.map` already works).
- `ConstructionAboutSplit` — About (§4): photo + circular badge overlay
  (big number + label, 2 flat fields), eyebrow, heading, paragraph, 3-item
  checklist (flat `check1Text`/`check2Text`/`check3Text`), a
  "Download Brochure" button (`href` only — no real file, per "dummy
  content" instruction; points at `#`).
- `ConstructionFeaturedProject` — Featured Project (§7): heading, image,
  paragraph, 4 flat scope-tag fields (icon choice from a small fixed
  enum matching this pack's existing `select` field pattern, e.g.
  Certifications' badge fields), a text link + a primary CTA button.
- `ConstructionProductsShowcase` — Products (§8): flat category-tab
  labels (up to 4) + flat per-product fields tagged by category index
  (`product1Category`/`product1Icon`/`product1Title`/.../`product8...`),
  client-side tab-filter state (second stateful component).
- `ConstructionClientsGrid` — Clients (§10): flat per-client
  `logo`/`name` fields (up to 12, paginated 6-per-page client-side —
  third stateful component), dot pagination.
- `ConstructionLeadFormFAQ` — Lead form + FAQ (§12): left = flat 6-item
  FAQ accordion (`faq1Question`/`faq1Answer`/...), client-side
  expand/collapse state; right = a **display-only** mock form (Name,
  Phone, Email, an interests `select`, a contact-preference `radio`
  pair, optional message `textarea`, disabled/no-op submit button) — no
  real submission handler exists in this app for arbitrary lead capture,
  so the form is intentionally inert (matches "dummy" — a real backend
  endpoint is a separate, much bigger feature this brief doesn't ask
  for). This gets called out explicitly in the plan so it isn't
  mistaken for an oversight.
- `ConstructionTaglineStrip` — Tagline strip (§13): logo + one line,
  dark full-width band. Trivial.
- `ConstructionFooter` — Footer (§14): 4 columns (brand/tagline/social/
  newsletter-input-inert, Company links, Contact list, Showroom address +
  QR placeholder image), bottom copyright bar. Newsletter input is
  inert for the same reason the lead form is — no backend endpoint to
  wire it to.
- `ConstructionFloatingActions` — floating WhatsApp + back-to-top
  (§ floating). Fixed-position, `position: fixed` at the page-content
  level — same stacking-context consideration already solved once this
  session (Custom Block Composer's portal fix) applies here too: confirm
  during implementation whether these need a portal to escape any
  ancestor stacking context, or whether the public page-render tree
  (`app/p/[slug]/page.tsx`) is simple enough that plain `fixed` works.

### Scroll-reveal

One small shared hook (`useScrollReveal` or similar, colocated in
`packs/construction/index.tsx` alongside the pack's other shared
helpers like `padY`/`wrap`) using `IntersectionObserver` to add a
fade-up class on first intersection. Applied per-section inside each
new component's own render — no wrapper component needed, no new
dependency.

### Seeding wiring

`seedConstructionPageData(pageKey, pageTitle, brand, pages)` in
`website-seed-content.js` gets a real Home-page content array (all the
components above, in brief order) replacing whatever minimal/placeholder
wiring exists today. `CONSTRUCTION_HERO_BY_KEY`/`CONSTRUCTION_MIDDLE_BY_KEY`
and the generic-fallback functions added earlier this session
(`genericConstructionHero`/`genericMiddle`) are untouched — this only
changes what `'home'` specifically seeds with; About/Contact/other pages
keep their existing (already-fixed) generic fallback.

Real content (logo, nav labels) comes from the same `resolveWebsiteBrand`
+ `seedPages` inputs every other seeder already receives — no new plumbing
needed there.

## Testing

- Existing pattern: no dedicated test file for `website-seed-content.js`
  or the Puck packs themselves (confirmed — none exists today). The
  plan will follow the SAME convention already established this session
  for driver-level changes: extend `backend/.../drivers/website.driver.test.js`
  with assertions that `seedConstructionPageData('home', ..., seedPages)`
  produces the expected block types/count, rather than testing each new
  Puck component in isolation (no RTL test infra exists for `packs/`
  components either — confirmed via `find frontend/tests -iname
  "*construction*"` returning nothing).
- Manual Playwright verification per task: rebuild frontend, seed a
  fresh project through the construction pack, screenshot the live
  `/p/[slug]` public render at mobile/tablet/desktop widths, confirm
  each section renders, confirm the header's mobile slide-out and the
  products/clients/FAQ interactive pieces actually work in a real
  browser (not just typecheck).
- `pnpm lint` / `npx tsc --noEmit` clean, matching every other task this
  session.

## Risks / Notes

- This is the single largest build in this session — 10 new components,
  3 adapted, 1 large seed-content function. The plan will break it into
  one task per component (or tightly-related pair) for
  subagent-driven-development, same granularity as the Custom Block
  Composer plan.
- Puck's flat-per-item-field convention (no true repeaters) means some
  of these components carry a LOT of individual props (Products: 8 items
  × ~4 fields = 32+ fields, Clients: 12 × 2 = 24 fields). This is
  consistent with the existing pack's own established pattern
  (Certifications already has 6×2=12), just at the higher end of it —
  not a new problem being introduced, an existing one being extended.
- The lead-capture form and newsletter signup being genuinely inert
  (no submit handler) is a deliberate scope boundary, not an oversight —
  called out here so it doesn't get flagged as an incomplete feature
  later. Wiring a real lead-capture backend is a separate, much larger
  feature this brief didn't request.
