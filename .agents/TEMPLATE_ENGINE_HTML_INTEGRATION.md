# Template Engine — HTML Prototype Integration

Tracks the page-by-page port of the brand+CMS design prototype into the live
`/admin/template-engine` Studio flow. Replaces the previous version of this file (2026-08-26) —
its pending-rows list did not match the actual requirement; that list is not carried over. Pending
work below is defined by the user one item at a time, not assumed in advance.

Ground rule set by the user: reuse what's already real (`brand-kit`, `theme-engine`, `collateral`,
`page-builder`, `credits`) instead of rebuilding; use the Application Settings engine
(Type/Category/SettingField, `owner_module` scoped) for flat config pieces that have no dedicated
module yet — never invent a new Prisma migration where the generic engine already fits.

## Done so far

### Overview / contact intake (INTAKE stage)
- Studio project-picker landing page removed — `/admin/template-engine` redirects straight to the
  default project's flow.
- Standalone (`owner_module: null`) Application Settings fields: Type "Brand Profile"
  (`brand-profile`) → Category "Logo & Contact Details" (`brand-profile.logo-contact`) → 8 fields
  (Logo file + company name, primary/secondary email, primary/secondary phone, address1/2), seeded
  via `backend/prisma/seeders/brand-profile-fields.seed.js`.
- `IntakeStage.tsx` ("Overview") renders these via the real shared `FieldControl` component
  (`GET /setting-fields/by-type/brand-profile`, `POST /setting-fields/values`) — the same component
  `/admin/settings/view/[slug]` uses. Logo upload stays on brand-kit's own endpoint (drives real
  sanitization + OKLCH extraction).
- One consolidated "Next" action (was two competing buttons); required-field indicators (red
  asterisks + inline errors) instead of a silently-disabled button; logo shows an actual thumbnail;
  successful advance now navigates to `/palette` (previously saved but didn't route).
- `backend/src/modules/brand-kit/contact-fields.js` (per-project hidden fields from an earlier,
  corrected attempt) and its `/contact` routes are orphaned — nothing calls them, not yet deleted.

### Color Palette (PALETTE stage)
- Rebuilt from a static stub into a real editor — four groups, matching the backend's actual
  `palette.colors` shape: **Primary/Secondary/Accent/Neutral**.
- Each group: editable base hex, logo eyedropper (canvas pixel sample; falls back to a toast on a
  CORS-tainted canvas — not yet verified against real MinIO CORS headers), live-regenerated
  10-step OKLCH ramp via `frontend/src/lib/oklch-ramp.ts` (client-side port of
  `backend/src/modules/brand-kit/palette.js`'s ramp math).
- New `usePatchBrandKit` hook (PATCH endpoint existed, had no frontend consumer).
- Known gap: editing the palette doesn't recompute `contrast_report` on the backend; approval only
  checks acknowledgment of the possibly-stale existing adjustments.

### Backend orchestrator (all 9 stages)
- 9-stage DAG (`intake → palette → inference → approval → guidelines → collateral → website →
  preflight → export`) — all 9 stages are real drivers calling their upstream module, none are
  `UPSTREAM_NOT_BUILT` stubs.
- `projects` module built to scope runs; `X-Project-Id` validated server-side (404/403) on all
  mutation/read routes.
- One-install fix: installing `template-engine` auto-installs `theme-engine-ui` / `page-builder-ui`
  / `projects`; nav relabeled Studio → Template Engine; dead Credits nav entry removed.

Test state as of last touch: frontend 199/199, backend 1257/1257.

## Pending

Not pre-listed here. Tell me the next item and I'll scope + build it, updating this file as it
lands.
