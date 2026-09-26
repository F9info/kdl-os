# Template Engine — Intake → Body-Copy AI Generation

## Background

A full-pipeline audit (2026-09-24) walked the intended developer workflow — Settings → Theme
Engine → Template Engine intake → navigation/pages → Header/Footer → page editing → launch —
end to end and found one gap of the four reported: **intake form data never reaches page body
copy.**

Brand/contact data (company name, phone, email, address, logo, palette) already flows correctly
from the intake form into Header/Footer/NavBar/TaglineStrip via `patchBrand()` and
`patchConstructionContact()` in `backend/src/modules/template-engine/drivers/website-seed-content.js`.
But Hero taglines, About paragraphs, and Services/Disciplines blurbs are static English marketing
copy (`CONSTRUCTION_HERO_HOME`, `CONSTRUCTION_ABOUT_SPLIT`, etc. — ~1500 lines) with zero
intake-derived interpolation beyond what those two patch functions cover. Every "make this real
content" fix made earlier in the Subhadra Group build was manual page-builder editing after the
fact — the pipeline itself has no path from intake → per-section marketing copy.

User picked this as the highest-priority fix among the four audited gaps.

## Current state (verified in repo)

- `backend/src/modules/template-engine/drivers/index.js` — 9-stage DAG (`intake`, `palette`,
  `inference`, `approval`, `guidelines`, `collateral`, `website`, `preflight`, `export`). The
  `website` stage is idempotent/patch-based: re-advancing it creates any page that doesn't exist
  yet and patches (never re-seeds wholesale) any page that does.
- `backend/src/modules/brand-kit/service.js` `inferBrandKit()` — the existing precedent for an
  explicit, credit-gated AI action: takes `{ industry, companyName, idempotencyKey, userId, ... }`
  from `req.body`, calls the AI brain, records `model`/envelope metadata, wrapped in
  `withCreditHold`. This is the pattern to extend, not replace.
- `ai-services/src/brains/claude.js` — the AI call path `inferBrandKit` already uses (via
  `ai-services/src/services/brand-inference.js`). Body-copy generation reuses this same brain —
  it's client-facing content, the same class of call brand inference already makes.
- `ai-services/src/agents/content.js` — a generic unwired `ContentAgent` base class. Not currently
  called by anything. Available to build on if its shape fits; not a hard dependency of this spec.
- Settings (`types`/`categories`/`setting-fields`) is fully dynamic end-to-end — a Field added to
  the `brand-profile` Type via Settings automatically appears on the Intake form and is fetchable
  live via `useWebsiteBrandContext.ts`. No frontend form code change is needed to add a field.
- `frontend/src/app/admin/template-engine/_components/stages/WebsiteStage.tsx` — where nav/page
  selection already lives (`SUGGESTED_PAGES`, `addCustomPage()`, `togglePage()`) — the natural
  home for a new "Generate content with AI" action.

## Scope for this phase

**In scope:**
- One new `brand-profile` Setting Field: a short free-text business/services description —
  the primary content signal beyond company name/industry.
