# Admin Panel UI Consistency Pass — Design

## Problem

The internal `/admin` tool's own look (sidebar, buttons, cards, tables) is
inconsistent across screens. Manual review (Playwright screenshots +
source read) confirms this isn't a broken color/spacing *system* — the
shadcn-based tokens in `globals.css` and the shared `Button`/`Card`/`Table`
components already produce a clean result wherever they're actually used
(Dashboard, Users, Modules, Roles, the Add User modal all look right).

The real cause: several admin pages roll their own ad-hoc `<button>`
elements (custom classes, inconsistent icon/text gap, inconsistent
padding) instead of the shared `Button` component. Confirmed concretely in
`frontend/src/app/admin/media/page.tsx` (15+ raw `<button>` elements mixed
with real `<Button>` usage in the same file — visually, this is the
toolbar with uneven icon/text spacing between "Upload" and "Upload
Folder") and `frontend/src/app/admin/notifications/page.tsx` ("Unread
only" / "Mark all read" rendered as bare text with zero button chrome,
while every other screen uses a real bordered/solid button for equivalent
actions).

## Goal

Every actionable element under `/admin` uses the existing shared `Button`
component (or `Card`/`Table`/`PageHeader` where a page rolled its own)
with a variant/size that matches its role, so padding, icon spacing, and
visual chrome are consistent everywhere — without introducing any new
colors, spacing scale, or design tokens.

## Scope

**In scope:** every page under `frontend/src/app/admin/**` (per user
decision: full sweep, no screen skipped) — Dashboard, Users, Modules,
Notifications, Page Builder (list + legacy editor chrome only, not the
Puck canvas itself), Theme Engine, Template Engine, Example, Integrations,
Brand Profile, Theme Settings, Media (Library, AI Providers, Cloud
Imports), Access Control (Roles, Permissions, Activity Log), Application
Settings section, and any modal/dialog reached from those screens (e.g.
Add User).

**Out of scope:**
- Theme Engine's own settings *content* (the color/typography/button
  values it lets a user edit for the client's website) — only Theme
  Engine's own admin-page chrome (its page header, tab buttons if
  ad-hoc, etc.) is in scope, not the design system it produces for
  client sites.
- The Puck page-builder canvas/editor internals (already covered by the
  Custom Block Composer work) — only the admin chrome around it (the
  page-builder *list* page, `BlocksPanel`'s own tab buttons if ad-hoc).
- Any new color token, spacing scale, or typography change in
  `globals.css`.
- Any change to Theme Settings' own field set or backend.
- Functional/behavioral changes — this is visual/markup only. No route,
  permission, or data-shape changes.

## Approach

### Phase 1 — Audit

Walk every in-scope page (logged in as `admin@kdl.com`, Playwright
screenshots for visual confirmation) and, for each page, read its source
file(s) and catalog every clickable action element:

- Already using the shared `Button` (`@/components/ui/button`) → no
  change needed, note as reference-correct.
- A raw `<button>`, `<a>`, or styled `<div onClick>` acting as a button
  → needs conversion, note file:line and what it currently renders as
  (primary action / secondary action / icon-only / destructive / bare
  utility link).
- A page that rolled its own card/table/header markup instead of the
  shared `Card` / `Table` / `PageHeader` primitives → note separately;
  only convert if it's a straightforward swap (same visual result), not
  if the custom markup exists because the shared primitive genuinely
  doesn't fit (e.g. Theme Engine's live-preview panel is intentionally
  bespoke and stays out of scope).

Output: a findings list (this doc's own follow-up plan file), grouped by
page/module, each entry naming the file, the element(s), and the
intended fix.

### Phase 2 — Fix

For each cluster of findings (grouped by page or shared file so one task
touches one coherent area), convert the ad-hoc elements to the shared
component with the variant/size matching its role:

| Current role | Target |
|---|---|
| Primary page action (e.g. "Add user", "Create role") | `<Button>` default variant |
| Secondary action next to a primary one | `<Button variant="outline">` |
| Icon-only action (edit/delete/reset-password in a table row) | `<Button variant="ghost" size="icon">` |
| Destructive action (delete) | `<Button variant="destructive">` or `variant="ghost"` + destructive text color, matching the existing red trash-icon pattern already used correctly on the Users/Roles tables |
| Bare-text utility action (e.g. "Mark all read", "Unread only") | `<Button variant="ghost" size="sm">` |

Each fix task:
1. Read the current file fully.
2. Replace the ad-hoc element(s) with `<Button>` (adding the import if
   missing), preserving the existing `onClick`/`disabled`/loading logic
   exactly — only the rendered markup changes.
3. Typecheck + lint.
4. Rebuild frontend, Playwright screenshot before/after the specific
   page, confirm the fix visually and confirm no regression to the
   page's existing behavior (click still works, disabled states still
   apply).
5. Where an existing RTL test exercises the changed element (e.g. by
   `getByRole('button', {name: ...})`), confirm it still passes —
   `Button`'s rendered role/accessible name should be unaffected by the
   swap. Do not add new tests for pages that have none today; this is a
   markup-only consistency fix, not new behavior needing new coverage.

## Testing

- `pnpm lint` + `npx tsc --noEmit` clean after every task.
- Existing RTL/vitest suite stays green (no regressions).
- Manual Playwright screenshot per changed page, compared against the
  reference-correct pages (Dashboard/Users/Modules/Roles) for visual
  consistency.

## Risks / Notes

- Some raw `<button>` elements may carry very specific inline styles
  (e.g. Media Library's drag-and-drop drop-zone, file-type icons) that
  aren't really "buttons" in the design-system sense — a fix task must
  distinguish "this is a clickable control that should look like our
  buttons" from "this is a custom widget that happens to use a `<button>`
  tag for semantics/accessibility" (e.g. a card-style selectable tile).
  Only the former converts to `<Button>`; the plan will call out
  ambiguous cases in the audit findings rather than guessing.
- This is a large surface (every admin screen). The plan will be broken
  into per-module tasks so each is independently reviewable and
  shippable, matching this repo's existing subagent-driven-development
  pattern.
