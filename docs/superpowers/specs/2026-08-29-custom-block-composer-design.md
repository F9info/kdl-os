# Custom Block Composer (Phase 1) — Design

Date: 2026-08-29
Status: Approved

## Problem

The Insert-a-block modal (`frontend/src/app/admin/page-builder/insert-block-modal.tsx`) only
offers blocks that already exist as compiled Puck components — a fixed set of hand-authored
designs per category. There is no way for a user to compose their own block from smaller parts
(à la Odoo's page builder) and reuse it across pages in a project.

Reference: `/Users/f9developer/Desktop/headerBuilder.html` — a standalone prototype of a
config-driven header composer (palette + live canvas + layer list + Content/Layout/Style/
Responsive tabs + a save/reuse template library). It only defines atoms for the header category;
this spec generalizes the *engine* to every category and ships one shared atom set. Richer,
category-specific atom catalogues (starting with Header's logo/nav/search/social/etc., matching
the reference closely) are an explicit Phase 2+, not this spec.

## Goal

Every category in the Insert-a-block modal gets a "+ Create new" card after its built-in
designs. Clicking it opens a full-screen visual composer — drag/click atoms onto a live canvas,
edit their content/layout/style, save as a reusable block. Saved blocks show up as extra cards
in that category's grid from then on, for that project only.

## Scope (Phase 1)

- Generic composer engine (palette, canvas, layer list, tabs, save) — category-agnostic.
- One universal atom set, available in every category: Heading, Text, Image, Button, Spacer,
  Icon.
- Project-scoped persistence: save, list, edit, duplicate, rename, delete, set-default.
- Insert-a-block modal wiring: create card, list custom blocks alongside built-in designs.

Out of scope for this spec: Header's rich atom catalogue (logo/nav/social/topbar/announcement/
etc.) and any other category-specific atom set — separate follow-on spec each, once requested.

## Rendering architecture

Puck registers components statically at build time (`Config['components']`) — it cannot load
user-composed code at runtime, so a custom block can't become a new compiled component. Instead,
one generic Puck component, `CustomComposedBlock`, is registered once; every saved custom block
is an *instance* of it with a different `config` prop:

```ts
type CustomBlockConfig = {
  category: string                    // e.g. 'medical-hero' — which atom catalogue applies
  atoms: Array<{
    id: string
    type: string                      // 'heading' | 'text' | 'image' | 'button' | 'spacer' | 'icon'
    hideMobile?: boolean
    [prop: string]: unknown           // atom-specific props (text, src, href, size, ...)
  }>
  settings: {
    container: 'full' | 'boxed'
    padding: 'sm' | 'md' | 'lg'
    align: 'left' | 'center' | 'right'
    bg: string                        // hex or '' for none
  }
}
```

`CustomComposedBlock.render(props: { config: CustomBlockConfig })` calls one shared interpreter,
`renderComposedBlock(config)` (new file `packs/composer/render-composed-block.tsx`) — a direct
port of the reference's `renderHeader(cfg, viewport, opts)` pattern: walks `config.atoms`, looks
up each atom's `Render` function from the active category's atom catalogue, applies
`config.settings` as the wrapping container's layout/style. This same function powers the
composer's own live canvas (interactive mode: each atom wrapped for click-to-select) and the
Insert-a-block modal's card preview (reusing the existing `liveThumb`-style scaled-render
technique already built for other blocks).

## Atom system

`packs/composer/atoms/universal.ts` exports the Phase 1 catalogue — one entry per atom, each
`{type, label, icon, defaultProps, Field, Render}`:

| Atom | Wraps | Content field(s) |
|---|---|---|
| Heading | `general` pack's `Heading` render | text, level (1-3), align |
| Text | `general` pack's `Text` render | text, align, muted |
| Image | `general` pack's `Image` render | src, alt, rounded |
| Button | `general` pack's `Button` render | label, href, variant |
| Spacer | `general` pack's `Spacer` render | size |
| Icon | new (small) | lucide icon name (picker), size, color |

`Render(props)` for the first five atoms calls the general pack's existing render function
directly (import + call, not JSX composition) — no duplicated markup. `Field` is a small React
component rendering that atom's Content-tab form (text input, url input, select, etc.) — same
shape as Puck's own field components, but standalone (the composer isn't inside Puck's field
pipeline).

Every category's `atomCatalogue` is `universal` in Phase 1 — a category-to-catalogue lookup
(`packs/composer/catalogue-by-category.ts`, defaulting every key to `universal`) is the seam
Phase 2 extends per category, so adding a richer catalogue later never touches the composer
engine.

## Composer UI

New route-less full-screen overlay (same `fixed inset-0 z-[2000]` pattern as
`InsertBlockModal`, just larger — effectively full viewport), new file
`frontend/src/app/admin/page-builder/composer/BlockComposer.tsx`.

**Top bar:** name input, viewport switch (desktop/tablet/mobile — reuses the width presets
already passed to `<Puck viewports={...}>`), Save (draft) / Publish.

