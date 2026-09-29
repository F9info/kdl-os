# Generic Details Page + Always-Live Shared Layout — Design

Date: 2026-09-28
Status: Proposed

## Problem

`sectors` is the only module in this codebase with a "list of entries, each gets a real
page-builder page" pattern (`backend/src/modules/sectors/service.js:96-113`). Each sector's
page content is baked as a literal Puck `content[]` copy at creation time
(`starterPageContent()`, `sectors/service.js:37-98`) — the sector's own name/description/image
are interpolated directly into block props and saved once.

Confirmed live (this conversation, project `cmt15bmts000401s6fn5ydhzp`): editing the Showrooms
page (`/admin/template-engine/edit/cmui94x0g00002hpjj0i3jp39`) — banner design, breadcrumb
style, section order — has zero effect on Hotel's page
(`/admin/template-engine/edit/cmui94x0x00022hpj30huyztc`) or any other sector's page. There is
no shared structure/design across entries of the same type, so a layout change has to be
manually repeated on every single sector page. With the intent to seed "lots of detail pages"
per project, this doesn't scale.

Separately, `backend/prisma/schema/site-layout.prisma` (`SiteLayout` model) and
`docs/superpowers/specs/2026-08-27-site-layout-header-footer-design.md` (Status: Approved)
already spec a project-wide shared Header/Footer wrapper — confirmed unimplemented (migration
ran, zero `prisma.siteLayout` references anywhere in `backend/src`). **That design is
out of scope here** — it solves a different layer (chrome wrapped *outside* a page's own Puck
content) and should be finished separately. This design covers a detail page's own **body**
content (the part that lives inside `content[]` — hero/banner, text, CTA, etc.), which
`SiteLayout` does not touch.

## Goal

Any content-type module with a list of entities (Sectors today; others later) can register
into a generic "Details Page" system. All entities of one type in one project share one
**live** structural template: editing section structure or a section's design variant on
*any* entity's page instantly applies to every sibling entity's page. Each entity keeps
showing its own name/description/image, resolved dynamically — never baked into a copy.

## Non-goals

- No admin UI for *defining* a brand-new content type from scratch (that's the roadmap "Data
  Model Builder" — confirmed aspirational/unbuilt, `CLAUDE.md:12`). Adding a second real type
  (e.g. Team) stays a developer task: implement the same handful of functions Sectors
  implements today, call `registerDetailPageType`. No second type is built in this pass —
  Sectors migrates onto the generic system as the only concrete example, proving the seams
  are real rather than Sectors-shaped.
- Not touching Header/Footer sharing (see `SiteLayout`, above — separate, already-approved
  design).
- Not building a visual "theme" system beyond what already exists (`variant` props on blocks).

## Data model

New file `backend/prisma/schema/detail-pages.prisma`:

```prisma
model DetailPageTemplate {
  id         String   @id @default(cuid())
  project_id String?
  type_key   String   // registry key, e.g. "sectors"
  data       Json     // Puck Data shape; bound props are `{ "$bind": "<field>" }`
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@unique([project_id, type_key])
  @@map("detail_page_templates")
}
```

`BuilderPage` (`backend/prisma/schema/page-builder.prisma`) gains two nullable columns:

```prisma
template_id String?  // -> DetailPageTemplate.id, set only for template-bound instance pages
entity_id   String?  // the specific record (e.g. Sector.id) this instance renders
```

Indexed on `template_id`. `Sector.detail_page_id` is untouched — still the FK an entity uses
to find its own page; `BuilderPage.entity_id` is the reverse pointer used at render time to
know which record's fields to bind.

## Registry (the generic seam)

New `backend/src/shared/detail-pages/registry.js`:

```js
registerDetailPageType(typeKey, {
  bindableFields,          // e.g. ['name', 'description', 'image']
  publicPathFor(entity),   // e.g. (s) => `/sectors/${s.slug}`
})
getDetailPageType(typeKey)
listDetailPageTypes()      // -> used by the new GET /detail-page-types endpoint
```

`sectors/index.js` (module entrypoint) calls `registerDetailPageType('sectors', {...})` at
load time — the only place Sectors-specific knowledge enters the generic system.

Shared helpers (in the same file or a sibling `service.js`), replacing the bespoke logic in
`sectors/service.js`:

- `ensureDetailPageTemplate(projectId, typeKey, seedContentFn)` — get-or-create the one
  template row for a project+type. `seedContentFn` supplies the initial Puck `content[]`
  (reuses today's `starterPageContent`-shaped logic, but with bound fields marked `$bind`
  instead of interpolated literals).
- `createDetailPageInstance(projectId, typeKey, entity)` — creates the `BuilderPage` row with
  `template_id`/`entity_id` set (data initialized as a copy of the template's current `data`,
  purely as a safe fallback — the template + resolution is what actually governs rendering
  going forward).

`sectors/service.js`'s `createSector`/`backfillDetailPages` call these instead of building
`starterPageContent` + `createPage` directly.

## Live binding resolution

Confirmed available: `@puckeditor/core@0.23.0` supports a per-component `resolveData` hook —
render-time prop override, does not mutate saved `data` (verified against the installed
package's type defs; `resolveFields`, a sibling hook, is already used twice in this codebase
at `packs/construction/index.tsx:2041,3222`, so the pattern of wiring one of these hooks in is
established, `resolveData` itself is new).

- `resolveBindings(props, entityFields)`: pure function, no-op unless a prop is literally
  `{ $bind: x }` (checked structurally) — safe to wire globally, zero effect on any page that
  isn't template-bound.
- Applied via one HOC wrapping every component definition when `puck.config.tsx` assembles its
  component map — not hand-editing ~20+ components in `packs/construction/index.tsx`.
- `metadata.entityFields` (that entity's own bindable field values, fetched once alongside the
  page/template) is passed into both `<Puck metadata=...>` (editor) and `<Render
  metadata=...>` (public) — `resolveData` just reads from `metadata`, no extra fetch inside
  the hook.

**Open risk, first implementation step:** confirm `<Render>` (not just the `<Puck>` editor)
actually invokes `resolveData` for the currently-installed Puck version — the hook's stated
purpose is exactly this ("render dynamic data without duplicating stored content"), but this
hasn't been exercised in this codebase yet. If `<Render>` does *not* invoke it, the fallback is
resolving bindings with the same pure function server-side (in the public route handler)
before handing `data` to `<Render>` at all — strictly simpler, same result for the public path,
just loses the "reuse one hook for both editor preview and public render" convenience.

### Editing model

- Opening any entity's bound page in the Puck editor (`edit/[id]/page.tsx`) loads the
  **template's** `data` (not the page's own row) once `page.template_id` is set, with
  `resolveData` showing that entity's real content in the live preview.
