# Page Builder — Section Picker Popup UI Refresh

## Background

User feedback on the Page Builder's block/section picker popups (`SectionPickerPopup`,
opened per-category from the Section tab, and `InsertBlockModal`, the full sidebar+search
"Insert a block" browser) — both in
`frontend/src/app/admin/page-builder/insert-block-modal.tsx`:

- Title is small and left-aligned next to the close button; hard to scan quickly.
- The card grid is a single column — every design (e.g. "Construction Hero · 1", "· 2")
  renders at nearly full modal width, one below the other, so seeing 3-4 designs means a lot
  of scrolling.
- No indication of which design is the one currently live on the page — a developer has to
  remember or scroll the real page to compare.
- `InsertBlockModal`'s "Create new" is a grid cell mixed in among the block cards;
  `SectionPickerPopup`'s is already a separate full-width footer button (the preferred style).

## Scope

Both popups. Same treatment applied consistently — `SectionPickerPopup` is the primary
target (matches the reference screenshot exactly today), `InsertBlockModal` gets the same
title/grid/tickmark/footer-button treatment adapted to its sidebar+search layout.

Out of scope: `BlockCard`'s hover "Insert →" overlay, the category sidebar itself, search
behavior, custom-block cards' own styling (`CustomComposedBlock` — the composer's own
listing), the Section Builder / Composer screens.

## Design

### 1. Header: large, centered title

Current (`SectionPickerPopup`):
```
<div className="flex items-center gap-3.5 border-b ... px-4.5 py-3.5">
  <b className="text-base">{cat?.title ?? categoryKey}</b>
  <span className="flex-1" />
  <button onClick={onClose} ...><X /></button>
</div>
```

New: the title becomes its own centered block; the close button becomes an
absolutely-positioned top-right icon so it doesn't need to share the flex row (and doesn't
push the centered title off-center).

```
<div className="relative border-b ... px-5 py-4">
  <h2 className="text-center text-xl font-extrabold sm:text-2xl">{cat?.title ?? categoryKey}</h2>
  <button onClick={onClose} className="absolute right-3.5 top-3.5 ...">
    <X size={20} />
  </button>
</div>
```

`InsertBlockModal` gets the same header shape, with `"Insert a block"` as the fixed
centered title (not per-category — it's the browse-everything modal). Its search input
moves to its own row directly below the title bar, still above the sidebar+grid area (full
width of that row, not squeezed next to the title).

### 2. Grid: 2 columns, sizes that scale with card width

Both popups' card grid changes `grid-cols-1` → `grid-cols-2` (fixed 2-up; the modal is wide
enough — ~1100px minus any sidebar — that 2 columns always fit comfortably at gap-4).

Root cause of "needs smaller fonts/images to fit": `BlockCard` already renders its preview
content at a fixed 1200px-wide virtual canvas and scales it down via CSS `zoom` to the
card's *actual measured width* (`scale = el.clientWidth / 1200`, tracked via
`ResizeObserver`) — this part is already correct and self-adjusting for any column count.
The bug is that the **preview container's height stays a fixed pixel constant**
(`COMPACT_PREVIEW_HEIGHT` / `DEFAULT_PREVIEW_HEIGHT`) regardless of `scale`, while the
rendered content's *visual* height shrinks by that same `scale` factor. At 1 column
(scale ≈ 0.85-0.9) the fixed height roughly matches the content's shrunk height by
coincidence; at 2 columns (scale ≈ 0.4-0.45) the content shrinks much more than the
container does, leaving a large dead-space gap below the image/text inside every card.

Fix: derive the container height from the same `scale` value instead of using it as a fixed
constant — `previewHeight = Math.round(baseHeightAt1200 * scale)`, where
`baseHeightAt1200` is what `COMPACT_PREVIEW_HEIGHT`/`DEFAULT_PREVIEW_HEIGHT` already encode
(the previews' natural height when rendered at the full 1200px canvas, before scaling).
This makes the image+text inside every card shrink together, proportionally, at any card
width — solving the "reduce fonts/images so 2-up fits" request generically, without a
separate set of "2-column" size constants to keep in sync with the 1-column ones.

The name badge (`"Construction Hero · 1"`, absolute-positioned, not part of the
zoomed/scaled content) doesn't shrink with `zoom` — reduce its base text size/padding
slightly (e.g. `text-[11px]` → `text-[10px]`, tighten padding) so it reads proportionately
at the new narrower 2-up card width without needing per-column variants.

### 3. "Create new": always a footer button, after the grid

`SectionPickerPopup` already does this — no change.

`InsertBlockModal` currently renders its "Create new" as one more grid cell interleaved
with the block/custom-block cards. Move it out of the grid into the same full-width footer
button `SectionPickerPopup` uses, placed after (below) the scrollable grid area. Only
render it when not searching (existing `!q` guard carries over unchanged).

### 4. Tickmark + reorder for the currently-applied design

Before rendering each popup's card list, determine — for each `{componentKey, variant}`
pair — whether a block of that *exact* type **and** variant already exists anywhere in
`appState.data.content`. (Exact match: same `componentKey`, same `variant` value, including
both `null` — components with no variants match on type alone.)

- If a match exists: that card is pinned to the front of its group (stable order otherwise
  preserved) and rendered with a small green checkmark badge (distinct position from the
  existing name badge — e.g. top-left, name badge stays top-right) instead of/alongside the
  name badge.
- If no match exists anywhere in the page content for a given `componentKey`, none of that
  key's variant cards get a checkmark; order is unchanged for that group.

`SectionPickerPopup` applies this once, across its single category's cards.
`InsertBlockModal` applies it **per component key** across whichever category is active —
i.e. the check/reorder logic is identical, just running over `componentKeys` scoped to
`activeCat` (already how `cards` is built today) rather than one fixed category.

This is a pure, presentational reorder/annotate step over the already-computed `cards`
array in both components — no change to `insertBlockComponent`, `insertBlock`, or any
dispatch logic.

## Implementation Notes

- Both popups already compute `cards` as
  `componentKeys.flatMap(key => variants.map((variant, index) => ({key, variant, index, total})))`.
  Add a shared helper (co-located in `insert-block-modal.tsx`, exported if useful, otherwise
  module-private) that takes `cards` + `content` and returns `cards` reordered with an
  `isCurrent: boolean` flag added per card — used by `BlockCard` to render the checkmark.
- `BlockCard` needs one new prop, `isCurrent: boolean`, and the height-from-scale change
  described in §2. No other prop shape changes.
- No backend/API changes. No new dependencies.

## Testing

- Unit: the reorder/annotate helper — a card whose `{key, variant}` matches something in
  `content` is `isCurrent: true` and sorts first within its group; a `variant: null` case
  matches on type alone; no match anywhere leaves order/flags unchanged.
- Manual/visual: cannot be verified in this sandbox (no running dev server) — confirm in a
  real browser after implementation: 2-up grid renders without dead space at typical card
  counts (2, 3, 4+ variants), checkmark appears on the design matching the live page,
  "Create new" renders once, after the grid, in both popups.
