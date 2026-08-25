# Brand Kit — KDL Starter Kit
# Module Design Document (Template Engine follow-on, Phase 3)

**Author:** Claude (Paperclip AI Services) — for approval by Prasanna (web@f9tech.com)
**Date:** 2026-08-18
**Status:** SPEC v1 — awaiting board review before implementation subtasks are created
**Issue:** KDL-451
**Parent:** KDL-446 (PRODUCT_MODES_ARCH — adopted)
**Sequenced after:** `projects` (multi-project workspaces must exist before a brand-kit can be scoped to one)

---

## What this is and why it matters

Brand Kit is the real IP of the Template Engine product. The other pieces (credits, collateral, the DAG orchestrator) are scaffolding; this is the differentiator. It does three things no template tool does well:

1. **Logo → palette** — deterministic, pixel-accurate colour extraction. No AI hallucination risk; just canvas maths.
2. **Palette → typography + tone** — genuine AI inference that replaces the prototype's five industry-string regexes with a real model call via our existing `ai-services` workspace.
3. **Brand guidelines PDF** — generated artefact that a client can hand to a printer, web agency, or marketing team.

All three are hidden behind a stable `BrandKit` interface. The collateral engine and the 9-stage DAG orchestrator call that interface; they are never coupled to its internals.

---

## Read scope

| Working on | Read |
|---|---|
| Phase A (backend module + DB) | §Schema, §API contract, §Module structure, Phase A steps |
| Phase B (logo intake + palette) | §Logo intake, §Palette extraction, §API contract, Phase B steps |
| Phase C (AI inference chain) | §AI inference, §ai-services chain, Phase C steps |
| Phase D (PDF generation) | §PDF spec, Phase D steps |
| Phase E (frontend) | §Frontend, §API contract, Phase E steps |
| Review / QA | whole doc |

---

## 1. Schema

Add to `backend/prisma/schema/` (new file `brand-kit.prisma`):

```prisma
model BrandKit {
  id          String   @id @default(cuid())
  project_id  String   @unique               // 1:1 with Project; enforced at DB level
  status      BrandKitStatus @default(DRAFT)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  logo        BrandLogo?
  palette     BrandPalette?
  typography  BrandTypography?
  tone        BrandTone?
  guidelines_pdf_key String?                 // storage key into the existing media/storage layer

  @@index([project_id])
}

model BrandLogo {
  id              String   @id @default(cuid())
  brand_kit_id    String   @unique
  brand_kit       BrandKit @relation(fields: [brand_kit_id], references: [id], onDelete: Cascade)
  storage_key     String                     // key in the existing storage layer (S3/local)
  original_name   String
  mime_type       String                     // image/svg+xml | image/png | image/webp
  width_px        Int?
  height_px       Int?
  file_size_bytes Int
  uploaded_at     DateTime @default(now())
}

model BrandPalette {
  id           String   @id @default(cuid())
  brand_kit_id String   @unique
  brand_kit    BrandKit @relation(fields: [brand_kit_id], references: [id], onDelete: Cascade)
  primary_hex  String                        // dominant colour from logo extraction
  accent_hex   String?                       // second most prominent non-neutral colour
  neutral_hex  String                        // computed neutral (desaturated primary)
  ramps        Json                          // PaletteRamps — see §Palette extraction
  contrast     Json                          // ContrastReport — WCAG AA/AAA pairs
  approved_at  DateTime?                     // null = proposed; non-null = pushed to theme-engine
  theme_push_at DateTime?                    // timestamp of last POST /api/theme-engine/values
}

model BrandTypography {
  id              String   @id @default(cuid())
  brand_kit_id    String   @unique
  brand_kit       BrandKit @relation(fields: [brand_kit_id], references: [id], onDelete: Cascade)
  heading_font    String                     // Google Fonts slug (e.g. "Playfair Display")
  body_font       String                     // Google Fonts slug (e.g. "Source Sans 3")
  heading_weight  String   @default("700")
  body_weight     String   @default("400")
  inference_model String?                    // which ai-services model produced this
  inference_raw   Json?                      // full structured response (audit trail)
  fallback_used   Boolean  @default(false)   // true = rule-table was used (ai-services unavailable)
  approved_at     DateTime?
}

model BrandTone {
  id              String   @id @default(cuid())
  brand_kit_id    String   @unique
  brand_kit       BrandKit @relation(fields: [brand_kit_id], references: [id], onDelete: Cascade)
  voice           String                     // e.g. "authoritative", "warm", "playful"
  personality     String[]                   // 3–5 adjectives
  tagline_hint    String?                    // suggested tagline framing (not the tagline itself)
  strategy_copy   String                     // 2–3 sentence brand strategy statement
  inference_model String?
  fallback_used   Boolean  @default(false)
  approved_at     DateTime?
}

enum BrandKitStatus {
  DRAFT         // created; logo not yet uploaded
  LOGO_READY    // logo uploaded; palette not yet extracted
  PALETTE_READY // palette extracted; awaiting AI inference
  INFERRED      // AI inference complete; awaiting human approval
  APPROVED      // approved; palette pushed to theme-engine; PDF generated
}
```

