# PRODUCT_MODES_ARCH — Template Engine, Theme Engine & Page Builder as product modes

**Status:** ADOPTED (board, Cowork session 2026-08-17). Source of truth is KDL-446; this file
commits that decision to git so every later agent boots with it.
**Owner:** Board / CEO. **Phase 0 tracked by:** KDL-446 (KDL-447 backend, KDL-448 frontend).

---

## 1. Problem

The board is adding a **Template Engine** module — a per-project *brand identity → collateral →
website* generator, derived from a 5,561-line prototype. It overlaps two things we already ship:

- **Theme Engine** — the renamed Module 15 token compiler (KDL-437/438): token compilation,
  `SettingValue` store, runtime CSS injection, active-theme selection.
- **Page Builder** — the Puck POC: block schema, renderer, editor, page persistence.

If Template Engine carried its own theming + block rendering, we would end up with **two colour-token
compilers, two type-scale models, two block libraries, and two HTML export paths**. They would diverge
within a release; a security fix (e.g. the CSS-injection sanitisation from KDL-274/M12, the device
`@media` scoping from KDL-209, `[data-theme]` blocks, font-URL allowlisting) would land in one compiler
and not the other; and a client could never change product mode without losing their brand and pages.

The board rule: **a client uses EITHER Template Engine, OR Theme Engine + Page Builder — never both at
once.**

## 2. The decision (taken by the board — implement, do not re-open)

**Exclusivity is a PACKAGING decision enforced at the product-surface layer. It is NOT an
implementation fork.** Template Engine contains **NO theming engine and NO block renderer** — it
**DRIVES the existing ones through their public APIs**. What gets disabled per mode is the **admin UI
surface**, not the engine.

### Rejected alternative
Three peer modules where you pick one set. **Rejected** because it produces two token compilers, two
type-scale models, two block libraries and two HTML export paths that diverge; security fixes land in
one and not the other; mode changes become destructive migrations; and all the Theme Engine hardening
we already paid for (KDL-209 device `@media` scoping, KDL-274/M12 CSS-injection sanitisation,
`[data-theme]` blocks, font-URL allowlisting) would have to be reimplemented and re-audited.

## 3. The two layers

### Layer 1 — ENGINES (always installed, no product nav of their own)
- **theme-engine** — token compilation, `SettingValue` store, runtime CSS injection, active theme.
- **page-builder** — block schema, renderer, editor, page persistence.

These are the **single source of truth** for "what colour is primary" and "what blocks are on this
page". **Nothing above them may keep a parallel copy.**

### Layer 2 — PRODUCT SURFACES (mutually exclusive)
- **Mode A "Studio"** — `template-engine` installed. It owns the nav. Theme Engine UI goes **read-only,
  badged "managed by Template Engine"**.
- **Mode B "Toolkit"** — `template-engine` absent. Theme Engine + Page Builder expose their own admin
  UIs directly.

### Mode table

| | Mode A — Studio | Mode B — Toolkit |
|---|---|---|
| template-engine | installed, owns nav | absent |
| theme-engine (engine) | on | on |
| theme-engine-ui | present but **read-only + badge** | full admin UI |
| page-builder (engine) | on | on |
| page-builder-ui | hidden from nav | full admin UI |
| who edits tokens | Template Engine (via approval flow) | user, directly |

### Mode A data flow
User approves a palette in Template Engine → Template Engine POSTs to `/api/theme-engine/values` for the
target platform → **our existing compiler** produces the CSS → the runtime provider injects it. **One
compiler, one token contract, one security review.**

### Mode-switch semantics (NON-DESTRUCTIVE both ways)
Everything was always stored in Theme Engine and Page Builder tables, so:
- **Studio → Toolkit** just *unhides* the editors.
- **Toolkit → Studio** *adopts* existing values as the project's starting brand.
- **Neither is a migration.** This property exists *only* under the layered design and is the main
  reason for it.

## 4. Phase 0 platform mechanism

Most of the mechanism already exists: modules registry with install/enable/disable/uninstall hooks
(`backend/src/modules/modules/service.js`), `module.json` `dependsOn`, `moduleGate(slug)` route mounting
(`backend/src/middleware/module-gate.js`), nav assembled from manifests, and the `owner_module`
ownership contract (KDL-192/197). Four additions:

### 2a. Manifest conflict declaration
Add `"conflictsWith": []` to the `module.json` schema (`manifestSchema` in
`backend/src/shared/modules/manifest-schema.js`). `template-engine` declares
`conflictsWith: ["theme-engine-ui", "page-builder-ui"]`. `installModule`/`enableModule` **refuse** when
a declared conflict is active, returning a clear error **naming the blocking module**. Enforcement is
**SYMMETRIC** — enabling a conflicted module while `template-engine` is active fails the same way.
Enforce in the **service layer**, not just the UI.

### 2b. Engine / UI manifest split
Each Layer 1 module ships **two manifest entries**:
- the **engine half** — API routes, always on, `core: true`, **no nav**;
- the **"-ui" half** — nav entries + admin screens, toggleable, participates in conflicts.

