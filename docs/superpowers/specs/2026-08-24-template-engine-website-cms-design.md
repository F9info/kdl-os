# Template Engine — Website/CMS Surface (Phase 1 of 3)

**Status:** Approved for planning
**Date:** 2026-08-24
**Ticket:** KDL-558 / KDL-560 follow-on (Studio dead-ends, sidebar wiring)

## Background

The user handed a new, larger design prototype (`/Users/f9developer/Downloads/templateEngine 2.html`,
5561 lines) as the target UX for the KDL Template Engine — "a combination of template settings and
CMS combined," managing designs for KDL OS backend/frontend/website (mobile app deferred to a later
phase per user decision).

A prior agent (PaperclipAI) had claimed the module was built. Cross-checking against the actual repo
found the backend engines are real and substantial (`brand-kit`, `credits`, `theme-engine`,
`collateral`, `page-builder` — the last being a genuine Puck-based drag/drop editor with 3 industry
component packs, wired to Postgres), but the **Template Engine "Studio" 9-stage flow never exposes a
design surface**. Every stage component (`WebsiteStage.tsx`, `CollateralStage.tsx`, etc.) is a
"click advance → see a download link" wrapper. The `WebsiteStage` literally says "Direct editing is
disabled while Studio is active — use the page-builder screen" and link out. This matches the user's
"not implemented even 1%" complaint about the *experience*, even though the underlying engines exist.

This is too large for one spec. It decomposes into three phases:

1. **Website/CMS surface** (this spec) — bring real in-Studio page design capability.
2. Studio shell/nav fixes — activate `page-builder-ui`/`theme-engine-ui` nav, wallet UI.
3. Collateral design editor — live preview/customization for visiting card/letterhead/t-shirt/ID card.

Mobile-native design surface and an admin/CRM dashboard generator (present in the prototype) are out
of scope entirely for now — user confirmed web (frontend + website) first, mobile later; the
admin/CRM generator has no equivalent need identified.

## Current state (verified in repo)

- `backend/src/modules/page-builder/service.js` (71 lines) — plain CRUD over `BuilderPage`
  (`id, slug, title, status, data, created_by, deleted_at, timestamps`). **No `project_id` column.**
