# TEMPLATE_ENGINE_ARCH — the `template-engine` orchestrator (Studio surface)

**Issue:** KDL-486 (ARCH spec deliverable; parent KDL-453, Template Engine follow-on #5, last in
sequence). **Status:** PROPOSED — for review. §7 freezes against the **merged** STUDIO_IA.md
(KDL-485, PR #168, master merge `144d6c76`) — reconciled against the merged text 2026-08-18.
**Governing decisions:** PRODUCT_MODES_ARCH §2–4 (thin orchestrator, drives-not-owns), D1/D2/D3,
DECISIONS.md PM-001, D3 (RESCINDED — see §0/§8), STUDIO_IA.md §4 (LOCKED nav contract), this doc's own §0.
**Sequencing:** `projects` (KDL-449) → `credits` (KDL-450) → `brand-kit` (KDL-451) → `collateral`
(KDL-452) → **`template-engine` (this, KDL-453)** → Puck component packs.
**Non-negotiable constraint (from the issue and PRODUCT_MODES_ARCH §2):** this module contains **NO
theming engine and NO block renderer**. Every piece of "real work" — token compilation, block
rendering, AI inference, print rendering, credit debits — already lives in another module. This
module is a **DAG runner + gate + preflight + export**, nothing else. If an implementation PR adds
rendering/compilation logic here, that is a design violation, not a style nit.

**Provenance note:** an earlier 331-line draft of this doc was authored against pre-KDL-485 /
pre-CREDITS_ARCH state, lost uncommitted in the CEO workspace during the 2026-08-18 spend-limit
outage, and recovered to branch `wip/kdl-486-template-engine-arch-draft` (commit `0f840b6`). This
revision reconciles that draft; §3 records the two deliberate deviations from it.

---

## 0. Open questions — RESOLVED (record for future agents)

Both OQ-1 and OQ-2 from PRODUCT_MODES_ARCH §8 blocked this doc from being written. Both are now
answered by the board on KDL-453; this section is the durable record so no later agent re-opens them.

- **OQ-1 — source-app IA (answered 2026-08-18T06:40, interaction `4b6ecbd2`, option
  `current-kdl-nav`).** The board chose "this repo's own nav.ts + EXPORT_SUBSECTIONS is canonical" —
  read as: this repo's actual admin nav assembly plays that role. The canonical write-up of that IA
  is **`.agents/arch/STUDIO_IA.md`** (KDL-485, Frontend Architect), which extracts the nav assembly
  (`AdminSidebar.tsx` `GROUPS`/`FLAT_ITEMS`, `useModules.ts` `nonCoreNav`, manifest `nav[]`) and
  freezes what may not change (its §4 L1–L8) versus what is extensible (E1–E5). **This doc consumes
  STUDIO_IA.md; it does not re-derive the IA.** §7 below specs Studio's surface strictly inside that
  freeze table.
- **OQ-2 — `template-engine` slug vs DECISIONS.md D3.** Went through three board answers on KDL-453
  (all verified against the interaction log 2026-08-18): `13e9aa18` (07:54:43Z — keep D3, name the
  surface `studio`), `2ee691cb` (07:56:05Z — lift D3, option `lift-d3`), and the final tie-breaker
  `d326e28f` (07:58:36Z, option `template-engine-lift-d3`), which is authoritative: **D3 is LIFTED.
  The slug is `template-engine`.** The audit-history ambiguity D3 guarded against is explicitly
  accepted by the board; §8 is the data-hygiene plan that makes the lift safe, and DECISIONS.md is
  amended in this same PR (D3 → RESCINDED, PM-001 OQ-2 → resolved).

**Consequence for scaffolding already on disk:** `backend/src/modules/template-engine/` currently holds
the Phase-0 **stub** module (`module.json` describes it as "Phase 0 stub — proves conflictsWith and
locked_by mechanics", `core:false`, one flat nav leaf at `/admin/template-engine`, empty
`seed.js`/`uninstall.js`). That stub already legitimately owns the `template-engine` slug going
forward — the real orchestrator build is a **promotion of this stub**, not a new module claiming a
taken name. Its existing `dependsOn: ["theme-engine","page-builder"]` and
`conflictsWith: ["theme-engine-ui","page-builder-ui"]` are correct and carry forward unchanged; the
real build adds `brand-kit`, `collateral`, and `credits` to `dependsOn` (§2) and fills in real
routes/nav (§6/§7) in place of the stub's placeholders.

---

## 1. Problem & scope

`template-engine` is Layer 2 / Mode A ("Studio") per PRODUCT_MODES_ARCH §3. When installed it owns the
admin nav and drives a project through **brand identity → theme → guidelines → collateral → website →
export** as one guided, gated flow — the "per-project brand identity to collateral to website
generator" from the problem statement (§1 of PRODUCT_MODES_ARCH). It is sequenced **last** in the
module chain because it has nothing to orchestrate until `brand-kit`, `collateral`, `credits`, and
`projects` exist.

**In scope:** a persisted run/stage state machine, gate logic (dependency + lock checks between
stages, enforced server-side), preflight aggregation before terminal actions, calls into other
modules' public HTTP APIs, the Studio surface (within STUDIO_IA.md's freeze), and an export/handoff
step.

