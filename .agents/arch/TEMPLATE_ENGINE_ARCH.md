# TEMPLATE_ENGINE_ARCH — the `template-engine` orchestrator (Studio surface)

**Issue:** KDL-453 (Template Engine follow-on #5, last in sequence). **Status:** PROPOSED — for review.
**Governing decisions:** PRODUCT_MODES_ARCH §2–4 (thin orchestrator, drives-not-owns), D1/D2/D3,
DECISIONS.md PM-001, D3 (slug), this doc's own §0.
**Sequencing:** `projects` (KDL-449) → `credits` (KDL-450) → `brand-kit` (KDL-451) → `collateral`
(KDL-452) → **`template-engine` (this, KDL-453)** → Puck component packs.
**Non-negotiable constraint (from the issue and PRODUCT_MODES_ARCH §2):** this module contains **NO
theming engine and NO block renderer**. Every piece of "real work" — token compilation, block
rendering, AI inference, print rendering, credit debits — already lives in another module. This
module is a **DAG runner + gate + preflight + export**, nothing else. If an implementation PR adds
rendering/compilation logic here, that is a design violation, not a style nit.

---

## 0. Open questions — RESOLVED (record for future agents)

Both OQ-1 and OQ-2 from PRODUCT_MODES_ARCH §8 blocked this doc from being written. Both are now
answered by the board on KDL-453; this section is the durable record so no later agent re-opens them.

- **OQ-1 — source-app IA (answered 2026-08-18T06:40, interaction `4b6ecbd2`, option
  `current-kdl-nav`).** The board chose "this repo's own nav.ts + EXPORT_SUBSECTIONS is canonical."
  Neither literally exists in this repo — `src/lib/nav.ts` and `EXPORT_SUBSECTIONS` are terms quoted
  from an unobtained external prototype inside PRODUCT_MODES_ARCH.md's own §8, not repo code (verified
  by grep; logged in DECISIONS.md PM-001 and a KDL-453 comment at 06:43). The board explicitly did
  **not** pick "external prototype" or "design fresh," so intent is read as: **this repo's actual
  current admin nav assembly plays that role** —
  `frontend/src/components/layout/AdminSidebar.tsx` (`GROUPS` / `FLAT_ITEMS`, the grouped-subsection
  pattern) and `frontend/src/hooks/useModules.ts` (merges each enabled non-core module's `module.json`
  `nav[]` into the sidebar). §7 below specs the Studio nav directly against that pattern, including the
  `enabled:false`-style per-subsection gating the (unseen) prototype described, reimplemented as
  DAG-stage-state-driven nav item disabling — not invented from nothing, but not copied from a file that
  doesn't exist in this repo either.
- **OQ-2 — `template-engine` slug vs DECISIONS.md D3.** Went through two conflicting board answers
  82 seconds apart (`13e9aa18` → keep D3, name the surface `studio`; `2ee691cb` → lift D3, reuse
  `template-engine`) before a final tie-breaker interaction (`d326e28f`, resolved 2026-08-18T07:58:36Z,
  option `template-engine-lift-d3`) settled it: **D3 is LIFTED. The slug is `template-engine`.**
  DECISIONS.md is updated alongside this doc to record the lift and the accepted audit-history
  ambiguity (old Module-15/theme-engine migration + `activity_log` rows carry the same string; no
  retroactive disambiguation is attempted — see §8).