- Structural edits (add/remove/reorder a block, change a `variant` prop) save back to the
  **template** row (`PUT /detail-page-templates/:id`), detected via `page.template_id` — not
  to the individual page's own `data`. Every sibling instance re-resolves from the same
  template on next load/render — this is what makes it "always-live."
- Per-entity text/image (`description`, `image`, etc.) is no longer editable through the
  shared Puck view (editing a bound prop there would either be a no-op or require breaking the
  binding). It moves to the entity's own admin form — Sectors' existing "Settings" gear
  modal (`/admin/sectors`, currently name/slug/category/SEO only) gains `description`/`image`
  fields.

## Frontend UX (removes today's hardcoding)

- `RESERVED_PAGE_CHIPS` (`WebsiteStage.tsx:1147`, currently a hardcoded one-item array) is
  fetched from a new `GET /detail-page-types` (returns the registry's entries for types
  relevant to this project) — any newly-registered type gets its sync chip automatically, no
  `WebsiteStage.tsx` edit required.
- `LayoutSettingsPanel`'s `detailPageTypes` prop (`WebsiteStage.tsx:1062-1067`, currently one
  hand-written Sectors entry) is sourced the same way.

## Migration (existing Sectors data)

One-time backfill script:

1. Pick one existing sector's page as the representative template source.
2. Extract its `content[]`; replace `description`/`image` prop values with `{$bind:
   "description"}` / `{$bind: "image"}` wherever they match that sector's own field values.
3. Create the `DetailPageTemplate` row (`project_id`, `type_key: 'sectors'`, that `data`).
4. For every sector, set its existing `BuilderPage.template_id`/`entity_id`. Existing baked
   `data` on each page is left as-is (harmless, no longer read once `template_id` is set) —
   no destructive rewrite needed.

## Seeders

`backend/src/modules/sectors/seed.js` (new, matches the existing per-module `seed.js`
convention — e.g. `backend/src/modules/projects/seed.js`) + a thin CLI wrapper — bulk-creates N
sectors (and their bound instance pages, via `createDetailPageInstance`) for a given project.
Directly serves the "create lots of detail pages per project" need raised in this conversation,
and gives the always-live template a real multi-entry stress test.

## Testing

- Unit: `resolveBindings` (pure function) — no-op on non-bound props, resolves `$bind` props,
  handles a missing field gracefully (falls back to the template's own literal, doesn't throw).
- Integration: creating two sectors in the same project, editing the template via one entity's
  editor route, asserting the second entity's rendered/resolved data reflects the structural
  change while its own `description`/`image` stay entity-specific.
- Regression: an ordinary non-templated page (e.g. Home) round-trips through the same
  `puck.config` component HOC with zero behavior change (proves the global wiring is
  side-effect-free for the common case).

## Out of scope (this pass)

- A second real content type (Team, Case Studies) — framework + Sectors migration only.
- Admin-configurable content-type definition ("Data Model Builder").
- Header/Footer sharing (`SiteLayout` — separate, already-approved, unimplemented design).
- Per-entity opt-out ("this one entity's page structurally diverges from the template") — not
  requested; every entity of a type shares the template unconditionally.