**Explicitly out of scope (owned elsewhere, never duplicated here):**
- Token compilation, `SettingValue` storage, CSS injection → `theme-engine` (via
  `POST /api/theme-engine/values`, per PRODUCT_MODES_ARCH §3 "Mode A data flow").
- Block schema, rendering, page persistence → `page-builder` (via its `/api/page-builder/*` routes).
- Palette extraction, AI typography/tone/strategy inference, brand-guidelines PDF → `brand-kit` /
  `ai-services/src/services/brand-inference.js` (BRAND_KIT_AI_ARCH.md; BRAND-KIT SPEC v1 §5 frozen
  interface).
- Print artifact rendering/export → `collateral` (`/api/collateral/*`, COLLATERAL_SPEC.md §7).
- Balance/ledger/spend gating → `credits` (**CREDITS_ARCH.md**, on master). The balance gate lives at
  the `withCreditHold`/`recordUsage` choke point **inside the driven modules** (CREDITS_ARCH §3/§5);
  this module never re-implements or duplicates it — see §5.
- Tenancy/project scoping → `projects` (KDL-449, PROJECTS_ARCH.md §3 `X-Project-Id` choke point).

---

## 2. Module topology

Single module, no engine/UI split (unlike theme-engine and page-builder). Rationale: nothing else
depends on `template-engine`'s API headlessly — it is a leaf consumer, not infrastructure other modules
mount behind. A single manifest is correct.

| module.json field | value |
|---|---|
| `slug` | `template-engine` |
| `core` | `false` — it is the Mode A/B switch itself; must be toggleable |
| `apiPrefix` | `/api/template-engine` |
| `dependsOn` | `["theme-engine", "page-builder", "brand-kit", "collateral", "credits"]` |
| `conflictsWith` | `["theme-engine-ui", "page-builder-ui"]` (unchanged from the Phase-0 stub; = STUDIO_IA L5) |
| `permissions` | `["template-engine"]` → `template-engine:view`, `:run`, `:approve`, `:export` |
| `nav` | exactly one flat leaf at `/admin/template-engine` — §7 |

`conflictsWith` stays exactly the two `-ui` slugs, **not** `theme-engine` / `page-builder` themselves —
those engines stay mounted (§1 "Mode A data flow"); only their standalone admin surfaces are hidden while
Studio is active. This is the mechanism Phase 0 built (2a/2b) and this module is its first real
consumer. Growing the suppression set is a board decision (STUDIO_IA L5).

**Toolkit mode (template-engine disabled):** the DAG has no meaning; existing runs are retained
(non-destructive uninstall — no data deleted, per PRODUCT_MODES_ARCH §3 mode-switch semantics) but the
Studio nav and all `/api/template-engine/*` routes 404 via `moduleGate('template-engine')` until
re-enabled. Re-enabling **resumes** the run state machine from wherever it was left, adopting whatever
theme-engine/page-builder/collateral values exist now (possibly hand-edited during the Toolkit interval)
as the new baseline rather than treating them as stale — consistent with "Toolkit → Studio adopts
existing values" in PRODUCT_MODES_ARCH §3.

---