**Consequence for scaffolding already on disk:** `backend/src/modules/template-engine/` currently holds
the Phase-0 **stub** module (`module.json` describes it as "Phase 0 stub — proves conflictsWith and
locked_by mechanics", `core:false`, one placeholder nav entry, empty `seed.js`/`uninstall.js`). That stub
already legitimately owns the `template-engine` slug going forward — the real orchestrator build is a
**promotion of this stub**, not a new module claiming a taken name. Its existing
`dependsOn: ["theme-engine","page-builder"]` and `conflictsWith: ["theme-engine-ui","page-builder-ui"]`
are correct and carry forward unchanged; the real build adds `brand-kit`, `collateral`, and `credits` to
`dependsOn` (§2) and fills in real routes/nav (§6/§7) in place of the stub's placeholders.

---

## 1. Problem & scope

`template-engine` is Layer 2 / Mode A ("Studio") per PRODUCT_MODES_ARCH §3. When installed it owns the
admin nav and drives a project through **brand identity → theme → pages → collateral → export** as one
guided, gated flow — the "per-project brand identity to collateral to website generator" from the
problem statement (§1 of PRODUCT_MODES_ARCH). It is sequenced **last** in the module chain because it has
nothing to orchestrate until `brand-kit`, `collateral`, `credits`, and `projects` exist.

**In scope:** a persisted run/stage state machine, gate logic (dependency + credits + lock checks
between stages), preflight aggregation before terminal actions, calls into other modules' public HTTP
APIs, the Studio nav, and an export/handoff step.

**Explicitly out of scope (owned elsewhere, never duplicated here):**
- Token compilation, `SettingValue` storage, CSS injection → `theme-engine` (via
  `POST /api/theme-engine/values`, per PRODUCT_MODES_ARCH §3 "Mode A data flow").
- Block schema, rendering, page persistence → `page-builder` (via its `/api/page-builder/*` routes).
- Palette extraction, AI typography/tone/strategy inference → `brand-kit` /
  `ai-services/src/services/brand-inference.js` (BRAND_KIT_AI_ARCH.md).
- Print artifact rendering/export → `collateral` (`/api/collateral/*`, COLLATERAL_SPEC.md §7).
- Balance/ledger/spend gating → `credits` (KDL-450 — preflight interface only, §5 below; no ARCH doc
  exists yet, so this doc treats it as a named dependency contract, same pattern collateral used).
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
| `conflictsWith` | `["theme-engine-ui", "page-builder-ui"]` (unchanged from the Phase-0 stub) |
| `permissions` | `["template-engine"]` → `template-engine:view`, `:run`, `:approve`, `:export` |
| `nav` | Studio nav group, §7 |

`conflictsWith` stays exactly the two `-ui` slugs, **not** `theme-engine` / `page-builder` themselves —
those engines stay mounted (§1 "Mode A data flow"); only their standalone admin surfaces are hidden while
Studio is active. This is the mechanism Phase 0 built (2a/2b) and this module is its first real
consumer.

**Toolkit mode (template-engine disabled):** the DAG has no meaning; existing runs are retained
(non-destructive uninstall — no data deleted, per PRODUCT_MODES_ARCH §3 mode-switch semantics) but the
Studio nav and all `/api/template-engine/*` routes 404 via `moduleGate('template-engine')` until
re-enabled. Re-enabling **resumes** the run state machine from wherever it was left, adopting whatever
theme-engine/page-builder/collateral values exist now (possibly hand-edited during the Toolkit interval)
as the new baseline rather than treating them as stale — consistent with "Toolkit → Studio adopts
existing values" in PRODUCT_MODES_ARCH §3.

---

## 3. The 9-stage DAG

Each stage is a **thin driver call** into another module's already-public API plus a persisted
stage-state row (§4) and a gate check (§5). No stage contains business logic beyond request
construction, response mapping into stage output, and the gate/preflight checks below.

| # | Stage | Drives | Depends on | Gate before entry | Parallelizable with |
|---|---|---|---|---|---|
| 1 | `intake` | `brand-kit` intake endpoint (company name, industry, tagline, logo upload) | — (entry point) | project exists & user has `template-engine:run` | — |
| 2 | `extract` | `brand-kit` deterministic palette extraction (canvas/sharp, OKLCH ramps, contrast — BRAND_KIT_AI_ARCH §7) | `intake` complete | logo asset present | — |
| 3 | `infer` | `brand-kit` → `ai-services` `inferTypography`/`inferTone`/`generateBrandStrategy` (BRAND_KIT_AI_ARCH §1–2) | `extract` complete | **credits preflight** (§5) — this is the paid stage | — |
| 4 | `approve` | *no downstream call* — presents the assembled brand kit (palette + typography + tone + strategy) for explicit user sign-off | `infer` complete | none (this stage IS the gate for 5–7) | — |
| 5 | `theme_apply` | `theme-engine` `POST /api/theme-engine/values` (PRODUCT_MODES_ARCH §3 Mode A data flow) | `approve` accepted | `theme-engine-ui` lock state is irrelevant here — Studio always writes through the engine API directly, never through the (hidden) UI | 6, 7 |
| 6 | `page_assemble` | `page-builder` `/api/page-builder/*` — seeds pages from the approved Puck component packs (`packs/general`/`medical`/`construction`, PRODUCT_MODES_ARCH §7 item 6) filtered by industry, using the approved brand kit as slot defaults | `approve` accepted | pack for the project's industry is installed | 5, 7 |
| 7 | `collateral_render` | `collateral` `POST /assets` + `/assets/:id/preflight` + `/assets/:id/render` per artifact (COLLATERAL_SPEC.md §7) | `approve` accepted | **credits preflight** per render (COLLATERAL_SPEC.md §7 "render is the metered call") | 5, 6 |
| 8 | `preflight` | *no downstream call* — aggregates named-error preflight results already surfaced by stages 5–7 (theme contrast, collateral §8 named errors, page-builder validation) into one pass/fail report | 5, 6, 7 all terminal (success or explicit skip) | none — this stage IS the aggregation | — |
| 9 | `export` | produces the handoff artifact: a manifest bundling the live site (theme + pages, already in their engines — nothing to "export" there beyond a pointer/URL) with the collateral render files (§6 below) | `preflight` passed | none beyond preflight | — |

**DAG shape, not a strict pipeline:** stages 5, 6, 7 fan out from `approve` and fan back into
`preflight` — this is why the issue calls it a DAG and not a sequence. A stage's failure does not fail
its siblings; `preflight` (8) reports per-branch status so a user can re-run only the failed branch
(e.g. re-render collateral without re-applying the theme).

**Why 4 (`approve`) exists as its own stage with no API call:** D2's real-AI inference (stage 3) means
every run has a genuine judgment call — a bad typography pairing or off-brand tone must not silently
become the live theme and get baked into rendered collateral. This is the one human-in-the-loop point in
the DAG; it is intentionally synchronous with the user, unlike the mechanical stages around it.

---

## 4. Data model (Prisma) — additive migration

The orchestrator's only persisted state is run/stage tracking; it owns no brand, theme, page, or
collateral data (those tables belong to their respective modules).

```prisma
model TemplateEngineRun {
  id          String   @id @default(cuid())
  projectId   String                          // from `projects` (KDL-449)
  status      RunStatus @default(IN_PROGRESS)  // IN_PROGRESS | AWAITING_APPROVAL | COMPLETED | FAILED
  brandKitVersion Int?                         // set once `infer` produces an approved kit (§3 stage 4)
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
  stage       DagStage                         // INTAKE | EXTRACT | INFER | APPROVE | THEME_APPLY |
                                                // PAGE_ASSEMBLE | COLLATERAL_RENDER | PREFLIGHT | EXPORT
  status      StageStatus @default(PENDING)     // PENDING | RUNNING | AWAITING_INPUT | DONE | FAILED | SKIPPED
  errorCode   String?                           // named error from the driven module (§8), never a stack trace
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

Migration gate (Phase-0 style, unchanged): `prisma validate` exit 0; UP → DOWN → UP clean, row counts
posted.

---

## 5. Gating & preflight

Two distinct mechanisms, both named explicitly so implementation doesn't conflate them:

**Gate (before a stage starts):** a stage may not transition `PENDING → RUNNING` unless its `Depends on`
column (§3) is satisfied. The credits gate is the one gate that calls out to another module rather than
checking local state: stages 3 (`infer`) and 7 (`collateral_render`, per-render) call the `credits`
preflight interface — modeled after the same choke-point pattern BRAND_KIT_AI_ARCH §5 and
COLLATERAL_SPEC §7 already assume for their own callers:

```
POST /api/credits/preflight   body: { projectId, purpose: 'brand.inference' | 'collateral.render', estimatedCost? }
  → 200 { authorized: true }  |  402-style named error CREDITS_INSUFFICIENT (COLLATERAL_SPEC §8 convention)
```

`template-engine` does not implement metering — it is a caller of this interface, same as brand-kit and
collateral are. If `credits` (KDL-450) has not landed yet when this module is implemented, the gate call
is stubbed to always-authorize behind a feature flag and flagged in `BLOCKERS.md`, never silently
skipped.

**Preflight (before a terminal action):** stage 8 aggregates each branch's own preflight result — it
does not invent new checks. `theme_apply` surfaces whatever theme-engine's compiler already validates;
`collateral_render` surfaces the named errors in COLLATERAL_SPEC.md §8 verbatim (`BRANDKIT_MISSING_FIELD`,
`LOGO_BELOW_MIN_WIDTH`, `CONTRAST_FAIL_SMALL_PRINT`, `SPOTCOLOR_LIMIT_EXCEEDED`,
`GEOMETRY_OUT_OF_BOUNDS`, `FONT_NOT_ALLOWLISTED`, `CREDITS_INSUFFICIENT`); `page_assemble` surfaces
page-builder's own block-schema validation. Stage 9 (`export`) simply refuses to run if stage 8 is not
`DONE` with all branches passing or explicitly `SKIPPED` by the user.

---

## 6. Export (stage 9) — what actually gets produced

Because theme and pages already live permanently in their engines (Mode A data flow — nothing to
"migrate" there), export produces a **handoff manifest**, not a copy of the site:

```ts
interface TemplateEngineExportManifest {
  runId: string;
  projectId: string;
  brandKitVersion: number;
  site: { themeEndpoint: string; pageIds: string[] };       // pointers, not payload
  collateral: { renderIds: string[]; downloadUrls: string[] }; // from COLLATERAL_SPEC §7 /renders/:id/download
  exportedAt: string;
  exportedBy: string;
}
```

`GET /api/template-engine/runs/:id/export` returns this manifest and a zip of the collateral render
files (theme/pages stay live URLs — a client-ready site is already being served by the running app, not
something you "download"). This keeps export honest to the thin-orchestrator constraint: it is a
read/aggregate operation, never a second copy of theming or block-rendering logic.

---

## 7. Frontend — Studio nav (resolves OQ-1, §0)

`template-engine` owns the admin nav in Mode A. It is added to `AdminSidebar.tsx`'s `GROUPS` the same
way every other module's nav already merges in via `useModules().nonCoreNav` — no new merge mechanism.
The **group** is "Studio"; its **children are the DAG stages**, each a `NavLeaf` whose `enabled` state
is driven by the current run's stage status (§4), not by permissions alone — this is the concrete
reimplementation of the "subsections marked `enabled:false`" pattern the prototype used, grounded in
this repo's actual nav primitives:

```ts
{
  label: 'Studio',
  icon: 'Sparkles',
  children: [
    { label: 'Brand',      href: '/admin/studio/brand',      permission: 'template-engine:run' },       // stages 1-4
    { label: 'Theme',      href: '/admin/studio/theme',       permission: 'template-engine:run',
      enabled: run?.stages.approve === 'DONE' },                                                          // stage 5
    { label: 'Pages',      href: '/admin/studio/pages',       permission: 'template-engine:run',
      enabled: run?.stages.approve === 'DONE' },                                                          // stage 6
    { label: 'Collateral', href: '/admin/studio/collateral',  permission: 'template-engine:run',
      enabled: run?.stages.approve === 'DONE' },                                                          // stage 7
    { label: 'Export',     href: '/admin/studio/export',      permission: 'template-engine:export',
      enabled: run?.stages.preflight === 'DONE' },                                                        // stage 9
  ],
}
```

`Theme`/`Pages` under Studio are **not** the same screens as `theme-engine-ui`/`page-builder-ui` (those
are hidden by `conflictsWith`, §2) — they are Studio-branded thin wrappers that call the same engine APIs
`template-engine`'s own backend stages call, giving the user visibility into stage 5/6 output without
reintroducing a second editor (consistent with PRODUCT_MODES_ARCH §3 "Theme Engine UI goes read-only
badged 'managed by Template Engine'" — the read-only badge lives on the *engine's own* UI when visited
directly, e.g. via a stale bookmark or API Explorer; Studio's wrapper is the writable path).

---

## 8. Audit-history note on the lifted slug (D3)

Per §0's OQ-2 resolution, `activity_log` rows and the original migration from the old Module-15 /
`theme-engine` rename (KDL-437/438) carry the string `template-engine`, and this module now carries it
too going forward. **No retroactive disambiguation is attempted** — this doc and the DECISIONS.md
update are the disambiguation for humans/agents reading history; no code change rewrites old rows. Any
future audit-log query filtering by `module: 'template-engine'` must be read with this doc's timestamp in
mind (rows before 2026-08-18 predate this module and refer to the renamed theme-engine).

---

## 9. Permissions / RBAC

New namespace `template-engine`: `template-engine:view`, `:run` (advance stages 1-3, 5-7), `:approve`
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
- **KDL-449 `projects`**, **KDL-450 `credits`**, **KDL-451 `brand-kit`**, **KDL-452 `collateral`** must
  all be built (not just specced) before stages 1-3 and 7 have real endpoints to call.
- Puck component packs (PRODUCT_MODES_ARCH §7 item 6) must exist for stage 6 to have real packs to seed
  from; a single stub pack is sufficient to unblock a first implementation PR.

This doc is KDL-453's "ARCH first" deliverable, matching the pattern already used for `brand-kit`
(BRAND_KIT_AI_ARCH.md) and `collateral` (COLLATERAL_SPEC.md). Recommend the board/CEO check the actual
build status of KDL-449/450/451/452 before scheduling `template-engine` implementation — this doc does
not itself confirm they are done, only that they are prerequisite.

### Open items for the reviewer / board
1. **Credits interface (§5)** — this doc assumes a `POST /api/credits/preflight` shape by analogy with
   collateral's description of the same gate; KDL-450 has no ARCH doc yet, so this is a proposal, not a
   confirmed contract. Should be reconciled when `credits` is specced, same caution COLLATERAL_SPEC §12
   OQ-C1 raised for the brand-kit shape.
2. **Puck pack selection at stage 6** — "filtered by industry" assumes packs declare an industry/vibe tag
   set analogous to brand-kit's typography whitelist (BRAND_KIT_AI_ARCH §2.1); no such tagging scheme is
   specced yet for `packs/general`/`medical`/`construction`.
3. **Export destination (§6)** — this doc treats "export" as manifest + collateral zip because the
   live site has no separate deploy step in this architecture (Mode A theme/pages are already live).
   If the board wants export to mean an actual static-site handoff to a client's own hosting, that is a
   materially different stage 9 and should be flagged before implementation.