**Left column:** atom palette for the active category (click-to-add; drag-to-add is a stretch
goal, click-to-add is the baseline this spec commits to) + layer list — one row per atom,
drag handle (native HTML5 DnD, `draggable` + `dragstart`/`dragover`/`drop`, no new dependency)
to reorder, click to select, remove button.

**Center column:** live canvas rendering `renderComposedBlock(config)` in interactive mode —
each atom wrapped in a selectable node (click → select, matching `.hb-node`/`.hb-toolbar` in the
reference: an inline floating toolbar with move-up/down, duplicate, delete). Device-width frame
matches the viewport switch selection.

**Right column:** tabs —
- **Content** — selected atom's `Field` component. Empty state ("Pick a component from Layers,
  or add one from the palette") when nothing selected, matching the reference.
- **Layout** — `settings.container` / `settings.padding` / `settings.align` (block-level).
- **Style** — `settings.bg` (color swatches, matching the reference's swatch row).
- **Responsive** — `hideMobile` toggle for the selected atom.

State management: local component state (`useState`) for the in-progress `CustomBlockConfig` +
`selectedAtomId` + `viewport` + `rightTab` — no global store needed, this is a self-contained
editor over one JSON value, same shape as the reference's `state.editing`.

## Persistence

New Prisma model, `backend/prisma/schema/custom-block.prisma`:

```prisma
model CustomBlockTemplate {
  id           String   @id @default(cuid())
  project_id   String
  category_key String
  name         String
  description  String?
  status       CustomBlockStatus @default(DRAFT)
  is_default   Boolean  @default(false)
  config       Json
  created_by   String
  deleted_at   DateTime?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  @@index([project_id, category_key])
  @@map("custom_block_templates")
}

enum CustomBlockStatus {
  DRAFT
  PUBLISHED
}
```

New backend module `backend/src/modules/custom-blocks/` (routes → controller → service →
schema, following the `page-builder` module pattern exactly):

- `GET /custom-blocks?projectId=&category=` — list (excludes soft-deleted).
- `POST /custom-blocks` — create `{projectId, categoryKey, name, description, status, config}`.
- `PUT /custom-blocks/:id` — update (name/description/status/config).
- `POST /custom-blocks/:id/duplicate` — clone with a new id, `name + " Copy"`, status `DRAFT`.
- `POST /custom-blocks/:id/set-default` — clears `is_default` on siblings in the same
  `(project_id, category_key)`, sets it on this one.
- `DELETE /custom-blocks/:id` — soft delete (`deleted_at`).

RBAC: reuses `requirePermission('page-builder', ...)` (`view`/`add`/`edit`/`delete`) — no new
permission rows, same rationale as the site-layout spec. Every mutation calls
`writeActivityAsync` (module `'custom-blocks'`), matching the page-builder service pattern.

## Insert-a-block modal wiring

`insert-block-modal.tsx`'s card grid (`BlockCard` list per category) gets one more query:
`GET /custom-blocks?projectId=&category=<active category key>`, rendered as extra cards after
the built-in `blockVariants` cards, using `CustomComposedBlock` + the same scaled-preview
technique. A dashed "+ Create new" card (matching the reference's `.createcard`) is always last.

Clicking an existing custom-block card inserts it (same two-dispatch `insert` + `replace`
pattern already used for built-in variants, `componentType: 'CustomComposedBlock'`,
`props: { config }`). Clicking its own small ⋮ menu (Edit / Duplicate / Rename / Set default /
Delete) either reopens `BlockComposer` pre-loaded with that config, or calls the matching API
directly (duplicate/rename/set-default/delete don't need the composer open).

`projectId` is already threaded through `template-engine/edit/[id]/page.tsx` via the
`?projectId=` query param (same one `InsertBlockButton`'s host page already reads for the Back
link) — passed down to `InsertBlockModal` as a new prop. The plain `/admin/page-builder/[id]`
editor has no project concept and is already noted in its own source comment as
"slated for removal" — it doesn't get the "+ Create new" card at all in Phase 1 (no degraded
in-memory mode to maintain on a UI that's going away); `InsertBlockModal` renders the create
card only when a `projectId` prop is present.

## Testing

- Backend: `custom-blocks` module gets its own `*.test.js` per route (list/create/update/
  duplicate/set-default/delete), following the `page-builder` test file shape.
- Frontend: `renderComposedBlock` gets a unit test per atom type (renders without throwing,
  respects `hideMobile`); no component/E2E test for the composer UI itself in Phase 1 (matches
  this codebase's existing gap — `page-builder`/`projects` backend modules also ship without
  test files, per `STATUS.md` §1).

## Out of scope (Phase 1)

- Header's rich atom catalogue, or any other category-specific catalogue — Phase 2+.
- Drag-to-add from palette to canvas (click-to-add only; drag-to-reorder in the layer list is
  in scope).
- Cross-project / global block library (rejected — per-project only, see Design decisions).
- Light/dark/both theme-mode toggle on custom blocks (the reference's Style tab has this for
  headers specifically; Phase 1's universal Style tab is just a background color).
- Bulk import/export of custom blocks between projects.