**Migration discipline:**
- `prisma validate` → run up → run down → run up; post row counts.
- No direct relation to the Theme Engine's `SettingValue` table — the push is a service-layer API call.

---

## 2. API contract (public surface — never break these)

All routes mount under `/api/brand-kit` when the `brand-kit` module is enabled.

```
POST   /api/brand-kit/:projectId/logo          — upload logo (multipart/form-data)
GET    /api/brand-kit/:projectId               — fetch full BrandKit state
POST   /api/brand-kit/:projectId/extract       — trigger palette extraction (idempotent)
POST   /api/brand-kit/:projectId/infer         — trigger AI typography+tone inference
POST   /api/brand-kit/:projectId/approve       — approve inferred brand; push palette to theme-engine; enqueue PDF
GET    /api/brand-kit/:projectId/pdf           — download brand-guidelines PDF (302 → signed URL)
DELETE /api/brand-kit/:projectId/logo          — remove logo; resets status to DRAFT
```

The collateral engine and DAG orchestrator call **only these routes**. They do not import from this module. Do not add internal helpers to the public surface.

### Response envelope
All responses use the existing `successResponse`/`errorResponse` helpers from `backend/src/shared/`.

### Auth + RBAC
`requirePermission('brand_kit:manage')` on all write routes; `requirePermission('brand_kit:read')` on GETs. Seed these permission slugs.

### Idempotency
`POST /extract` and `POST /infer` are idempotent: calling them again when the relevant data already exists returns the existing data with `{ cached: true }`. Force re-run with `?force=true`.

---

## 3. Logo intake

### Accepted formats
`image/svg+xml`, `image/png`, `image/webp`. Reject anything else with `422`. Max file size: 10 MB.

### Storage
Use the **existing storage layer** (`backend/src/modules/storage-settings`). Store under key `brand-kit/{projectId}/logo/{uuid}.{ext}`. The storage key goes into `BrandLogo.storage_key`. Do not duplicate the file — never load it into memory twice.

### Pre-processing (server-side, no canvas needed yet)
After upload:
1. Validate MIME type and file header (magic bytes), not just Content-Type.
2. For SVG: sanitise with `DOMPurify` (already used for CSS injection in KDL-274/M12) — strip `<script>`, external references, `href` pointing off-domain. Store the sanitised copy.
3. For PNG/WEBP: use `sharp` (already a dependency) to read `{ width, height, size }` and store dimensions in `BrandLogo`. Reject images narrower than 100 px.
4. Advance `BrandKit.status` to `LOGO_READY`; write `activity_log`.

### No background job for upload itself
The sanitise + dimension check is synchronous and fast. Do it inline in the route handler. The palette extraction step (slow) is a separate explicit trigger.

---

## 4. Palette extraction

This is **pure deterministic computation** — no AI, no network. It must be fast enough to run in an HTTP request (target < 2 s for a 4 MB PNG).