- `frontend/src/app/admin/page-builder/` — real Puck editor (`puck.config.tsx` composes
  `general`/`construction`/`medical` packs via `composePacks`), `store.ts` calls the real backend API
  (not the README's stale "localStorage POC" claim), public renderer at `/p/[slug]`.
- `backend/src/modules/template-engine/drivers/index.js` — `websiteDriver` seeds a **hardcoded**
  3-page list (`WEBSITE_SEED_PAGES = [home, about, contact]`) with `data: null` (blank pages, no
  template/pack selection wired — comment admits: "Industry-based pack selection wired when brand-kit
  strategy field lands"). Pages are pseudo-scoped via slug (`te-${run.id}-${key}`), not a real FK.
- `advanceStageSchema` already *validates* an optional per-stage JSON body (the `approval` stage's
  schema allows `{ brandKitVersion }`), but the controller never reads `req.validated.body` and
  `service.advanceStage(runId, stage, userId, projectId)` has no body parameter — the field is
  validated but dead, not actually threaded to any driver today. This phase needs to wire that
  threading through (controller → `service.advanceStage` → `driver.execute`) rather than just reuse
  an existing working path.
- Stage statuses (`PENDING|RUNNING|AWAITING_INPUT|DONE|FAILED|SKIPPED`) exist on
  `TemplateEngineStage`, but `AWAITING_INPUT` is unused anywhere in the codebase today — this design
  deliberately does not introduce its use (see Decisions below).

## Scope for this phase

In scope:
1. `BuilderPage` becomes project-scoped (`project_id` FK, required).
2. A page-list step in `WebsiteStage`: add/rename/remove page names before generation (replaces the
   hardcoded 3-page seed).
3. A template picker: 1-2 curated full-page Puck `Data` starters per industry pack, selectable per
   page in the page-list step.
4. The real Puck editor embedded inline inside `WebsiteStage` (no more "go to another screen").
5. Per-page SEO fields (`seoTitle`, `seoDescription`) and a project-scoped `sitemap.xml` endpoint.

Out of scope (future phases / explicitly deferred):
- Collateral (business card/letterhead/t-shirt/ID card) design editor — Phase 3.
- `page-builder-ui`/`theme-engine-ui` nav activation, wallet/ledger UI — Phase 2.
- Mobile-native design surface, admin/CRM dashboard generator, inline WYSIWYG contenteditable
  (Puck's existing field-panel editing is retained as-is), undo/redo beyond what Puck ships natively.

## Design

### 1. Schema: `BuilderPage.project_id`

Add a required `project_id` column (FK to `Project`) to `backend/prisma/schema/page-builder.prisma`.
Existing rows (if any in deployed environments) need a backfill migration — assign orphaned pages to
no project is not valid once the column is `NOT NULL`, so the migration must either (a) delete
pre-existing `BuilderPage` rows created only by the driver's slug-hack (recoverable — they're
Studio-generated scratch pages, re-creatable by re-running the WEBSITE stage), or (b) if any
real/edited pages exist outside Studio in a given environment, backfill by parsing the `te-<runId>-*`
slug prefix back to the run's `projectId` via `TemplateEngineRun`, defaulting anything unparseable to
a manually-flagged review list. Given this is pre-production tooling, (a) is acceptable — confirm
with a `SELECT count(*) FROM builder_pages` check before writing the migration.

All CRUD (`listPages`, `getPage`, `createPage`, `updatePage`, `deletePage`) and the routes/controller
gain `requireProject()` scoping, consistent with `template-engine`, `collateral`, `brand-kit`. The
public `GET /page-builder/public/:slug` route is unaffected (slug is already globally unique and
public rendering doesn't need project context).

### 2. Page-list step (WebsiteStage)

Before advancing the `website` stage, `WebsiteStage.tsx` renders a form: a list of
`{ key, title, templateId }` rows, seeded with suggested names, user can add/rename/remove. On
submit, `advance.mutate('WEBSITE', { pages: [...] })` — extending `advanceStageSchema`'s `website`
body shape. No new DB status is introduced; the existing `PENDING → RUNNING → DONE/FAILED` flow is
unchanged, the form just gathers the driver's input client-side before the call.

Threading (new — see Current State above, this path doesn't exist yet): controller's `advanceStage`
passes `req.validated.body` into `service.advanceStage(runId, stage, userId, projectId, body)`, which
passes it into `driver.execute({ run, stageRecord, userId, projectId, body })`. `websiteDriver.execute`
reads `body.pages` in place of the hardcoded `WEBSITE_SEED_PAGES`, creates one project-scoped
`BuilderPage` per entry, and seeds `data` from the chosen starter template (see #3) instead of `null`.

### 3. Starter templates

Each pack (`packs/general`, `packs/medical`, `packs/construction`) gets a `starters.ts` exporting 1-2
named full-page `Data` presets (e.g. `general.starters.homeMarketing`, `medical.starters.homeClinic`),
composed from that pack's existing block components — matches the prototype's `HOME_TEMPLATES`
concept but reuses real Puck blocks instead of hard-coded HTML strings. The page-list step's template
picker lists starters filtered by the project's industry (from brand-kit), falling back to `general`.

### 4. Inline editor

Extract the `<Puck config={config} data={...} onPublish={...}>` wiring from
`frontend/src/app/admin/page-builder/[id]/page.tsx` into a shared component (e.g.
`frontend/src/app/admin/page-builder/PuckPageEditor.tsx`), imported by both the standalone editor
route and the new inline usage in `WebsiteStage.tsx` — one Puck config, two mount points, per the
module's existing "no second Puck instance" rule. `WebsiteStage` shows a page-tab list (from the
stage's `outputRef.pageIds`); selecting a tab mounts `PuckPageEditor` for that page id directly in the
stage panel. The standalone `/admin/page-builder` screen and its "preview in page builder" external
link both remain valid (same underlying pages, same component) — this only removes the "disabled"
wall, it doesn't remove the other screen.

### 5. SEO + sitemap

`seoTitle`/`seoDescription` added as fields on the Puck `root` config (`puck.config.tsx`) — lives in
the existing `data` JSON blob, no schema change. A new project-scoped route
`GET /api/page-builder/sitemap.xml?projectId=` (or via `requireProject`) lists that project's
`PUBLISHED` pages by slug and renders a standard sitemap XML document.

## Testing

- Regression test: a page created under project A must 404 (not just filter silently) when fetched
  with project B's `X-Project-Id` — mirrors the existing cross-project guard test pattern already
  used for `template-engine`'s `getRun`.
- WEBSITE stage crash-recovery: re-advancing after a partial page-list creation must not duplicate
  pages (extend the existing `pageKeyToId` reuse logic to the new page-list-driven flow).
- Sitemap endpoint: only `PUBLISHED` pages for the requesting project appear; draft pages and other
  projects' pages are excluded.

## Decisions log

- **No `AWAITING_INPUT` status introduced.** The page-list/template-picker input is gathered
  client-side before calling `advance`, extending the already-validated-but-currently-dead
  body-payload path rather than introducing a new mechanism. Introducing a new stage status would require
  touching crash-recovery (`markInterruptedStages`), gate logic (`checkGate`), and the resume
  endpoint for a stage-transition state that isn't otherwise used anywhere in the DAG — not
  justified for one stage's UI-only input-gathering step.
- **`BuilderPage` becomes project-scoped (not the slug-hack extended).** Approved explicitly by the
  user over the narrower no-migration alternative, to fix the underlying data-integrity gap rather
  than build page-list/SEO/sitemap on top of a string-matching hack.
- **Puck editor is embedded via a shared extracted component, not duplicated.** The `page-builder`
  module's own README states the "no second Puck instance" rule explicitly; this design honors it.
