# SPEC — `collateral` module (Template Engine follow-on)

- **Issue:** KDL-452
- **Parent:** KDL-446 (PRODUCT_MODES_ARCH + Phase 0) — done
- **Status:** SPEC (implementation blocked — see §12)
- **Author:** CEO
- **Arch source of truth:** `.agents/PRODUCT_MODES_ARCH.md` §7 (module decomposition, item 4), D1/D2/D3
- **Sequencing:** `projects` (KDL-449) → `credits` (KDL-450) → `brand-kit` (KDL-451) → **`collateral` (this)** → `template-engine` orchestrator (KDL-453)

---

## 1. Purpose & scope

`collateral` turns an approved **brand kit** into print-ready, on-brand physical/print artifacts and their
editable/exportable files. It is a **Mode A / Studio** product-surface capability driven by the
`template-engine` orchestrator; it never re-derives brand decisions — it **consumes `brand-kit` output** and
renders it into fixed print geometries.

### v1 artifact set (from arch §7.4)
1. **Visiting card** (business card) — double-sided.
2. **Letterhead** — A4 + US Letter; editable Word output.
3. **T-shirt** print — front/back garment print art.
4. **ID card** — CR80 employee/access card, double-sided.

### Deliverables per artifact
- On-screen preview at true proportions.
- **Print-ready PDF** (correct trim size, 3 mm bleed, crop marks, 300 DPI raster floor).
- **Word (.docx)** where the artifact is a document the client will keep editing (letterhead; optionally ID/card data-merge). Non-document artifacts (t-shirt art) export **PDF + PNG@300DPI (transparent)** instead of Word.

### Non-goals (v1) — see §13
Mailing/print-house fulfilment, true device-CMYK color management, variable-data batch merge beyond a single record, envelope/folder/brochure/signage types, direct payment. All are additive later.

---

## 2. Layer placement & module topology

`collateral` is a **Layer 2 Studio-surface** module (not a Layer 1 engine). It follows the same
engine/UI split contract Phase 0 established for theme-engine and page-builder:

| module.json slug | core | nav | dependsOn | conflictsWith | purpose |
|---|---|---|---|---|---|
| `collateral` | `true` | `[]` | `["brand-kit"]` | `[]` | API + render/export engine, always mountable |
| `collateral-ui` | `false` | Collateral admin nav | `["collateral"]` | `[]` | Studio admin screens (toggleable) |

- The **engine half** exposes `/api/collateral/*` and is mounted whenever installed, so the
  `template-engine` orchestrator can drive it headlessly even when no admin UI is shown.
- The **UI half** provides `/admin/collateral` screens; it is a Studio-mode surface. It does **not**
  declare a conflict itself — exclusivity with Toolkit mode is already enforced upstream by
  `template-engine` conflicting with `theme-engine-ui` / `page-builder-ui`.
- Directory layout mirrors existing modules: `backend/src/modules/collateral/{module.json, routes.js,
  controller.js, service.js, schema.js, render/, export/}` and `frontend/src/app/admin/collateral/`.

---

## 3. Consumed interface — `brand-kit` output contract (INPUT)

`collateral` renders from a stable `BrandKit` object produced by `brand-kit` (KDL-451). This SPEC
**defines the fields collateral needs**; the canonical shape is owned by the `brand-kit` SPEC and MUST be
reconciled there (see OQ-C1). Collateral treats this as read-only input, resolved per project.

```ts
interface BrandKit {
  projectId: string;
  version: number;                 // immutable snapshot id collateral pins a render to
  logo: {
    primaryUrl: string;            // vector preferred (SVG); fallback PNG@≥1024
    monochromeUrl?: string;        // for single-colour print (t-shirt/ID engrave)
    safeAreaRatio: number;         // clear-space multiple of logo height
    minWidthMm: number;            // reproduction floor
  };
  palette: {
    // 10-step variant ramps per role, from brand-kit's canvas extraction
    primary: string[]; secondary: string[]; neutral: string[];
    onPrimary: string; onSurface: string;
    // WCAG contrast already validated by brand-kit; collateral re-checks for small print
  };
  typography: {
    heading: FontSpec; body: FontSpec;   // AI-inferred pairing (D2)
    // FontSpec = { family, weights:number[], fallbackStack, licence: 'oss'|'hosted'|'system', fileUrl? }
  };
  company: {
    legalName: string; displayName: string;
    tagline?: string; addressLines: string[];
    phone?: string; email?: string; website?: string;
    gstin?: string;                 // India SME context; optional
  };
  toneHints?: { formality: number; voice: string };  // advisory only for default copy
}
```