## 3. The 9-stage DAG (canonical — closes STUDIO_IA gap G1)

No repo document enumerated the 9 stages before this one; the count appears once, unnamed
(`PRODUCT_MODES_ARCH.md:158`). STUDIO_IA §5 proposed a list and deliberately marked it PROPOSED,
naming this doc the owner (its G1). **The list below is the canonical DAG.** It matches STUDIO_IA §5's
proposed list stage-for-stage and slug-for-slug, so PR #168's table needs no change — the two docs
derived the same 9 stages independently of the recovered draft, which differed in two places (see
"Changes from the recovered draft" below).

Each stage is a **thin driver call** into another module's already-public API plus a persisted
stage-state row (§4) and a gate check (§5). No stage contains business logic beyond request
construction, response mapping into stage output, and the gate/preflight checks below.

| # | Stage | Slug | Drives (API — anchor) | Depends on | Gate before entry | Parallel with |
|---|---|---|---|---|---|---|
| 1 | Intake | `intake` | `brand-kit` intake (company name, industry, tagline, logo upload) — BRAND-KIT SPEC v1 §5 `projectId`-keyed paths (frozen; multi-kit is additive per OQ-E, so no hedging) | — (entry point) | project exists & user has `template-engine:run` | — |
| 2 | Palette extraction | `palette` | `brand-kit` deterministic extraction (canvas/sharp, OKLCH ramps, contrast — BRAND_KIT_AI_ARCH §7) | `intake` done | logo asset present | — |
| 3 | Brand inference | `inference` | `brand-kit` → `ai-services` `inferTypography`/`inferTone`/`generateBrandStrategy` (BRAND_KIT_AI_ARCH §1–2) | `palette` done | none in this module — this is the **paid** stage; the credits hold happens inside brand-kit's `recordUsage` choke point (§5) and a 402 surfaces here as `INSUFFICIENT_CREDITS` | — |
| 4 | Brand approval | `approval` | human sign-off, then **exit action**: `GET /api/brand-kit/:projectId/tokens` (frozen shape, D-BK-6) → `POST /api/theme-engine/values` (`theme-engine/routes.js:23` → `upsertValues`, `theme-engine/service.js:247` — idempotent upsert) | `inference` done | `template-engine:approve` (distinct from `:run` — the one human-judgment gate) | — |
| 5 | Brand guidelines | `guidelines` | `brand-kit` brand-guidelines PDF render (PRODUCT_MODES_ARCH §7.3, `:153-155`) | `approval` done | none | 6, 7 |
| 6 | Collateral | `collateral` | `collateral` `POST /assets` + `/assets/:id/preflight` + `/assets/:id/render` per artifact (COLLATERAL_SPEC.md §7) | `approval` done | per-render credits hold inside collateral (§5); artifact set non-empty | 5, 7 |
| 7 | Website assembly | `website` | `page-builder` `POST /api/page-builder/` + `PUT /:id` (`page-builder/routes.js:14-15`) — seeds pages from the approved Puck component packs (`packs/general`/`medical`/`construction`, PRODUCT_MODES_ARCH §7 item 6) filtered by industry, brand kit as slot defaults | `approval` done | pack for the project's industry installed | 5, 6 |
| 8 | Preflight | `preflight` | *no downstream call* — aggregates named-error preflight results already surfaced by stages 5–7 into one pass/fail report | 5, 6, 7 all terminal (done or explicitly skipped) | none — this stage IS the aggregation | — |
| 9 | Export | `export` | produces the handoff manifest + collateral/guidelines zip (§6) | `preflight` passed | `template-engine:export` | — |

**DAG shape, not a strict pipeline:** stages 5, 6, 7 fan out from `approval` and fan back into
`preflight` — this is why the issue calls it a DAG and not a sequence. A stage's failure does not fail
its siblings; `preflight` (8) reports per-branch status so a user can re-run only the failed branch
(e.g. re-render collateral without touching the written theme tokens).

**Why 4 (`approval`) exists as its own stage:** D2's real-AI inference (stage 3) means every run has a
genuine judgment call — a bad typography pairing or off-brand tone must not silently become the live
theme and get baked into rendered collateral. This is the one human-in-the-loop point in the DAG;
it is intentionally synchronous with the user, unlike the mechanical stages around it.