So `theme-engine` + `theme-engine-ui`, `page-builder` + `page-builder-ui`. This is what keeps the API
mounted in Studio mode while the nav disappears — `template-engine` depends on those APIs. **Do NOT
achieve this by unmounting routes.**

### 2c. `locked_by` read-only surface
A settings screen whose owning module is locked renders **read-only with an explanatory badge naming
the locking module**. Prevents the confusing state where a user edits a token Template Engine will
overwrite on next approval. Enforce read-only on the **SERVER too** (reject writes with **409** and a
message), not only in the UI.

### 2d. Page Builder backend persistence
Promote the Puck page-builder module from `localStorage` to real backend persistence — **pages table,
draft/publish status, RBAC via the existing permission pattern, admin routes**. Required for Mode B
regardless of Template Engine, so it is **not Template Engine cost. Do not defer it.**

## 5. Gates (report exit codes)

- `prisma validate` exit 0; any migration runs **UP → DOWN → UP** cleanly, row counts posted.
- Backend full vitest suite exit 0; ai-services vitest exit 0.
- frontend `pnpm type-check` exit 0, `pnpm build` exit 0, RTL suite exit 0.
- **New tests required:** enabling a module whose conflict is active fails with the named error; the
  reverse direction fails too; disabling `theme-engine-ui` leaves `GET /api/theme-engine/tokens`
  returning 200; a write to a locked settings field returns 409.
- **Browser gate** (localhost:3101, `admin@kdl.com` / `Admin@123`): with a stub `template-engine`
  module enabled, the Theme Engine and Page Builder nav entries disappear, the Theme Engine screen
  renders read-only with the badge, and the admin still themes correctly (engine still running). Disable
  the stub → both nav entries and full editability return with all values intact (non-destructive
  mode-switch proof).
- Puck pages survive a full container restart (proves real persistence, not localStorage).

## 6. Board decisions

- **D1** One product with a mode switch. Not two distributions, not a fork.
- **D2** Real AI for brand inference via the existing `ai-services` workspace. The prototype's
  `inferTypography`/`inferTone` are five regexes on an industry string; replace with genuine inference
  (logo + industry + company name → typography pairing, tone of voice, brand strategy copy) behind a
  stable interface. The rule table survives only as an offline fallback. This is the module's
  differentiator.
- **D3 (credits)** Credits are **internal metering in v1**, designed to become commerce. D2 makes every
  generation carry a real per-call cost, so metering is needed immediately for spend control; full
  billing is a compliance surface that would delay the IP and is purely additive later. No payment
  provider, no invoicing in v1.

## 7. Phase sequencing

**Phase 0 (this task, KDL-446):** platform layer — 2a conflictsWith, 2b engine/UI split, 2c locked_by
read-only, 2d Page Builder backend persistence. Ships as a PR against green master.

**Follow-on tasks (created as separate BLOCKED tasks — Template Engine is a product, not a module;
shipping it as one deliverable is unreviewable):**
1. **projects** — multi-project workspaces. KDL is effectively single-tenant today; this changes every
   layer above it, so it comes first.
2. **credits** — per-project balance, append-only ledger, preflight gate. Internal metering only in v1
   (D3). Designed so commerce is additive later.
3. **brand-kit** — logo intake, palette extraction (canvas dominant-colour, 10-step variant ramps,
   contrast), AI typography/tone inference, brand-guidelines PDF. **This is the real IP** and deserves
   the most spec effort.
4. **collateral** — visiting card, letterhead, t-shirt, ID card with real print geometry and PDF + Word
   export.
5. **template-engine** — thin orchestrator only: 9-stage DAG, gating, preflight, export. Drives
   everything else.
6. **Puck component packs** — the prototype's section libraries (16 general types / 68 variants;
   17 medical / 33; 21 construction / 36; 10 inline blocks) ship as `packs/general`, `packs/medical`,
   `packs/construction`. **Never a second editor.**

## 8. Open questions (raise with board — do NOT guess)

- **OQ-1 — Source-app IA.** The prototype references an app that already exists ("src/lib/nav.ts", "the
  real app's locked `EXPORT_SUBSECTIONS`", "the real product marks these subsections `enabled:false`",
  "Prototype v20 § Overview"). That source app's information architecture **must be obtained from the
  board BEFORE `template-engine`'s own ARCH doc is written**, or we will re-derive and contradict
  decisions that already exist. Flag to the board; do not invent an IA. *(Blocks the follow-on
  template-engine ARCH, not Phase 0.)*
- **OQ-2 — `template-engine` slug vs DECISIONS.md D3.** DECISIONS.md **D3 (2026-08-17)** permanently
  **RESERVED** the slug `template-engine` (the old Module-15 name; migration + `activity_log` rows carry
  it) and says a future template module MUST use a different slug (e.g. `content-templates`,
  `page-templates`). The board now wants the Studio product surface named `template-engine`. These
  conflict. **Board must resolve** before the real `template-engine` module is built: either (a) lift D3
  and accept the audit-history ambiguity, or (b) name the product surface a different slug (recommend
  **`studio`**, matching the mode name). *(Phase 0 is unaffected: its browser gate uses a throwaway stub
  module whose slug does NOT need to be `template-engine` — the stub only proves conflictsWith /
  engine-UI split / locked_by behaviour.)*