**Contract rules**
- Collateral renders are **pinned to `brandKit.version`**; re-running brand-kit does not silently mutate
  an approved card. Re-render is an explicit user/orchestrator action.
- Fonts must resolve through `theme-engine`'s existing font-URL allowlist (KDL — font-URL allowlisting).
  Collateral does **not** introduce a second font loader.
- If a required field is missing, collateral fails preflight with a **named** error (§8) rather than
  rendering a broken artifact.

---

## 4. Artifact catalog — real print geometry

All sizes are **trim size**. Bleed = **3 mm** on every edge unless noted. Safe/quiet zone = **4 mm** inside
trim. Raster floor = **300 DPI**; vectors (logo/text) stay vector in PDF. Crop marks + bleed emitted on the
print-ready PDF only (not on the on-screen preview or the "digital" PDF variant).

### 4.1 Visiting card
- **Trim:** 88.9 × 50.8 mm (3.5 × 2.0 in, India/US standard). Config option: 85 × 55 mm (EU).
- **Sides:** 2 (front/back). Orientation: landscape default, portrait option.
- **Zones:** logo + name/title (front); contact block + tagline + GSTIN (back).
- **Bleed:** 3 mm. Corner radius: 0 (square) default; optional 3 mm rounded.

### 4.2 Letterhead
- **Trim:** A4 210 × 297 mm **and** US Letter 215.9 × 279.4 mm (both generated).
- **Sides:** 1 (single-sided) + optional continuation-page variant (logo-light).
- **Print-safe margin:** 12.7 mm (0.5 in) minimum; header band ≤ 45 mm, footer band ≤ 25 mm.
- **Editable body:** the letter body is a live text region → this is the artifact that gets the **.docx**
  export with header/footer locked and body editable.

### 4.3 T-shirt print
- **Garment sizes are not print geometry** — the deliverable is the **print art**, not the shirt render.
- **Print areas:** Front standard A4 (210 × 297 mm) / A3 (297 × 420 mm) option; back full A3; left-chest
  100 × 100 mm. Configurable placement offset from collar.
- **Constraints:** transparent background; **DTG** path = full-colour RGB PNG@300DPI; **screen-print**
  path = enforce a max spot-colour count (default 4) drawn from `palette` + monochrome logo variant.
- **Mockup vs art:** a shirt mockup is a *preview aid only*; the export is the isolated art file + a
  placement sheet (position/size in mm).

### 4.4 ID card
- **Trim:** CR80 / ISO/IEC 7810 ID-1 = 85.6 × 53.98 mm; corner radius 3.18 mm.
- **Sides:** 2. Front: photo zone (min 25 × 32 mm), name, ID no., role, logo. Back: contact, barcode/QR
  (data-merge field), magstripe keep-out zone documented (no encoding in v1).
- **Bleed:** 2 mm (card printers); safe zone 3 mm; rounded-corner keep-out respected.
- **Photo:** uploaded per-holder; face-safe crop guide; not stored in brand-kit.

> **CMYK note:** browsers/Chromium render sRGB. v1 emits **RGB PDF** with an embedded sRGB profile and a
> documented soft-proof limitation. True device-CMYK (ICC conversion / overprint) is deferred (§13); the
> render layer is structured so a Ghostscript/ICC post-pass can be added without touching artifact specs.

---

## 5. Data model (Prisma) — additive migration

