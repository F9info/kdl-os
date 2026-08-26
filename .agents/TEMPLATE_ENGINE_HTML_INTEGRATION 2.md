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
| 2 | Color Palette (4-group ramps) | PALETTE stage | `brand-kit` (OKLCH extraction) | ⬜ Pending — audit existing PaletteStage UI vs prototype fidelity |
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

## Row 1 — done (2026-08-25)

Built: `backend/src/modules/brand-kit/contact-fields.js` (7-field catalogue: company_name,
primary/secondary email, primary/secondary phone, address1/2 — stored via Application Settings,
`owner_module: 'brand-kit'`, values in theme-engine's `SettingValue` table, zero migration),
`GET/PUT /api/brand-kit/:projectId/contact`, rewrote `IntakeStage.tsx` with the real form, wired
`collateral`'s `resolveBrandKit()` to populate `company.email/phone/addressLines` (previously always
empty despite print layouts already reading them). Full detail: `.agents/HANDOFF.md`, entry dated
2026-08-25.

Deliberately NOT touched: brand-kit's own logo upload flow (already real, has sanitization/retention
logic — routing it through the generic engine would be a regression, not an improvement).

## Row 2 — next up

Not started. First step when picked up: read `frontend/src/app/admin/template-engine/_components/stages/PaletteStage.tsx`
and compare against the prototype's Color Palette screen (4 named groups — Primary/Secondary/Tertiary/Quaternary
— each with a 10-step tint/shade ramp) to find the actual gap, the same way row 1 started with reading
`IntakeStage.tsx` before assuming what was missing.
