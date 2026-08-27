# Site Layout (shared Header/Footer) — Design

Date: 2026-08-27
Status: Approved

## Problem

Template-engine editor (`/admin/template-engine/edit/[id]`) bakes `NavBar` and `Footer` as
per-page Puck blocks. Every page (Home/About/Contact) carries its own copy, so editing the
header/footer means repeating the edit on every page. There is no shared, project-scoped
concept of a site layout.

## Goal

Add a third editor tab, "Layout", where Header and Footer are configured once per project
and automatically apply to every page in that project. Existing per-page `NavBar`/`Footer`
blocks are stripped the first time a project's Layout is saved.

## Data model

New file `backend/prisma/schema/site-layout.prisma`:

```prisma
model SiteLayout {
  id         String   @id @default(cuid())
  project_id String   @unique
  header     Json     @default("{}")
  footer     Json     @default("{}")
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("site_layouts")
}
```

`BuilderPage` (`backend/prisma/schema/page-builder.prisma`) gains a nullable, indexed
`project_id String?` column — today a `BuilderPage` has no FK to `Project` at all; the public
render route only knows the page's `slug`, so it needs a stored `project_id` to look up the
matching `SiteLayout`. Populated by the website-seed driver at page-creation time; self-healed
(backfilled) from the `?projectId=` query param the first time that project's Layout is saved,
covering any page created before this migration.

## Backend

New module `backend/src/modules/site-layout/` (routes → controller → service, following the
`page-builder` module pattern):

- `GET /site-layout/:projectId` — returns the row, or `{ header: {}, footer: {} }` defaults if
  none exists yet (no 404 — keeps the editor's first load simple).
- `PUT /site-layout/:projectId` — upserts `{ header, footer }`. On success:
  1. Backfill: find all `TemplateEngineRun` rows with `projectId` matching, read each one's
     `TemplateEngineStage` where `stage = 'WEBSITE'`, pull the page ids out of
     `outputRef.pageKeyToId` (JSON map of `home/about/contact` → `BuilderPage.id`), and set
     `project_id` on any of those `BuilderPage` rows where it's still null.
  2. Strips `NavBar`/`Footer` entries out of `content[]` for every `BuilderPage` with that
     `project_id`, and saves.

RBAC: reuse `requirePermission('page-builder', 'edit')` — no new permission rows.

## Editor UI

Puck (`@puckeditor/core` v0.23.0) has no `overrides` slot for the tab strip itself — only
`plugins` add a real third tab (confirmed against vendored source: `blocksPlugin`/
`outlinePlugin` are themselves just plugins). `edit/[id]/page.tsx` adds:

```tsx
plugins={[{ name: 'layout', label: 'Layout', render: LayoutPanel }]}
```

`LayoutPanel` (new file, `template-engine/edit/[id]/_components/LayoutPanel.tsx`): two
collapsible sections (Header, Footer), plain controlled inputs — no Puck field plumbing needed
since this lives outside Puck's component tree:

- Header: `variant` (select, same 4 options as the `NavBar` block), `brand`, `logoUrl`, `links`
  (pipe-format textarea, same as today), `ctaLabel`, `ctaHref`, `primaryColor`.
- Footer: `variant`, `brand`, `logoUrl`, `tagline`, `links`, `copyright`.

Loads via `GET /site-layout/:projectId` on mount, saves via `PUT` on a Save button (not
autosave — matches the page editor's explicit "Publish" model). `projectId` comes from the
existing `?projectId=` query param already read for the Back link.

Puck's own built-in category currently labeled **"Layout"** (Section/Columns/Spacer/NavBar/
Footer in `packs/general/index.tsx`) is renamed to **"Structure"** to avoid colliding with the
new tab name. `NavBar`/`Footer` blocks remain in the palette for one-off page-level overrides;
they're just no longer auto-seeded.

## Rendering

Extract the JSX currently inline in the `NavBar`/`Footer` Puck block `render` functions
(`packs/general/index.tsx`) into pure functions `NavBarView(props)` / `FooterView(props)` in a
new `packs/general/layout-components.tsx`. The Puck block `render` calls become thin wrappers
around these — behavior for existing per-page override blocks is unchanged.

Two call sites wrap their `<Render>` output with `SiteLayout` header/footer, fetched by the
page's `project_id`:

- `frontend/src/app/p/[slug]/page.tsx` (public site)
- `frontend/src/app/admin/template-engine/site/page.tsx` (admin multi-page preview)

If a page has no `project_id` (legacy/standalone page, or `SiteLayout` fetch 404s), render
falls back to whatever `NavBar`/`Footer` blocks the page's own `content[]` still carries — no
visual regression for pages outside the template-engine flow.

## Seeding

`backend/src/modules/template-engine/drivers/website-seed-content.js` +
`drivers/index.js` (`websiteDriver.execute`): stop calling `headerBlocks()` / appending the
trailing `Footer` block into each seeded page's `content[]`. Instead, compute the same brand
props once per run and create a single `SiteLayout` row (`project_id: run.projectId`)
alongside the 3 seeded pages.

## Out of scope

- No UI for per-page "opt out of shared layout" — a page can still locally override by
  dragging in its own `NavBar`/`Footer` block (existing behavior), which simply renders above/
  below the shared one; not solved by this design, acceptable per the "auto-strip" choice.
- No new RBAC permission — reuses `page-builder` permission.
- No backfill/admin tooling to bulk-create `SiteLayout` rows for pre-existing projects beyond
  the self-heal-on-save behavior described above.