```prisma
model CollateralAsset {
  id           String   @id @default(cuid())
  projectId    String                        // from `projects` (KDL-449)
  type         CollateralType                 // VISITING_CARD | LETTERHEAD | TSHIRT | ID_CARD
  name         String
  brandKitVersion Int                         // pinned snapshot (§3)
  spec         Json                            // resolved geometry + zone content (see §4)
  status       CollateralStatus @default(DRAFT) // DRAFT | READY | ARCHIVED
  createdBy    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  renders      CollateralRender[]
  @@index([projectId, type])
}

model CollateralRender {
  id         String   @id @default(cuid())
  assetId    String
  asset      CollateralAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  format     RenderFormat        // PDF_PRINT | PDF_DIGITAL | DOCX | PNG
  variant    String?             // e.g. "A4", "US_LETTER", "front", "back", "dtg", "screenprint"
  fileUrl    String              // stored via existing file/storage service
  bytes      Int
  checksum   String
  brandKitVersion Int
  creditsCost Int                // metering (D3) — recorded even if internal
  createdAt  DateTime @default(now())
  @@index([assetId, format])
}
```
Enums: `CollateralType`, `CollateralStatus`, `RenderFormat`. Migration must pass the Phase-0 gate style:
`prisma validate` exit 0; migration UP → DOWN → UP clean with row counts posted.

---

## 6. Rendering pipeline

1. **Resolve** — load `CollateralAsset.spec` + pinned `BrandKit` snapshot → a fully-resolved render model
   (all colours/fonts/text concrete; no live token lookups at render time).
2. **Layout** — deterministic HTML/CSS template per artifact type using CSS **physical units (mm)** and
   `@page { size: <trim+bleed>; margin: 0 }`; bleed + crop marks injected for `PDF_PRINT`.
3. **Rasterize/compose:**
   - **PDF** — headless Chromium (the stack already runs Chromium for browser gates) `printToPDF` with
     `preferCSSPageSize`, `printBackground`, exact page box; OR `pdf-lib` for artifacts needing precise
     vector placement (ID card / t-shirt art). Choose per artifact in implementation; SPEC requires
     vector text/logo preserved and 300 DPI raster floor.
   - **PNG** (t-shirt) — Chromium screenshot of the isolated art at deviceScaleFactor computed for 300 DPI
     at the chosen print area; transparent background.
   - **DOCX** (letterhead) — `docx` npm library: header (logo band) + footer locked as section
     header/footer, body as an editable paragraph region seeded with tone-appropriate default copy.
4. **Preflight** (see §8) — geometry, contrast at small sizes, logo min-width, spot-colour count, missing
   fields. Fail = named error, no file emitted.
5. **Persist** — write file via existing storage service; create `CollateralRender`; record credits.

Rendering is **pure/deterministic** given (spec, brandKitVersion): same inputs → byte-stable PDF (fixed
fonts, no timestamps in the PDF trailer) so renders are cacheable and diffable in tests.

---

## 7. API surface (`/api/collateral`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/assets?projectId=` | list assets for a project |
| POST | `/assets` | create asset (type + name); seeds default spec from brand-kit |
| GET | `/assets/:id` | fetch asset + spec + renders |
| PATCH | `/assets/:id` | edit spec (zone content, geometry options) |
| POST | `/assets/:id/preflight` | run checks; returns pass/fail + named issues |
| POST | `/assets/:id/render` | body `{ format, variant }` → runs pipeline, returns render |
| GET | `/renders/:id/download` | stream file |
| DELETE | `/assets/:id` | archive |

- All routes behind `moduleGate('collateral')` + project scope + RBAC (§9).
- `render` is the metered call (D3): it MUST pass through the `credits` preflight gate (KDL-450) before
  doing paid work; on insufficient credits → 402-style named error, no render.
- Orchestrator (`template-engine`, KDL-453) drives `preflight` + `render` headlessly through these same
  public routes — no private back door.

---

## 8. Preflight & named errors

Every failure returns a stable machine code + human message (mirrors Phase-0 "named error" convention):
- `BRANDKIT_MISSING_FIELD` — required brand-kit field absent.
- `LOGO_BELOW_MIN_WIDTH` — logo would print below `minWidthMm`.
- `CONTRAST_FAIL_SMALL_PRINT` — text/bg below WCAG at the artifact's smallest type size.
- `SPOTCOLOR_LIMIT_EXCEEDED` — screen-print art exceeds max spot colours.
- `GEOMETRY_OUT_OF_BOUNDS` — content crosses safe zone / into bleed unintentionally.
- `FONT_NOT_ALLOWLISTED` — font URL not in theme-engine allowlist.
- `CREDITS_INSUFFICIENT` — metering gate (D3).

