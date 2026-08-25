# Template Engine — HTML Prototype Integration Roadmap

Tracks the page-by-page port of `/Users/f9developer/Downloads/templateEngine 2.html` (a 5561-line
brand+CMS design prototype, ~2.3x the old `template-engine.html`) into the live
`/admin/template-engine` Studio flow. Read this first when resuming this work — it's the
single source of truth for what's done vs pending across this multi-session effort.

Ground rule set by the user: reuse what's already real (`brand-kit`, `theme-engine`, `collateral`,
`page-builder`, `credits`) instead of rebuilding; use the Application Settings engine
(Type/Category/SettingField, `owner_module` scoped) for flat config pieces that have no dedicated
module yet — never invent a new Prisma migration where the generic engine already fits.

## Rows

| # | Prototype page | Studio location | Backing engine | Status |
|---|---|---|---|---|
| 1 | Overview (logo + contact intake) | INTAKE stage | `brand-kit` + Application Settings | ✅ **Done** (2026-08-25) |
| 2 | Color Palette (4-group ramps) | PALETTE stage | `brand-kit` (OKLCH extraction) | ✅ **Done** (2026-08-25) |
| 3 | Typography (per-platform type scale + fonts) | APPROVAL stage → theme-engine | `theme-engine` | ⬜ Pending — embed theme-engine's typography panel inline in Studio |
| 4a | Platforms → Web/Admin/Mobile | WEBSITE stage | `page-builder` (Puck) | ⬜ Pending — **already spec'd + planned**: `docs/superpowers/specs/2026-08-24-template-engine-website-cms-design.md` + `docs/superpowers/plans/2026-08-24-template-engine-website-cms.md` (13 TDD tasks, ready to execute) |
| 4b | Platforms → print/ID (card/letterhead/t-shirt/ID) | COLLATERAL stage | `collateral` | ⬜ Pending — needs its own brainstorm+spec+plan pass (interactive editor: live preview, drag logo, colour-role picker) |
| 4c | Platforms → merch (tote/mug/cap) | — | `collateral` asset types | ⬜ **Scope undecided** — collateral only supports VISITING_CARD/LETTERHEAD/TSHIRT/ID_CARD today; confirm with user before doing any work here |
| 5 | Home-page templates (industry starters) | WEBSITE stage | `page-builder` starters | ⬜ Pending — covered by the same Phase 1 plan as row 4a |
| 6 | Themes (3 presets over approved palette) | new small stage/panel | none yet | ⬜ Pending — good fit for Application Settings (`owner_module='template-engine'`), no dedicated module needed |
| 7 | Sitemap / nav page list | WEBSITE stage | `page-builder` | ⬜ Pending — covered by the same Phase 1 plan as row 4a |
| 8 | Page builder / block editor | WEBSITE stage | `page-builder` (Puck) | ⬜ Pending — covered by the same Phase 1 plan as row 4a |
| 9 | Export & Docs (preflight/guidelines/wallet/assets) | PREFLIGHT/GUIDELINES/EXPORT stages | `credits` + exportDriver manifest | ⬜ Pending — needs its own brainstorm+spec+plan pass (6-tab Export UI, wallet display) |

Sequencing: DAG order applies — `1 → 2 → 3 → (4a/5/7/8 as one thread, 4b as a parallel thread) → 6 → 9`.

## Row 1 — in progress, step 1 of N done (2026-08-25)

First attempt (per-project, `owner_module`-hidden fields wired straight into `IntakeStage.tsx` +
collateral) was corrected by the user — see `.agents/HANDOFF.md`'s "KDL-558 row 1 correction" entry.
Proceeding step by step from here per explicit instruction; do not assume the next step without being
told.

**Step 1 (done):** standalone (`owner_module: null`) Application Settings fields, visible in the
generic `/admin/settings/*` screens, created via idempotent seeder
`backend/prisma/seeders/brand-profile-fields.seed.js` — Type "Brand Profile" (`brand-profile`) →
Category "Logo & Contact Details" (`brand-profile.logo-contact`) → 8 fields (Logo file + 7 contact
fields). Seeded on the live dev DB and verified idempotent.

**Step 2 (done):** killed the Studio project-picker landing page entirely —
`/admin/template-engine` now redirects straight to the default project's flow (confirmed with the
user before removing it). `IntakeStage.tsx` ("Overview") now renders its 7 contact fields via the
real shared `FieldControl` component against the standalone `brand-profile` fields from Step 1
(`GET /setting-fields/by-type/brand-profile` / `POST /setting-fields/values`) — this is the actual
"using application settings" the user asked for, not a bespoke form.

**Still orphaned, not removed:** `backend/src/modules/brand-kit/contact-fields.js` (per-project
hidden fields from the very first, corrected attempt) + its `/contact` routes + `collateral`'s
`resolveBrandKit()` wiring to it. Nothing calls these anymore but they haven't been deleted or
repointed — see `.agents/HANDOFF.md`'s step-3 entry for the two options. Wait for instruction.

## Row 2 — done (2026-08-25, PR #242)

Built: `frontend/src/app/admin/template-engine/_components/stages/PaletteStage.tsx` rewritten from a
stub into a real editor. **Correction to this file's own row-2 note below** (left for history) — the
backend's actual roles are **Primary/Secondary/Accent/Neutral**, not "Tertiary/Quaternary" (that was
this doc's own assumption before checking; researched via a dedicated Explore pass on
`backend/src/modules/brand-kit/service.js` + `palette.js` before building, per the row 1 lesson —
"read the current code before assuming the gap").

New `frontend/src/lib/oklch-ramp.ts` — verbatim client-side port of `palette.js`'s ramp math, so
editing a base hex regenerates the exact same ramp shape the backend's own extraction produces. New
`usePatchBrandKit` hook. Full detail in `.agents/HANDOFF.md`'s "row 1 polish streak + row 2" entry.

**Known gap surfaced, not fixed:** editing the palette doesn't recompute `contrast_report` on the
backend (no such endpoint exists); approval only checks acknowledgment of the possibly-now-stale
existing adjustments. Flag if this becomes a real problem — needs a backend change to fix properly.

**Not verified:** the "Pick from logo" eyedropper against real MinIO CORS headers — falls back to a
toast on a CORS-tainted canvas read, but this hasn't been exercised against the actual deployed
MinIO config from this session (no browser tool available). User asked to test manually.

## Row 3 — next up

Not started. Per the row 1/2 lesson: read the actual current code (theme-engine's typography panel,
`frontend/src/app/admin/theme-engine/`) before assuming what the gap is or what the backend's real
field names are — do not assume the prototype's naming/structure carries over.