### Dominant colour algorithm
Use `sharp` to resize the logo to 150 × 150 px (maintains aspect ratio, fills remainder with white), then convert to raw RGB bytes. Walk the byte array, bucket each pixel into a 6-bit-per-channel colour cube (4096 buckets), find the N largest buckets by pixel count, filter out near-white (L > 0.9 in CIELAB) and near-black (L < 0.1). The largest surviving bucket gives `primary_hex`; the second gives `accent_hex` (if its count is > 5% of primary's count — otherwise null). If no non-neutral colour is found, fall back to `#1A1A2E` (house default primary) and log a warning.

For SVG: rasterise to PNG first via `sharp` before the above. `sharp` accepts SVG input natively.

### 10-step variant ramps
For each of `primary`, `accent`, `neutral`:

```
ramp[0]  = lightest tint  (mix with white, 90%)
ramp[1]  = 80% tint
...
ramp[4]  = 10% tint
ramp[5]  = base colour
ramp[6]  = 10% shade (mix with black)
...
ramp[9]  = darkest shade (mix with black, 90%)
```

Colour mixing in CIELAB (perceptual, not sRGB) using the `culori` package (add if not already present). Output as hex strings. Store in `BrandPalette.ramps`:

```ts
type PaletteRamps = {
  primary: string[10];
  accent: string[10] | null;
  neutral: string[10];
};
```

`neutral` is derived by desaturating `primary` to 0 chroma in CIELAB then adjusting L to 0.5 as the base.

### Contrast report (WCAG)
For every ramp × ramp pair in { primary, accent, neutral } (including same-ramp cross-step), compute the WCAG 2.1 contrast ratio. Record only pairs that meet AA (4.5:1 for small text) or AAA (7:1). Store as:

```ts
type ContrastReport = {
  aa_pairs: Array<{ fg: string; bg: string; ratio: number }>;
  aaa_pairs: Array<{ fg: string; bg: string; ratio: number }>;
};
```

This gives the frontend everything it needs to show "safe pairs" for typography placement.

### After extraction
Advance `BrandKit.status` to `PALETTE_READY`. Write `activity_log`. The extraction result is proposed — not yet applied to theme-engine (that happens at `approve`).

---

## 5. AI typography + tone inference

### What replaces the prototype's regexes
The prototype (`inferTypography`, `inferTone`) maps an `industry` string through five regex patterns to hardcoded font pairs and tone labels. That is a look-up table, not inference. Board decision D2: replace with a real model call.

The replacement is a new chain in `ai-services`: `brand-inference-chain.js`.

### Chain design

**Location:** `ai-services/src/chains/brand-inference-chain.js`

**Inputs:**
```ts
type BrandInferenceInput = {
  companyName: string;
  industry: string;
  primaryHex: string;       // extracted dominant colour
  logoDescription?: string; // optional; for future vision-capable models
};
```

**Model routing:** call `brainRouter` with priority `HIGH` (uses Claude — `claudeBrain` — never OpenRouter; this is a billable, IP-generating call; credits will gate it once KDL-credits module ships).

**Structured output:** use Claude's tool-use API to guarantee a parseable response. Define a single tool:

```json
{
  "name": "brand_inference_result",
  "description": "Return the brand inference result in structured form.",
  "input_schema": {
    "type": "object",
    "required": ["heading_font", "body_font", "heading_weight", "body_weight",
                 "voice", "personality", "tagline_hint", "strategy_copy"],
    "properties": {
      "heading_font":    { "type": "string", "description": "Google Fonts slug for headings" },
      "body_font":       { "type": "string", "description": "Google Fonts slug for body text" },
      "heading_weight":  { "type": "string", "enum": ["400","500","600","700","800","900"] },
      "body_weight":     { "type": "string", "enum": ["300","400","500"] },
      "voice":           { "type": "string", "description": "Single adjective: tone of voice" },
      "personality":     { "type": "array", "items": { "type": "string" }, "minItems": 3, "maxItems": 5 },
      "tagline_hint":    { "type": "string", "description": "One-sentence tagline framing" },
      "strategy_copy":   { "type": "string", "description": "2–3 sentence brand strategy statement" }
    }
  }
}
```

The chain calls `claudeBrain` with `tool_choice: { type: 'tool', name: 'brand_inference_result' }`. Parse `response.content[0].input` (Anthropic tool-use response shape) — no regex parsing on the LLM output.

**System prompt skeleton:**
```
You are a senior brand strategist and typography director. Given a company name, industry, and primary brand colour, infer:
- A heading font + body font pairing from Google Fonts that fits the brand's implied market position
- Typography weights
- A tone of voice (single defining adjective)
- 3–5 personality adjectives that differentiate this brand
- A tagline framing hint
- A 2–3 sentence brand strategy statement

Constraints:
- Choose real, widely-available Google Fonts — no obscure or deprecated fonts
- The heading font must be distinct from the body font
- The strategy copy must be concrete: name the client's industry, their implied audience, and their differentiator. Avoid platitudes.
- Do not invent facts about the company; work only from what is provided.
```

**Credit gate (stub for now):** before calling the chain, check `GET /api/credits/:projectId/balance`. If balance = 0, return `{ error: 'INSUFFICIENT_CREDITS' }` — do not call the model. This stub is what the credits module will fill in; wire it to `balance > 0` placeholder until KDL-credits ships.

**After successful inference:**
- Write `BrandTypography` and `BrandTone` rows with `inference_model` set from `response.model`.
- Store `inference_raw = { tool_use_response }` for audit.
- Advance `BrandKit.status` to `INFERRED`.
- Write `activity_log`.

### Offline fallback (rule table)

If the AI call fails (model error, budget exhausted, timeout > 15 s), fall back to the rule table from the prototype. Store the rule table in `ai-services/src/chains/brand-inference-fallback.js` as a plain export — not inline in the chain. Set `fallback_used = true` on both `BrandTypography` and `BrandTone`. Write a warning to `activity_log`.

Fallback table covers 10 industry categories (healthcare, legal, construction, hospitality, education, technology, retail, finance, creative, other). Map via lowercase includes-check on `industry`. Each entry provides: `heading_font`, `body_font`, `voice`, `personality[3]`, `tagline_hint`, `strategy_copy` (generic template, filled with `companyName`).

---

## 6. Approval + theme-engine push

`POST /api/brand-kit/:projectId/approve` does three things atomically (catch errors individually; partial success is better than nothing):

1. **Set `approved_at`** on `BrandPalette`, `BrandTypography`, `BrandTone`.
2. **Push palette to theme-engine.** Call `POST /api/theme-engine/values` with the approved palette mapped to the correct `platform` + `type_id` token names. The mapping:
   - `primary_hex` → `color.primary` token
   - `ramps.primary[0..9]` → `color.primary-50` through `color.primary-950`
   - `accent_hex` → `color.accent` (skip if null)
   - `neutral_hex` → `color.neutral`
   - `heading_font` → `typography.font-heading`
   - `body_font` → `typography.font-body`
   Push for `platform = 'webapp'` first; push for all platforms in parallel. Record `BrandPalette.theme_push_at`.
3. **Enqueue PDF generation.** Write a `BrandKitPdfJob` record (table below) and emit an event that the PDF worker picks up. Do **not** block the HTTP response on PDF generation.
4. **Advance `BrandKit.status` to `APPROVED`.**

```prisma
model BrandKitPdfJob {
  id           String   @id @default(cuid())
  brand_kit_id String   @unique
  status       PdfJobStatus @default(PENDING)
  started_at   DateTime?
  completed_at DateTime?
  error        String?
  @@index([status])
}

enum PdfJobStatus { PENDING IN_PROGRESS DONE FAILED }
```

---

## 7. Brand-guidelines PDF spec

Generated by a **Node.js worker** in the backend (not the frontend — server-side rendering keeps fonts deterministic and avoids SSR hydration issues). Use `@react-pdf/renderer` (add dependency).

### Contents (in order)
1. **Cover page** — logo at 60% page width, company name, generation date
2. **Brand Palette** — primary, accent, neutral colour blocks with hex values + 10-step ramps shown as swatches
3. **Typography** — heading font specimen (A–Z, 0–9, sample phrase at 48 pt / 36 pt / 24 pt), body font specimen at 16 pt, weight callout
4. **Safe Colour Pairs** — table of AA-passing and AAA-passing foreground/background combinations from `BrandPalette.contrast`
5. **Tone & Voice** — `voice` label, `personality` adjective grid, `strategy_copy` paragraph, `tagline_hint`
6. **Usage guidelines** — three short rules: (a) do not stretch the logo, (b) minimum clear-space = logo height × 0.25, (c) approved colour pairs only on brand-critical surfaces

### Output
Store via existing storage layer under `brand-kit/{projectId}/guidelines.pdf`. Set `BrandKit.guidelines_pdf_key`. Advance `BrandKitPdfJob.status` to `DONE`. `GET /api/brand-kit/:projectId/pdf` returns 302 to a signed download URL.

On failure: set `BrandKitPdfJob.status = FAILED`, record `error`. The `/pdf` route returns 404 with `{ error: 'PDF_NOT_READY' }` until a successful job exists.

---

## 8. Module structure

```
backend/src/modules/brand-kit/
  module.json         — manifest; dependsOn: ['projects', 'theme-engine', 'media']
  index.js            — registers routes via moduleGate
  controller.js       — HTTP handlers (upload, extract, infer, approve, pdf)
  service.js          — BrandKitService; calls palette-extractor, ai chain, theme-engine
  palette-extractor.js — all canvas/sharp maths; pure functions; no DB access
  pdf-worker.js       — @react-pdf/renderer; invoked by service.approve()
  router.js

ai-services/src/chains/
  brand-inference-chain.js       — AI inference chain (tool-use)
  brand-inference-fallback.js    — rule table fallback
```

### module.json excerpt
```json
{
  "slug": "brand-kit",
  "name": "Brand Kit",
  "version": "1.0.0",
  "core": false,
  "dependsOn": ["projects", "theme-engine", "media"],
  "conflictsWith": [],
  "owner_module": "brand-kit",
  "nav": {
    "label": "Brand Kit",
    "icon": "Palette",
    "href": "/admin/brand-kit",
    "section": "studio"
  }
}
```

---

## 9. Frontend admin screen

**Route:** `/admin/brand-kit` (gated by `<ModuleGuard slug="brand-kit" />`).

**Single-page flow** — no wizard steps, no separate pages. The page shows the brand kit's current status and surfaces available actions inline.

### States and what the user sees

| Status | Page shows | Available action |
|---|---|---|
| DRAFT | Upload zone (drag-and-drop SVG/PNG/WEBP, 10 MB max) | Upload logo |
| LOGO_READY | Logo preview + "Extract palette" button | Extract palette |
| PALETTE_READY | Palette swatch grid (primary/accent/neutral ramps, contrast pairs) + "Run AI inference" button | Run inference |
| INFERRED | Palette + typography specimen + tone card — all editable inline | Approve / Edit fields |
| APPROVED | Full brand kit view (palette, type, tone) + download PDF button | Re-run inference / Upload new logo |

### Inline editing (INFERRED state)
Typography and tone fields are editable before approval. Font names use a typeahead backed by the Google Fonts list (static JSON, not a live API call). Personality adjectives are tag inputs (max 5). Saving edits writes directly to `BrandTypography`/`BrandTone` without triggering a new inference call.

### Colour preview
Show the logo on a white background and a dark background side-by-side. Render the heading specimen using the inferred `heading_font` (load via `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...">` dynamically). This is the only Google Fonts call; do not load fonts in SSR.

### No parallel palette editors
The Theme Engine UI is in read-only mode while brand-kit is in use (PRODUCT_MODES_ARCH §3). Do not duplicate colour editing here. The "Edit" affordance for palette is limited to: swap primary and accent; override primary hex (text input). Re-extraction is triggered only by uploading a new logo.

---

## 10. Gates (before marking KDL-451 done)

- `prisma validate` exit 0; migration up → down → up cleanly.
- Backend vitest: `brand-kit` module routes tested with supertest (upload, extract, infer, approve, pdf-not-ready, pdf-redirect).
- `palette-extractor.js` unit tests: known PNG → expected dominant hex ± 5 (hex tolerance), ramps produce 10 steps, ramp[5] == base, contrast pairs all pass WCAG formula.
- `brand-inference-chain.js` unit tests: mock Claude to return a valid tool-use response → parsed correctly; mock Claude to throw → fallback used, `fallback_used = true`.
- Frontend `pnpm type-check` exit 0.
- **Browser gate** (localhost:3101): upload a PNG logo, extract palette (swatches appear), run AI inference (typography specimen + tone card appear), approve (no error toast), navigate to Theme Engine → primary colour updated, download PDF (file downloads, opens cleanly in Preview).
- PDF content gate: confirm PDF contains logo image, at least 3 palette swatches, heading font name, strategy copy text.

---

## 11. Decisions made here (do not re-open)

| ID | Decision |
|---|---|
| BK-D1 | Colour extraction is deterministic sharp/ramp maths. No ML colour model. Reason: consistent, auditable, zero model cost. |
| BK-D2 | AI inference uses tool-use structured output. No regex parsing of LLM prose. |
| BK-D3 | Fallback rule table lives in ai-services (same workspace as the chain) — not in the backend module. It stays co-located with the AI code it replaces, not scattered into domain logic. |
| BK-D4 | PDF generation is server-side (`@react-pdf/renderer` worker). Not a headless-Chromium approach — adds a binary dependency that complicates Docker. |
| BK-D5 | Approval is the only action that writes to theme-engine. Extraction and inference are read-only proposals until the human approves. |
| BK-D6 | Credits gate is a stub (`balance > 0` unconditional pass) until KDL-credits ships. The gate call site is wired so credits can fill it in without touching brand-kit code. |

---

## 12. Open questions (raise with board — do not implement without answers)

- **OQ-BK-1** — Raster logo extraction: should the dominant-colour algorithm exclude the logo's transparent background (PNG alpha channel)? Assume yes (ignore alpha = 0 pixels); confirm.
- **OQ-BK-2** — Multi-project: when projects ship, is a brand kit 1:1 with a project (`project_id UNIQUE`) or can one brand kit be shared across projects (a "brand" entity above projects)? The schema assumes 1:1. If shared brands are in scope, the schema needs a `Brand` table and this decision must be revisited before Phase 3 begins.
- **OQ-BK-3** — Google Fonts vs self-hosted: the PDF and the admin preview load fonts from Google Fonts. If the product is deployed in a restricted-network environment (some enterprise clients), this breaks silently. Should we bundle a curated font subset? Raise with the board.
- **OQ-BK-4** — Brand-kit edit history: should edits to typography/tone before approval be versioned (so a human can see the AI's original inference vs what they changed)? The current schema does not version these rows.

---

## Phase implementation steps (for subtask creation after board approval)

These are the subtasks to create once the board approves this spec. **Do not create them before approval.**

| Subtask | Scope |
|---|---|
| KDL-451-A | Schema + migration; `brand-kit` module scaffold; RBAC seeds |
| KDL-451-B | Logo upload route + sanitise + sharp dimension check; storage integration |
| KDL-451-C | Palette extractor (`palette-extractor.js`) + unit tests |
| KDL-451-D | `brand-inference-chain.js` (tool-use) + fallback table + unit tests |
| KDL-451-E | Approve route + theme-engine push + PDF job enqueue |
| KDL-451-F | PDF worker (`@react-pdf/renderer`) + PDF content gate |
| KDL-451-G | Frontend admin screen + browser gate |