- A "Generate content with AI" action on the WEBSITE stage screen.
- Generation covers three component types in v1: `ConstructionHero`, `ConstructionAboutSplit`,
  `ConstructionDisciplinesGrid` (present on every generated site's home page).
- Overwrite-safety: only patches a field that is still exactly its static-seed default value.
- Credits integration via the existing `withCreditHold` pattern.
- Graceful no-op on failure/insufficient credits — static seed copy is the permanent fallback,
  never removed.

**Out of scope (explicitly deferred, not part of this pass):**
- Testimonials, Services grid, Products showcase, and any other component type — same mechanism
  extends to them later without new architecture; not built now to keep the first slice reviewable.
- Regenerating/diffing previously-generated copy (decided: generation never touches a field once
  it's no longer at its default — "regenerate this one section" is a future action, not this one).
- Any change to the `ContentAgent` class or a general-purpose content API — this spec adds one
  narrow, template-engine-specific generation path, not a reusable content service.
- Non-construction industry packs (`general`, `medical`) — construction is the only pack with real
  production usage right now; the same pattern applies to other packs later.

## Design

### 1. New Setting Field: business description

Added the ordinary way — a `setting_fields` row owned by the `brand-profile` type (via the
Settings admin UI or a seed migration, `owner_module` left `null` like other user-editable
fields), type `textarea`, ~2-3 sentence guidance copy. Shows up on the Intake form automatically
per the existing dynamic-fields mechanism — no `IntakeStage.tsx` code change.

### 2. Generation trigger: WEBSITE stage action

A button in `WebsiteStage.tsx`, positioned after the nav/page picker, before the stage-advance
control: **"Generate content with AI"**. Disabled until the business description field has a
value (nothing meaningful to generate from otherwise). On click:

1. Frontend calls a new endpoint, `POST /api/template-engine/runs/:runId/stages/website/generate-copy`
   — matches the existing `.../stages/:stage/advance|retry|skip` action-route convention in
   `template-engine/routes.js` exactly, just one more stage action alongside those three.
2. Backend resolves the current `resolveWebsiteBrand()` output (already does this for
   `patchBrand`) plus the new business-description field, and the project's current page list.
3. For each of the 3 in-scope component types found on the home page, checks each in-scope prop
   against its known static-seed default (see §4). Any prop still at default is sent to the AI
   brain for generation; anything else (hand-edited) is left untouched and never sent.
4. AI call goes through `withCreditHold`, same idempotency-key transport pattern as
   `inferHandler` (`X-Idempotency-Key` header, generated server-side when absent).
5. On success: patch the generated copy into `builder_pages.data.content` for the affected
   block(s), same `jsonb`-merge mechanics `patchBrand`/`patchConstructionContact` already use.
6. On failure (AI error, insufficient credits): surface the error to the developer (toast, same
   pattern `WebsiteStage.tsx` uses elsewhere) and leave all content exactly as it was — no partial
   writes.

### 3. AI call shape

Reuses `ai-services/src/brains/claude.js` directly — same brain, same envelope/model-tracking
metadata shape `brand-inference.js` already produces (`model`, tokens, etc., for cost tracking
consistency with the rest of the app). Prompt includes: company name, industry, the new business
description, and the target component's field list with a short description of what each field
is for (e.g. "Hero headline — max ~8 words, benefit-led"). Response is parsed into the exact
prop shape each component's `defaultProps` already defines — reuses the real field names
(`d2Slide1HeadlineLead` etc. — or, given the ArrayField refactor from earlier this session,
`d2Slides[].lead` etc.) so no new prop-shape translation layer is needed.

### 4. "Still at default" detection

Each of the 3 in-scope components' current static defaults (from `website-seed-content.js`'s
`CONSTRUCTION_HERO_HOME`/`CONSTRUCTION_ABOUT_SPLIT`/`CONSTRUCTION_DISCIPLINES_GRID`-equivalent
constants) become the comparison baseline — a field counts as "still default" if its current
stored value strictly equals that constant's value. This mirrors the existing pattern in
`patchBrand`/`patchConstructionContact`, which already does this kind of "only touch it if it's
still the placeholder" check for brand/contact fields — extending an established convention, not
inventing a new one.

### 5. Idempotent WEBSITE-stage interaction

Generation is a separate, explicit action from advancing the WEBSITE stage — it does not run as
part of `websiteDriver.execute`. This keeps the existing idempotent re-advance behavior
(page/nav creation, brand/contact patching) completely unchanged; AI generation is additive and
optional on top of it, never a required part of advancing the stage.

## Testing

- Unit: "still at default" detection for each of the 3 component types (default value / hand-edited
  value / partially-edited array item).
- Unit: AI response → prop-shape mapping for each component type, including the array-based Hero
  slides shape.
- Integration: credit-hold failure path leaves `builder_pages` untouched.
- Integration: full generate action against a fresh (all-default) page patches all 3 component
  types; against a page with 1 of 3 hand-edited leaves that one alone.
- No live/manual AI-call verification in CI (matches existing brand-kit inference test convention
  of mocking the AI brain call).

## Decisions log

- Explicit opt-in trigger, not automatic-on-advance — matches `inferBrandKit`'s existing pattern
  and avoids surprise credit spend / accidental overwrite on every wizard re-run.
- Never overwrite a field that's no longer at its static default — hand edits are always safe,
  no confirmation dialog needed.
- v1 scope is 3 component types (Hero/About/Disciplines), not "every text field on the page" —
  keeps the first slice reviewable; same mechanism extends later.
- Reuses the existing Claude-brain AI path brand-kit inference already uses, not a new provider
  or local-MLX path — this is client-facing generated content, same class of call.

## Amendment (2026-09-24, during planning)

**v1 scope corrected from "Hero, About, Disciplines" to "Hero, About" only.** Planning found
`ConstructionDisciplinesGrid` is not part of the generic `template-engine` seed set at all —
`website-seed-content.js` has no `CONSTRUCTION_DISCIPLINES`-equivalent constant. Disciplines Grid
was added directly to the live Subhadra Group page this session as brand-specific work, never to
the generic pipeline this feature patches. `ConstructionHero` and `ConstructionAboutSplit` are
both confirmed present on every generated home page — the mechanism still extends to Disciplines
(or any other component) later without new architecture, per the existing "same mechanism extends
to them later" decision above; it's just not part of this first pass.

Planning also surfaced a real prerequisite bug, unrelated to this feature but blocking its "still
at default" comparison: `CONSTRUCTION_HERO_HOME` (and `genericConstructionHero`, used for every
non-home page) still emit the old flat `d1SlideN*`/`d2SlideN*` Hero props from before this
session's ArrayField refactor — every newly-seeded project currently gets an empty Hero slider.
Fixed as Task 1 of the implementation plan, ahead of and independent of the AI-generation work.