### 3.1 Changes from the recovered draft (deliberate, with reasons)

1. **`theme_apply` dissolved into `approval`'s exit action.** The draft gave the theme-token write its
   own stage. That write is a single idempotent POST (`upsertValues` does a prisma `upsert` per field,
   `theme-engine/service.js:304`) of a payload whose shape is frozen end-to-end
   (`GET /api/brand-kit/:projectId/tokens` returns exactly what `POST /api/theme-engine/values`
   accepts — BRAND-KIT SPEC v1 §5 + CEO ruling on KDL-451). It has no user surface, no independent
   gate (its only precondition is the approval itself), and its failure recovery is "retry the POST".
   A DAG stage with no screen, no gate, and no distinct side-effect domain is stage inflation; §4.1
   specifies the merged stage's two-step persisted sub-state so crash recovery loses nothing.
   **The orchestrator remains the single writer of theme values in Mode A (D-BK-6)** — dissolving the
   stage does not move the write anywhere else.
2. **`guidelines` added.** The brand-guidelines PDF is a first-class product deliverable
   (PRODUCT_MODES_ARCH §7.3 lists it inside brand-kit's scope, `:153-155`) that had no stage home in
   the draft — it is not a collateral artifact (COLLATERAL_SPEC's artifact set is visiting card,
   letterhead, t-shirt, ID card) and not part of inference. It fills the slot `theme_apply` vacated,
   keeping the count at an honestly-derived 9. **No padding was needed; had the derivation produced
   8 or 10, this doc would have escalated to the board rather than force the count** (per KDL-486
   instruction and STUDIO_IA G1).

Stage renames (`extract`→`palette`, `infer`→`inference`, `page_assemble`→`website`,
`collateral_render`→`collateral`) align slugs with STUDIO_IA §5's screen slugs; they are the same
stages.

---

## 4. Data model (Prisma) — additive migration

The orchestrator's only persisted state is run/stage tracking; it owns no brand, theme, page, or
collateral data (those tables belong to their respective modules).

```prisma
model TemplateEngineRun {
  id          String   @id @default(cuid())
  projectId   String                          // from `projects` (KDL-449)
  status      RunStatus @default(IN_PROGRESS)  // IN_PROGRESS | AWAITING_APPROVAL | COMPLETED | FAILED
  brandKitVersion Int?                         // set once `approval` accepts a kit (§3 stage 4)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  stages      TemplateEngineStage[]
  @@index([projectId])
}

model TemplateEngineStage {
  id          String   @id @default(cuid())
  runId       String
  run         TemplateEngineRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  stage       DagStage                         // INTAKE | PALETTE | INFERENCE | APPROVAL | GUIDELINES |
                                                // COLLATERAL | WEBSITE | PREFLIGHT | EXPORT
  status      StageStatus @default(PENDING)     // PENDING | RUNNING | AWAITING_INPUT | DONE | FAILED | SKIPPED
  errorCode   String?                           // named error from the driven module (§5), never a stack trace
  outputRef   Json?                             // pointers into the driven module (e.g. { brandKitVersion },
                                                 // { renderIds: [...] }) — never a copy of that module's data
  startedAt   DateTime?
  completedAt DateTime?
  @@unique([runId, stage])
  @@index([runId])
}
```

`outputRef` is deliberately a set of **pointers**, not payload copies — re-stating PRODUCT_MODES_ARCH's
"nothing above the engines may keep a parallel copy" for this module's own persistence, not just for
theme-engine/page-builder.

### 4.1 Idempotency & crash recovery, per stage

The rule for every stage with side effects: **record intent in `outputRef` before the driven call,
record the result pointer after it, and make re-runs consult the pointer before re-issuing the call.**
A stage found `RUNNING` at resume (crash mid-run) transitions to `FAILED` with `errorCode:
'INTERRUPTED'` and is re-runnable; re-running must not duplicate side effects:

- **intake / palette** — brand-kit owns write idempotency (versioned kit writes); re-runs reference
  the same `projectId` and land on the same kit version. No orchestrator-side dedup needed.
- **inference** — the paid call. brand-kit's `recordUsage` seam wraps the inference in
  `withCreditHold({ …, idempotencyKey })` (CREDITS_ARCH §5, `:314/:329`); the orchestrator passes a
  deterministic idempotency key `templateEngine:{runId}:inference:{attempt}` down through brand-kit's
  API so a crashed-then-retried stage settles the same hold instead of double-charging (CREDITS_ARCH
  §3.3 crash-mid-generation semantics do the rest: expired holds are reaped on touch).
- **approval** — two persisted sub-steps in `outputRef`: `{ approvedAt, brandKitVersion }` written on
  the human accept (no side effect yet), then `{ tokensWrittenAt }` after the
  `GET tokens → POST /api/theme-engine/values` exit action. Crash between the two: stage is not DONE,
  re-run sees `approvedAt` set and `tokensWrittenAt` unset, and re-issues only the write — which is an
  upsert (`theme-engine/service.js:304`), so a half-applied previous attempt converges.
- **guidelines / collateral** — render asset/render IDs are recorded in `outputRef` as they are
  created; re-runs first `GET` the recorded IDs from the owning module and only issue renders for
  artifacts with no live render. Renders themselves are the metered calls; their credit holds live in
  the owning module with the same run-scoped idempotency-key scheme as inference.
- **website** — created `pageIds` are recorded in `outputRef` per pack section as pages are created;
  re-runs skip sections whose recorded page still exists (`GET /api/page-builder/:id`,
  `routes.js:13`) and create only the missing ones.
- **preflight / export** — read-only aggregation; trivially re-runnable, no dedup needed.

Migration gate (Phase-0 style, unchanged): `prisma validate` exit 0; UP → DOWN → UP clean, row counts
posted.

---

## 5. Gating & preflight

Three distinct mechanisms, named explicitly so implementation doesn't conflate them:

**Gate (before a stage starts) — enforced server-side.** A stage may not transition
`PENDING → RUNNING` unless its `Depends on` column (§3) is satisfied. The check lives in the
orchestrator's service layer on the stage-advance endpoint (`POST
/api/template-engine/runs/:id/stages/:stage/advance`); a failed gate returns **409 with a named error**
(`STAGE_GATE_FAILED`, plus the blocking reason), following KDL-446's `locked_by` 409 precedent. The
frontend stepper (§7) only *projects* this state — disabled steps with the blocking reason — and
enforces nothing (STUDIO_IA §5 S3).

**Credits (the paid-stage gate) — owned by `credits`, executed inside the driven modules, never
here.** CREDITS_ARCH exposes **no** HTTP preflight endpoint — its HTTP surface is read/admin only
(`GET /api/credits/projects/:projectId/balance|ledger|reconciliation`, CREDITS_ARCH §7 `:411-416`).
The gate is the hold lifecycle at the service-layer choke point (CREDITS_ARCH §3:
`reserveCredits` throws `INSUFFICIENT_CREDITS` → HTTP 402), and it executes inside the modules that
spend: brand-kit's `recordUsage`/inference seam calls `withCreditHold` (CREDITS_ARCH §5, reconciled
with BRAND-KIT SPEC v1.1 §7), and collateral's render call does the same. **The orchestrator calls no
credits mutation API and performs no balance check of its own** — a duplicate check here would be a
TOCTOU race against the real gate and a second implementation of a single-owner rule. What the
orchestrator does instead:

- propagate the 402's named error (`INSUFFICIENT_CREDITS`) from the driven module into
  `TemplateEngineStage.errorCode`, where the stepper and stage 8 report it;
- pass the run-scoped idempotency key down (§4.1) so retries settle rather than re-reserve;
- optionally display the advisory balance in the Studio surface via
  `GET /api/credits/projects/:projectId/balance` (permission `credits:view`) — **display only, never
  authorization**.

The recovered draft proposed a `POST /api/credits/preflight` endpoint; that predated CREDITS_ARCH.md
and is **withdrawn** — no such route exists or is needed.

**Preflight (before the terminal action):** stage 8 aggregates each branch's own preflight result — it
does not invent new checks. `guidelines`/`collateral` surface the named errors in COLLATERAL_SPEC.md §8
verbatim (`BRANDKIT_MISSING_FIELD`, `LOGO_BELOW_MIN_WIDTH`, `CONTRAST_FAIL_SMALL_PRINT`,
`SPOTCOLOR_LIMIT_EXCEEDED`, `GEOMETRY_OUT_OF_BOUNDS`, `FONT_NOT_ALLOWLISTED`, `CREDITS_INSUFFICIENT`)
and brand-kit's equivalents; `website` surfaces page-builder's own block-schema validation. Stage 9
(`export`) refuses to run unless stage 8 is `DONE` with all branches passing or explicitly `SKIPPED`
by the user.

---

## 6. Export (stage 9) — what actually gets produced

Because theme and pages already live permanently in their engines (Mode A data flow — nothing to
"migrate" there), export produces a **handoff manifest**, not a copy of the site:

```ts
interface TemplateEngineExportManifest {
  runId: string;
  projectId: string;
  brandKitVersion: number;
  site: { themeEndpoint: string; pageIds: string[] };            // pointers, not payload
  guidelines: { renderId: string; downloadUrl: string };         // stage 5 output
  collateral: { renderIds: string[]; downloadUrls: string[] };   // from COLLATERAL_SPEC §7 /renders/:id/download
  exportedAt: string;
  exportedBy: string;
}
```

`GET /api/template-engine/runs/:id/export` returns this manifest and a zip of the guidelines +
collateral render files (theme/pages stay live URLs — a client-ready site is already being served by
the running app, not something you "download"). This keeps export honest to the thin-orchestrator
constraint: it is a read/aggregate operation, never a second copy of theming or block-rendering logic.

---

## 7. Frontend — the Studio surface (frozen against STUDIO_IA.md)

STUDIO_IA.md (KDL-485) is the canonical OQ-1 output; this section is written strictly inside its §4
freeze table and §5 surface contract, and supersedes the recovered draft's §7 (which predated
STUDIO_IA and proposed a sidebar group with per-stage children — that shape violates L3/L6 and is
withdrawn).

- **One sidebar entry (L6, S1).** Studio's entire sidebar presence is the module's single flat
  manifest leaf at `/admin/template-engine` (the stub's existing `nav[]` entry, label updated to
  "Studio", icon `Sparkles`). Manifest nav is flat-leaf-only (L3/G2) — **stages never appear in the
  sidebar**, and no manifest-schema extension is proposed. The leaf stays active across all stage
  routes via the existing `startsWith` descendant rule.
- **Deep-linkable stage routes (S2).** `/admin/template-engine/projects/{projectId}/{stage-slug}`,
  with `{stage-slug}` = §3's slug column (`intake`, `palette`, `inference`, `approval`, `guidelines`,
  `collateral`, `website`, `preflight`, `export`). Everything under `/admin/template-engine/*` is
  Studio-internal IA and owned by this doc (E5) — **within the frozen §5 surface contract**: S1–S4
  and the `/{stage-slug}` route tail are not E5-extensible (merged E5 wording), and §3/§7 here stay
  inside them.
- **In-surface stepper (S3, S4).** The stage navigation is an ordered 9-step stepper rendered inside
  the surface. Step display state maps from `TemplateEngineStage.status` + the server gate:
  `locked` (gate fails — shown disabled **with the blocking reason from the 409 payload**),
  `available` (PENDING, gate passes), `in_progress` (RUNNING), `needs_attention` (AWAITING_INPUT or
  FAILED, showing `errorCode`), `done` (DONE/SKIPPED). Gating is projected, never enforced,
  client-side; progress lives in the surface, not the sidebar.
- **Engine UIs.** `theme-engine-ui` / `page-builder-ui` are suppressed by `conflictsWith` (L5, §2).
  Studio's `approval`/`website` screens are thin wrappers that call the same engine APIs the backend
  stages call — they give visibility into stage output without reintroducing a second editor. The
  engine's own UI, if reached directly (stale bookmark), shows the read-only "managed by Template
  Engine" badge per PRODUCT_MODES_ARCH §3 — that badge lives on the engine's UI, not here.

STUDIO_IA §5's stage table conforms to §3 above (its own terms: "If KDL-486 lands different stage
names or boundaries, only this table's rows change" — none need to).

---

## 8. Data hygiene for the lifted slug (D3 → RESCINDED)

D3 reserved the `template-engine` slug because the string survives in real data from the module's
pre-rename life (Module 15 → `theme-engine`, KDL-437/438). The board lifted D3 accepting that
ambiguity (§0); this section makes the lift safe, as the KDL-486 issue requires.

### 8.1 Enumeration — every place the old slug can appear

**Live database rows (the actual risk surface):**

| Table.column | Old-slug rows today? | Why / disposition |
|---|---|---|
| `activity_logs.module` (String, indexed — `user-management.prisma` `@@index([module])`) | **YES — the one ambiguous carrier.** | The rename migration deliberately left history untouched ("must not be silently rewritten", `20260817000000_rename_template_engine_to_theme_engine/migration.sql` header). Rows with `module = 'template-engine'` written **before** the rename are events of the module now called theme-engine. |
| `activity_logs.properties` (Json) / `.description` (String) | Possible — free-form payloads may embed the slug | Same disposition as `.module`; never queried by equality on the slug, so covered by the same guard below when used in filters. |
| `modules.slug` | No | B1 of the rename migration rewrote the old row to `theme-engine`; the only `template-engine` row today is the Phase-0 stub, which **is** this module's lineage (§0). |
| `permission_modules.name/label` + `permissions` (via `module_id` FK) | No | B2 rewrote the row; permission identity is `(module_id, action)`, not the concatenated string. The orchestrator's future `template-engine:*` permissions hang off the stub's own new `permission_modules` row — no collision. |
| `types.owner_module`, `categories.owner_module`, `setting_fields.owner_module` | No | B3 rewrote all rows (86/902/3910). |
| `app_settings.key` (`template_engine.*`) | No | B4 rewrote both key families to `theme_engine.*`. |
| `_prisma_migrations.migration_name` | Yes (two rows) | Bookkeeping strings inside migration names (`…backfill_owner_module_template_engine`, `…rename_template_engine_to_theme_engine`); never matched by module-slug queries. No action. |

**Immutable repo/history carriers (no action, listed for completeness):** the two migration SQL files
themselves; git history; DECISIONS.md's D3 text (now amended, not deleted); the theme-engine
`locked-by.test.js` fixture references; frontend `/admin/template-engine` stub page.

### 8.2 Disambiguation strategy: documented cutover instant + query-level guard

Of the three options the issue names, this doc picks the **cutover timestamp**:

- **Rejected — discriminator column** on `activity_logs`: a schema change to a core shared table for
  a single module's concern, and it still needs a backfill to populate — all of option 2's cost plus
  a migration on the hottest audit table.
- **Rejected — one-time backfill to a retired slug** (e.g. rewrite old rows to
  `template-engine-legacy`): rewrites audit history, directly contradicting the applied rename
  migration's own recorded decision ("activity_log rows … are HISTORY — left untouched … must not be
  silently rewritten"), and silently invalidates any export/report taken from those rows before the
  backfill.
- **Chosen — cutover instant:** zero data mutation; the boundary is already recorded in the database
  itself. The cutover is **the instant the rename migration finished in that environment**:
  `SELECT finished_at FROM _prisma_migrations WHERE migration_name =
  '20260817000000_rename_template_engine_to_theme_engine'`. Any `activity_logs` row with
  `module = 'template-engine'` and `created_at < finished_at` is legacy theme-engine history; every
  such row at-or-after it belongs to the stub/orchestrator lineage (after that instant, nothing else
  has ever held the slug). This is per-environment correct by construction — a database that applied
  the rename late gets its own true boundary, and a fresh database has no legacy rows at all, so the
  guard passes everything, correctly.

**Query-level guard (binding on the implementation PRs):** the orchestrator module exposes exactly one
helper for reading its own activity history — e.g. `templateEngineActivityScope()` in the module
service — which resolves the cutover once at boot (cached; falls back to the migration-name timestamp
`2026-08-17T00:00:00Z` only if the `_prisma_migrations` row is absent) and appends
`created_at >= cutover` to every query it builds that filters `activity_logs` by
`module = 'template-engine'`. Any direct `prisma.activityLog` query in `template-engine` code that
filters on the module slug without going through the helper is a **review-blocking violation** (same
enforcement class as the thin-orchestrator rule). Defense in depth: the orchestrator writes
`subject_type` values from its own namespace (`TemplateEngineRun`, `TemplateEngineStage`), which no
legacy row ever used.

Human readers of raw history need no tooling: rows before the cutover with this slug refer to the
renamed theme-engine (see the amended DECISIONS.md D3 entry, which points here).

---

## 9. Permissions / RBAC

New namespace `template-engine`: `template-engine:view`, `:run` (advance stages 1–3, 5–7), `:approve`
(stage 4 — separate from `:run` because approval is the human-judgment gate, §3), `:export` (stage 9).
Project-scoped via `projects` (KDL-449), same `X-Project-Id` choke point as every other project-scoped
module (PROJECTS_ARCH.md §3).

---

## 10. Security

No new rendering/sanitisation surface is introduced — every stage calls an already-hardened module:
theme-engine's CSS-injection sanitisation (KDL-274/M12) and device `@media` scoping (KDL-209),
page-builder's block schema validation, collateral's HTML-escaping of zone content (COLLATERAL_SPEC §11).
The orchestrator's own attack surface is limited to: (a) stage-transition authorization (can this
user/role advance this run?), (b) not leaking another project's run state across the `X-Project-Id`
boundary (reuse PROJECTS_ARCH §6 leakage test pattern for `TemplateEngineRun`/`TemplateEngineStage`),
and (c) never echoing raw error bodies from a driven module back to the client — only the named error
code (§5), matching the Phase-0 "named error" convention throughout.

---

## 11. Dependencies, sequencing & disposition

**Implementation is BLOCKED** until the upstream chain is real, because there is nothing to orchestrate
otherwise:
- **KDL-449 `projects`** (PROJECTS_ARCH.md specced, KDL-474), **KDL-450 `credits`** (CREDITS_ARCH.md
  specced; build C1–C4 pending), **KDL-451 `brand-kit`** (SPEC v1 frozen; Phase 1 build in flight),
  **KDL-452 `collateral`** (COLLATERAL_SPEC.md) must all be **built** (not just specced) before
  stages 1–6 have real endpoints to call.
- Puck component packs (PRODUCT_MODES_ARCH §7 item 6) must exist for stage 7 to have real packs to
  seed from; a single stub pack is sufficient to unblock a first implementation PR.

This doc is the "ARCH first" deliverable for KDL-453/KDL-486, matching the pattern already used for
`brand-kit` (BRAND_KIT_AI_ARCH.md), `collateral` (COLLATERAL_SPEC.md), and `credits`
(CREDITS_ARCH.md). Recommend the board/CEO check the actual build status of KDL-449/450/451/452 before
scheduling `template-engine` implementation — this doc does not itself confirm they are done, only
that they are prerequisite.

### Open items for the reviewer / board
1. ~~Credits interface (§5) — proposed `POST /api/credits/preflight` shape~~ **RESOLVED:**
   CREDITS_ARCH.md landed on master; §5 is reconciled against it (no HTTP preflight exists — the gate
   is `withCreditHold` inside the driven modules; the orchestrator only propagates the 402 named
   error and passes idempotency keys).
2. **Puck pack selection at stage 7** — "filtered by industry" assumes packs declare an industry/vibe
   tag set analogous to brand-kit's typography whitelist (BRAND_KIT_AI_ARCH §2.1); no such tagging
   scheme is specced yet for `packs/general`/`medical`/`construction`.
3. **Export destination (§6)** — this doc treats "export" as manifest + guidelines/collateral zip
   because the live site has no separate deploy step in this architecture (Mode A theme/pages are
   already live). If the board wants export to mean an actual static-site handoff to a client's own
   hosting, that is a materially different stage 9 and should be flagged before implementation.
4. **Idempotency-key pass-through (§4.1)** — the run-scoped key
   (`templateEngine:{runId}:{stage}:{attempt}`) must be accepted by brand-kit's and collateral's
   metered endpoints and forwarded to `withCreditHold`. brand-kit SPEC v1 froze paths, not this
   header/field; flagging so the brand-kit/collateral build PRs reserve a field for it rather than
   inventing three shapes.