---

## 9. Permissions / RBAC

New permission namespace `collateral` with `collateral:view`, `collateral:edit`, `collateral:render`,
`collateral:delete`, following the existing module permission pattern (KDL-192/197). Project scoping via
`projects` (KDL-449). `collateral-ui` nav entry gated on `collateral:view`.

---

## 10. Frontend (Studio) surface

`/admin/collateral`: artifact-type gallery → editor with a true-proportion live preview (reusing the
resolved render model, not a second renderer), zone content forms pre-filled from brand-kit, geometry
option toggles, per-format export buttons, and a render history list. Read-only badge if the owning
project/brand-kit is locked (reuse Phase-0 `locked_by` read-only surface). No brand-token editing here —
that stays in brand-kit; collateral only arranges brand output into geometry.

---

## 11. Security

- No new font/asset loader — reuse theme-engine allowlist + existing storage/file service ACLs.
- User-supplied text (contact fields, letter body, ID holder data) is rendered into HTML for PDF: reuse
  the existing CSS-injection/HTML sanitisation hardening (KDL-274 / M12) — treat all zone content as
  untrusted; escape in templates; no raw HTML injection into print templates.
- Uploaded photos (ID card) validated for type/size; stripped of EXIF; stored scoped to project.
- Download routes enforce project + permission scope; render files are not public-by-URL.

---

## 12. Dependencies, sequencing & disposition

**Implementation is BLOCKED** until the upstream chain lands, because collateral cannot render without a
real brand-kit output contract and project scoping:
- **KDL-451 `brand-kit`** — must be SPEC-finalised (the `BrandKit` shape in §3 reconciled) **and** built,
  so there is real output to consume. *Primary blocker.*
- **KDL-449 `projects`** — provides `projectId` scoping used throughout §5/§7/§9.
- **KDL-450 `credits`** — provides the metering preflight gate the `render` route calls (D3).

This SPEC is the deliverable for KDL-452's "SPEC first" phase. Recommend the board proceed down the chain
(projects → credits → brand-kit) before scheduling collateral implementation.

### Open questions (raise, do not guess)
- **OQ-C1 — BrandKit shape ownership.** §3 defines what collateral *needs*; the canonical `BrandKit`
  object is owned by the brand-kit SPEC. These MUST be reconciled during brand-kit's spec so the contract
  isn't defined twice and drift-prone.
- **OQ-C2 — CMYK / print-house target.** Do the F9 SME pilots hand PDFs to a specific print vendor with a
  required ICC profile / spot library? If yes, v1 should target it; if not, RGB+sRGB soft-proof stands.
- **OQ-C3 — Editable-export scope.** Is .docx letterhead the only "keep editing" artifact, or do clients
  also want editable card/ID templates (implies data-merge tooling, larger scope)?

---

## 13. Out of scope (v1) → future additive work
Device-CMYK colour management; print-house fulfilment/ordering; variable-data batch merge (bulk ID cards
from a CSV); additional artifact types (envelope, folder, brochure, banner, signage); brand-token editing
(stays in brand-kit); payment/commerce (credits are internal metering only, D3).

---

## 14. Test & gate plan (for the eventual implementation PR)
- `prisma validate` exit 0; migration UP/DOWN/UP clean with row counts posted.
- Backend vitest: module install/enable respects engine/UI split; `render` blocked without credits;
  preflight named errors fire on each §8 condition; PDF trim size + bleed asserted by parsing output page
  box; deterministic byte-stable render for fixed inputs.
- Geometry unit tests: each artifact's page box == trim + 2×bleed, safe-zone math correct.
- DOCX: header/footer locked, body editable (open + assert structure).
- Frontend RTL: editor renders from resolved model; read-only badge under lock; export buttons gated by
  permission.
- Browser gate (localhost:3101): create a card in Studio mode, export print PDF, assert downloaded PDF
  page dimensions; disable/enable `collateral-ui` proves nav toggles without unmounting `/api/collateral`.
