# Inner Banner block — design spec

Date: 2026-09-26
Status: approved (pending final spec read-through)

## Problem

Every inner page (About, Products & Services, Sectors, Contact, work-*, sector-*) on the
reference site (`after-delete-folder/*.html`) opens with the same `.page-banner` section:
full-bleed photo, dark overlay, `Home / <Current>` breadcrumb, an `<h1>`, and a one-line
subtitle. The page-builder has no equivalent block yet — Hero Slider (`ConstructionHero`)
only covers the home page's top hero.

Need a new "Inner Banner" block, purchasable from the Section tab like any other, with 4
selectable designs (Odoo-style "Design 1-4" picker, same UX as Hero Slider). Its `<h1>` (and
breadcrumb "current" label) must track whatever page it's placed on — an editor should never
have to manually retype the page's own title into the block.

## Reference material

`after-delete-folder/about.html` (and identically: `contact.html`, `sectors.html`,
`services.html`, every `work-*.html`, every `sector-*.html`) — all share one `.page-banner`
markup:

```html
<section class="page-banner">
  <div class="page-banner-media"><img src="…" style="object-position:center 72%;"></div>
  <div class="container-fluid">
    <nav class="breadcrumb"><a href="index.html">Home</a><span class="sep">/</span><span class="current">About</span></nav>
    <h1>About Us</h1>
    <p>Your one-stop solution for building engineering products &amp; services — 30 years of trust, one accountable team.</p>
  </div>
</section>
```

The real site has only ONE inner-banner design across every page — unlike Hero Slider, there
is no second/third/fourth reference design to lift for variants 2-4. Per user decision,
those three are new creative alternates (same precedent as `ConstructionHero`'s own designs
1/3/4, which aren't 1:1 site clones either).

## Decisions (confirmed with user)

1. **Variant 1** = pixel-match of the reference `.page-banner` above. **Variants 2-4** are
   new designs I create (not sourced from the reference site).
2. **Dynamic title**: the block's `<h1>` reads the current page's real `title` (the same
   value already used for `headerTitle={page.title}` in the editor and shown at
   `/p/<slug>`) via Puck's `metadata` prop — not a hardcoded per-block field, not a
   slug-to-text transform. This is the *first* use of Puck's `metadata` prop anywhere in
   this repo; wiring it in is part of this change.
3. **Breadcrumb "current" label** uses the same dynamic value as the `<h1>` (no separate
   editable field, even though the reference site's breadcrumb text is sometimes shorter
   than the `<h1>`, e.g. "About" vs "About Us").
4. **Category placement**: new "Inner Banner" category sits right after "Welcome" in the
   Section tab list (per user: "it is different section... place after welcome section").

## Component design

### Registration (`frontend/src/app/admin/page-builder/packs/construction/index.tsx`)

- New component key: `ConstructionInnerBanner`.
- New category: `innerbanner: { title: 'Inner Banner', components: ['ConstructionInnerBanner'] }`,
  added to this pack's `typedCategories`.
- `construction.variants.ConstructionInnerBanner = ['1', '2', '3', '4']` (drives the
  Insert-block modal's per-design preview cards, same as `ConstructionHero`).

### `frontend/src/app/admin/page-builder/puck.config.tsx`

- `CATEGORY_ORDER`: insert `'innerbanner'` immediately after `'welcome'`.

### Fields (shared across all 4 variants — same underlying content, different layout only)

| Field | Type | Notes |
|---|---|---|
| `variant` | `select` | `'1' \| '2' \| '3' \| '4'`, labelled "Design N — …" like `ConstructionHero` |
| `visible` | `radio` (Show/Hide) | matches existing show/hide convention |
| `backgroundImage` | `imageField('Background image')` (shared helper) | default: a placeholder construction/office photo |
| `imageAlt` | `text` | alt text |
| `subtitle` | `textarea` field (Fields panel) **+** rendered via `InlineEditableText` on canvas (`packs/inline-editable-text.tsx`, the newest editing pattern in this pack) | per-page descriptive sentence — can't be derived, stays editable |

Not fields (computed, not stored on the block):
- `<h1>` text — always `puck?.metadata?.pageTitle`.
- Breadcrumb "current" text — same value as the `<h1>`.
- Breadcrumb "Home" link — hardcoded label `"Home"` / `href="/"` (matches every reference
  page; not worth a field, no page varies it).

### Metadata plumbing (new)

- `frontend/src/app/admin/template-engine/edit/[id]/page.tsx`: `<Puck metadata={{ pageTitle: page.title }} .../>` (page is already loaded here; `page.title` already feeds `headerTitle`).
- `frontend/src/app/p/[slug]/page.tsx`: `<Render metadata={{ pageTitle: page.title }} .../>`.
- `ConstructionInnerBanner`'s render destructures `puck` and reads
  `puck?.metadata?.pageTitle ?? 'Page Title'`. The `?? 'Page Title'` fallback matters: the
  Insert-block modal's preview cards (`insert-block-modal.tsx` `BlockCard`) call
  `comp.render(props)` directly, outside any `<Puck>`/`<Render>` tree, so `props.puck` is
  `undefined` there today (true for every existing component) — this must not crash.

### The 4 designs

1. **Design 1 — Full-bleed photo** (reference clone): background image, bottom-aligned dark
   gradient overlay, `container-fluid`-width content block bottom-left: breadcrumb, `<h1>`
   (bold white), subtitle paragraph.
2. **Design 2 — Split card**: image right half (rounded), solid dark-navy panel left half
   holding breadcrumb + `<h1>` + subtitle + a thin accent rule — same visual family as
   `ConstructionHero` design 2's dark panel.
3. **Design 3 — Compact centered strip**: no photo, solid gradient background, shorter
   height, centered breadcrumb + `<h1>` + subtitle. For pages that want a lighter banner.
4. **Design 4 — Frosted glass card over photo**: full-bleed image, no dark gradient; a
   semi-transparent light "glass" card floats bottom-left holding breadcrumb + `<h1>` +
   subtitle — modern alternate treatment, image stays fully visible elsewhere.

All four are plain Tailwind utility JSX (matching every other component in this file — no
new CSS files).

## Out of scope

- No new Prisma fields/migrations — reuses the existing `Page.title`/`slug` already in the
  DB and already fetched by both surfaces.
- No unit tests for the render component — zero existing precedent for testing any
  declarative pack component in `packs/construction/index.tsx` (or `general`/`medical`);
  matching that convention rather than introducing a one-off exception.
- No new field for a "short breadcrumb label" — rejected per decision #3 above.
- Not touching the unrelated empty `frontend/src/app/p/[slug] 2/` directory noticed during
  investigation (pre-existing, unrelated leftover).

## Files touched

- `frontend/src/app/admin/page-builder/packs/construction/index.tsx` (new Props fields, category, component, variants map entry)
- `frontend/src/app/admin/page-builder/puck.config.tsx` (`CATEGORY_ORDER`)
- `frontend/src/app/admin/template-engine/edit/[id]/page.tsx` (`metadata` prop)
- `frontend/src/app/p/[slug]/page.tsx` (`metadata` prop)
