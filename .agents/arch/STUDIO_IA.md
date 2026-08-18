# STUDIO_IA — canonical source-app information architecture for the `template-engine` surface

**Issue:** KDL-485 (OQ-1 output, feeds the KDL-486 orchestrator ARCH). **Status:** PROPOSED — for review.
**Governing decisions:** PM-001 (`.agents/DECISIONS.md:106-115`, OQ-1 resolution at `:112`),
D1 (`.agents/PRODUCT_MODES_ARCH.md:131`), §3 Mode table (`:56-77`).
**Verified at:** master `3369250` — every `file:line` citation below was read at that commit, and all of
§1–§3's citations were re-verified unchanged at master `b7200ad` (KDL-491 review, 2026-08-18).

> **What this doc is.** Per PM-001's OQ-1 resolution, the canonical source-app IA for the Studio
> surface is **this repo's actual admin nav assembly** — not the unobtained prototype's `nav.ts` /
> `EXPORT_SUBSECTIONS` (those names exist only as quotations inside PRODUCT_MODES_ARCH §8 itself).
> §1–§2 document what IS, with citations. §3 states the Mode A ownership boundary. §4 marks what is
> LOCKED vs extensible — the KDL-486 orchestrator ARCH freezes against this. §5 maps the 9 DAG
> stages onto surfaces. §6 lists genuine gaps. This is documentation plus a freeze line, not a
> redesign.

---

## 1. The extracted canonical IA

### 1.1 How the nav is assembled (the three sources)

The rendered admin sidebar is the composition of, in **fixed render order**
(`frontend/src/components/layout/AdminSidebar.tsx:274-400`):

1. **Static flat core items** — `FLAT_ITEMS` (`AdminSidebar.tsx:76-80`), rendered at `:275-294`.
2. **Module-contributed flat items** — `nonCoreNav` from `useModules()`
   (`frontend/src/hooks/useModules.ts:23`: enabled modules where `!m.core`, flat-mapped over each
   manifest's `nav[]`), rendered at `AdminSidebar.tsx:297-316`. Icons resolve by string name through
   `MODULE_ICON_MAP` (`AdminSidebar.tsx:42-56`, 13 names), falling back to `Package` (`:299`).
   The list comes from `GET /api/modules/enabled` (`backend/src/modules/modules/routes.js:19`),
   typed as `EnabledModule { slug, name, core, nav: ModuleNavItem[] }`
   (`frontend/src/types/models.types.ts:27-32`).
3. **Per-Type settings leaves** — one leaf per active `Type`, generated at runtime
   (`AdminSidebar.tsx:180-194`), rendered at `:319-339`, gated by `canViewSettings` (`:172-176`).
4. **Static groups** — `GROUPS` (`AdminSidebar.tsx:82-146`), rendered as collapsible sections at
   `:341-400`.

Every entry with a `permission` is filtered through `can()` — flat items at `:218`, module items at
`:220`, group children at `:221-223`; a group whose children all filter out disappears entirely
(`:224`).

### 1.2 The nav tree at master `3369250`

```
Admin sidebar
├─ Dashboard         /admin/dashboard        LayoutDashboard   (no permission)      core-static
├─ Users             /admin/users            Users             users:view           core-static
├─ Modules           /admin/modules          Package           modules:view         core-static
│
├─ [module-contributed — present iff that non-core module is ENABLED]
│  ├─ Example           /admin/example           Package         example:view          example/module.json
│  ├─ Integrations      /admin/integrations      Package         integrations:view     integrations/module.json
│  ├─ Notifications     /admin/notifications     Package         notifications:view    notifications/module.json
│  ├─ Page Builder      /admin/page-builder      LayoutTemplate  page-builder:view     page-builder-ui/module.json   (Mode B only)
│  ├─ Theme Engine      /admin/theme-engine      Palette         theme-engine:view     theme-engine-ui/module.json   (Mode B only)
│  └─ Template Engine   /admin/template-engine   Sparkles        template-engine:view  template-engine/module.json   (Mode A only; Phase 0 stub today)
│
├─ [per-Type leaves — one per active Type, dynamic]
│  └─ {Type.name}    /admin/settings/view/{Type.slug}   Cog     gated: canViewSettings
│
├─ Media (group, icon Image)                                     AdminSidebar.tsx:83-101
│  ├─ Library        /admin/media            Image             media:view
│  ├─ AI Providers   /admin/media/ai         Sparkles          media:ai-providers
│  └─ Cloud Imports  /admin/media/import     CloudUpload       media:cloud-import
├─ Access Control (group, icon Shield)                           AdminSidebar.tsx:102-120
│  ├─ Roles          /admin/roles            Shield            roles:view
│  ├─ Permissions    /admin/permissions      KeyRound          permissions:view
│  └─ Activity Log   /admin/activity-log     ClipboardList     activity-log:view
└─ Application Settings (group, icon UserCog)                    AdminSidebar.tsx:121-145
   ├─ Types          /admin/settings/types       ListChecks        types:view
   ├─ Categories     /admin/settings/categories  Briefcase         categories:view
   ├─ Fields         /admin/settings/fields      SlidersHorizontal setting-fields:view
   └─ Storage        /admin/settings/storage     HardDrive         settings:view
```

Ordering rules (all structural, all cited): flat core items first, module items second, type leaves
third, groups last (`AdminSidebar.tsx:274-400`); within the module block, order follows the enabled-
modules list flat-map (`useModules.ts:23`); type leaves are server-sorted by name ascending
(`AdminSidebar.tsx:186`); within `GROUPS` and their children, array order in the literal is the
display order.

Active-state rules: group children match **exactly** (`isLeafActive`, `AdminSidebar.tsx:211` — a
deliberate rule so `/admin/settings/types` does not light up siblings); flat and module items also
match descendants via `startsWith(href + '/')` (`:276`, `:298`).

### 1.3 Core vs module-contributed — and a wart to not trip on

The sidebar consumes **only non-core** manifest nav (`useModules.ts:23`). Core modules' `module.json`
`nav[]` arrays are **inert for the sidebar** — the static `FLAT_ITEMS`/`GROUPS` play their role. The
inert copies have already drifted from the rendered truth:

| Core manifest claim | Rendered truth |
|---|---|
| `user-management/module.json` Permissions icon `"Lock"` | `KeyRound` (`AdminSidebar.tsx:110`) |
| `user-management/module.json` Activity Log icon `"Activity"` | `ClipboardList` (`AdminSidebar.tsx:116`) |
| `settings/module.json` path `"/settings"` | no such sidebar entry exists |
| `media/module.json` declares Media + AI Providers only | sidebar Media group also has Cloud Imports (`AdminSidebar.tsx:94-99`) |

**Canonical = the rendered assembly** (`FLAT_ITEMS` + `GROUPS` statics, plus `nonCoreNav` dynamics),
NOT core manifests' `nav[]`. See gap G3 (§6).

`FLAT_ITEMS` and `GROUPS` are exported specifically so the CommandPalette reuses them as its single
navigation source (`AdminSidebar.tsx:74-76`; `frontend/src/components/command/CommandPalette.tsx:16,37-38`).
Any IA change must keep that consumer in mind — and note the palette does NOT include module items or
type leaves (gap G4).

## 2. The subsection model

### 2.1 The grouped pattern that exists

The only "subsection" structure in this IA is the two-level group: `NavGroup { label, icon,
children: NavLeaf[] }` (`AdminSidebar.tsx:68-72`), where `NavLeaf { label, href, icon, permission? }`
(`:61-66`). Groups are collapsible buttons with a chevron (`:347-372`); open state is per-label
component state (`:155`, `:215-216`) defaulting to open-when-a-child-is-active (`:212-214`). There is
**no third level** and no group support in module manifests — `ModuleNavItem { label, path, icon?,
permission? }` (`models.types.ts:6-11`) renders exclusively as flat top-level leaves
(`AdminSidebar.tsx:297-316`).

### 2.2 What the prototype's `enabled:false` maps onto

The prototype "marks subsections `enabled:false`" — present in the IA, not rendered, reserved for
later. This repo already has that mechanism, and it is **module registry status**, not a per-entry
flag:

- A module has status `AVAILABLE | INSTALLED | ENABLED | DISABLED` (`models.types.ts:4`).
- `GET /api/modules/enabled` returns only enabled modules (`backend/src/modules/modules/routes.js:19`),
  so a nav entry declared in the manifest of an installed-but-disabled module is
  **reserved-but-hidden**: nothing is deleted, and re-enabling restores the entry verbatim from the
  manifest.
- This is precisely the mechanism Mode A already uses to suppress `theme-engine-ui` /
  `page-builder-ui` nav (§3), proven by the KDL-446 Phase 0 browser gate
  (`.agents/PRODUCT_MODES_ARCH.md:122-126`).

A second, orthogonal hiding mechanism exists per-user: the `permission` field filters entries for
users lacking the permission (`AdminSidebar.tsx:218-224`). That is visibility, not reservation.

**Ruling for the orchestrator ARCH: `enabled:false` ≙ module status `DISABLED`/`INSTALLED`. Do not
invent a per-nav-entry `enabled` flag** — the registry already expresses hidden-but-reserved at the
right granularity (a surface), and Studio's own stage-level show/hide belongs inside the Studio
surface (§5), not in the sidebar model.

## 3. Mode A ownership boundary

Per D1/PM-001 and the Mode table (`PRODUCT_MODES_ARCH.md:56-65`). The Phase 0 stub already exercises
every mechanism named here (shipped in KDL-446; `backend/src/modules/template-engine/module.json:5`
self-describes as the stub).

### 3.1 What Studio takes over

Exactly **one sidebar entry**: `Template Engine` → `/admin/template-engine` (Sparkles,
`template-engine:view`) from `template-engine/module.json:9-11`, rendered through the ordinary
`nonCoreNav` path. All Studio-internal navigation — the 9 stages — lives **inside**
`/admin/template-engine/*` as in-surface navigation (§5). Studio does **not** restructure the
sidebar: the manifest nav model cannot express groups (§2.1), and it does not need to.

Studio also takes over **token writes**: `settingField` rows with `owner_module: 'theme-engine'` get
`locked_by: 'template-engine'` on install (`backend/src/modules/template-engine/seed.js:1-6`).

### 3.2 What Studio suppresses

The two Mode B product surfaces, via `conflictsWith: ["theme-engine-ui", "page-builder-ui"]`
(`template-engine/module.json:13`), enforced symmetrically in the service layer
(`backend/src/modules/modules/service.js:17-30`):

| Suppressed entry | Route | Manifest |
|---|---|---|
| Theme Engine | `/admin/theme-engine` | `theme-engine-ui/module.json` |
| Page Builder | `/admin/page-builder` | `page-builder-ui/module.json` |

Because those modules cannot be enabled while `template-engine` is active, their nav never enters
`/api/modules/enabled`, so the entries vanish by the §2.2 mechanism. The Theme Engine screen stays
directly routable but renders read-only: page-level lock via `isEnabled('template-engine')` with the
"Managed by Template Engine" banner (`frontend/src/app/admin/theme-engine/page.tsx:559-596`), and
server-side 409 on writes to locked fields **while the locking module is ENABLED**
(`backend/src/modules/theme-engine/service.js:262-273`).

Net sidebar delta in Mode A: **+1 entry, −2 entries.** Nothing else moves.

### 3.3 What stays untouched

Everything else: the three `FLAT_ITEMS`, all per-Type leaves, all three `GROUPS` (Media, Access
Control, Application Settings), and unrelated non-core module entries (Integrations, Notifications,
Example) render identically in both modes. Layer 1 engines (`theme-engine`, `page-builder`,
`core: true`, no rendered nav — §1.3) keep serving their APIs; `template-engine` `dependsOn` both
(`template-engine/module.json:12`).

### 3.4 Non-destructive switch back to Mode B

- **Disable** `template-engine`: its nav entry drops out of `/api/modules/enabled`; the 409 stops
  firing because enforcement checks the locking module's live status
  (`theme-engine/service.js:266-271`); the lock banner clears (`page.tsx:559-560`).
- **Re-enable** `theme-engine-ui` and `page-builder-ui` (now unblocked — the symmetric conflict
  check passes): their nav entries return verbatim from their manifests.
- **Uninstall** `template-engine` additionally nulls every `locked_by: 'template-engine'` row
  (`backend/src/modules/template-engine/uninstall.js:1-6`).
- No data moves in either direction — tokens and pages always lived in the engines' tables
  (`PRODUCT_MODES_ARCH.md:72-77`); the KDL-446 browser gate proved values intact across the round
  trip (`:122-126`).

## 4. LOCKED vs extensible

The KDL-486 orchestrator ARCH freezes against this section. "LOCKED" = changing it requires a board
decision recorded in `.agents/DECISIONS.md`; ambiguity here becomes a breaking change later, so
anything not listed as extensible is LOCKED by default.

### LOCKED

| # | Frozen fact | Anchor |
|---|---|---|
| L1 | The two-level nav model (flat leaves + one level of groups) and the four-block render order: flat core → module items → type leaves → groups | `AdminSidebar.tsx:274-400` |
| L2 | `FLAT_ITEMS` and `GROUPS` labels, routes, grouping, and ordering as the canonical core IA (also the CommandPalette's source) | `AdminSidebar.tsx:76-146`, `CommandPalette.tsx:16` |
| L3 | Manifest nav shape `ModuleNavItem { label, path, icon?, permission? }` and its flat-leaf-only rendering — no groups from manifests | `models.types.ts:6-11`, `AdminSidebar.tsx:297-316` |
| L4 | Core modules never contribute sidebar entries via manifest (`nonCoreNav` rule) | `useModules.ts:23` |
| L5 | Mode A suppression set is exactly `["theme-engine-ui", "page-builder-ui"]` — growing it is a board decision | `template-engine/module.json:13` |
| L6 | Studio's sidebar presence is exactly one entry rooted at `/admin/template-engine`; stage navigation is in-surface, never sidebar items | §3.1, §5 |
| L7 | Mechanism bindings: `conflictsWith` = surface exclusivity; `locked_by` + server 409 = read-only; module status = hidden-but-reserved (`enabled:false`). No parallel mechanisms. | §2.2, §3.2 |
| L8 | The `template-engine` slug (board lifted D3, chose it over `studio` — OQ-2). The board answered three times on KDL-453: `13e9aa18` (07:54:43Z, *studio*) conflicted with `2ee691cb` (07:56:05Z, *lift D3*), and the explicit FINAL tie-breaker `d326e28f` (board_only, resolved 2026-08-18T07:58:36Z) settled it: *template-engine, lift D3, audit-history ambiguity accepted*. **Anchor caveat:** `DECISIONS.md:112` still records OQ-2 as *unresolved* — the board's answer arrived by interaction and the doc has not been amended yet, so the board thread is the authority until then. The DECISIONS.md D3→RESCINDED amendment + data-hygiene plan (old Module-15 migration and historical `activity_log` rows carry this slug) are owned by KDL-486, not here. | KDL-453 interaction `d326e28f` (FINAL tie-breaker; supersedes `2ee691cb`/`13e9aa18`); `DECISIONS.md:112` (stale, amendment pending) |

### Extensible (no board decision needed)

| # | Extension point | Anchor |
|---|---|---|
| E1 | New non-core modules adding flat leaves via `module.json` `nav[]` — the designed extension point | `useModules.ts:23` |
| E2 | Adding icon names to `MODULE_ICON_MAP` (module icons are limited to its 13 entries; unknown names fall back to `Package`) | `AdminSidebar.tsx:42-56,299` |
| E3 | New active Types creating type leaves — dynamic by design | `AdminSidebar.tsx:179-194` |
| E4 | Additive children inside existing `GROUPS` (existing order preserved) | `AdminSidebar.tsx:82-146` |
| E5 | Everything below `/admin/template-engine/*` — the Studio-internal IA is owned by the KDL-486 orchestrator ARCH and evolves without touching the sidebar, within the frozen §5 surface contract (S1–S4 and the `/{stage-slug}` route tail are not E5-extensible) | §5 |

## 5. The 9 DAG stages mapped onto surfaces

**Provenance warning (read §6 G1 first):** no document in this repo enumerates the 9 stages. The
count appears once, unnamed: "thin orchestrator only: 9-stage DAG, gating, preflight, export"
(`PRODUCT_MODES_ARCH.md:158`). The stage **list** below is therefore PROPOSED — derived from the §7
follow-on pipeline (`:149-162`), the Mode A data flow (`:67-70`), and BRAND_KIT_AI_ARCH — and
**KDL-486 owns the canonical DAG** and may rename or re-bound stages. What THIS doc freezes is the
**surface contract**, which is stage-list-agnostic:

- **S1 — One sidebar entry.** Stages never appear in the admin sidebar (L6). The sidebar item is
  active for every stage via the `startsWith` descendant rule (`AdminSidebar.tsx:298`).
- **S2 — Deep-linkable stage routes** under the module root: `/admin/template-engine/projects/{projectId}/{stage-slug}`
  (project scoping per `.agents/arch/PROJECTS_ARCH.md`; single-project deployments may collapse the
  `projects/{projectId}` segment — KDL-486 decides, the pattern tail `/{stage-slug}` is the contract).
- **S3 — In-surface stepper** as the stage navigation: an ordered list of the 9 stages, each in one
  of `locked | available | in_progress | done | needs_attention`. Gating renders as **disabled
  stepper steps with the blocking reason** — never by hiding steps and never via sidebar changes.
  The stepper is the UI projection of the orchestrator's server-side gating; the client enforces
  nothing (execution semantics are KDL-486's).
- **S4 — Progress lives in the surface**, not the sidebar. The current sidebar has no per-item
  badge/progress affordance and this doc does not add one.

Proposed stage list and screens (slugs are the `{stage-slug}` values; each maps 1:1 to a screen):

| # | Stage (proposed) | Slug | Screen (under `/admin/template-engine/projects/{projectId}/`) | Derived from | Nav/gating representation |
|---|---|---|---|---|---|
| 1 | Intake | `intake` | company name, industry, logo upload | brand-kit logo intake, §7.3 (`:153`); projects context (`:149-150`) | Always available; entry screen of a project |
| 2 | Palette extraction | `palette` | review deterministic extraction: dominant colours, ramps, contrast | `ExtractedPaletteSummary`, `BRAND_KIT_AI_ARCH.md` §1/§7 | Locked until intake has a logo |
| 3 | Brand inference | `inference` | AI typography pairing, tone, strategy copy | D2 (`PRODUCT_MODES_ARCH.md:132-136`) | Locked until palette accepted; shows credit cost preflight (D3 `:137-140`) |
| 4 | Brand approval | `approval` | approve the brand; on approve the orchestrator POSTs `/api/theme-engine/values` | Mode A data flow (`:67-70`); frozen hand-off `GET /api/brand-kit/:projectId/tokens` (KDL-453, 2026-08-18) | Locked until inference complete; done = tokens written |
| 5 | Brand guidelines | `guidelines` | brand-guidelines PDF | §7.3 (`:153-155`) | Available after approval |
| 6 | Collateral | `collateral` | visiting card, letterhead, t-shirt, ID card; PDF + Word export | §7.4 (`:156-157`) | Available after approval; per-item progress inside the screen |
| 7 | Website assembly | `website` | pages assembled from Puck component packs, driving the page-builder engine APIs | §7.6 (`:160-162`), engine boundary (`:43-48`) | Available after approval |
| 8 | Preflight | `preflight` | pre-export checks: credits balance/gate, completeness | "gating, preflight" (`:158`); credits preflight gate (`:151-152`) | Locked until 5–7 have minimum content; blocking reasons listed |
| 9 | Export | `export` | final export | "export" (`:158`) | Locked until preflight passes |

If KDL-486 lands different stage names or boundaries, only this table's rows change; S1–S4 and the
route pattern hold.

## 6. Genuine gaps

- **G1 — The 9-stage list is not fixed anywhere.** The prototype that defined the stages was never
  obtained; the repo holds only the count (`PRODUCT_MODES_ARCH.md:158`). §5's list is derived, not
  board-ratified. **Recommendation:** KDL-486 (Backend Architect) enumerates the canonical stages in
  TEMPLATE_ENGINE_ARCH.md as the single source of truth; §5's table then conforms to it. If KDL-486
  cannot derive 9 defensible stages either, that goes back to the board — do not pad to 9.
- **G2 — Manifest nav cannot express subsections.** `ModuleNavItem` has no children and module items
  render flat-only (`models.types.ts:6-11`, `AdminSidebar.tsx:297-316`). The prototype's
  subsection-bearing IA therefore cannot be reproduced *in the sidebar* by any module, Studio
  included. **Recommendation:** do not extend the manifest schema; the in-surface stepper (§5 S3)
  covers the need. Extending manifests to groups would be a board-level L3 change.
- **G3 — Dual source of truth for core nav, already drifted** (§1.3 table). Risk: an agent "fixes"
  nav by editing a core manifest and nothing changes. **Recommendation:** low-priority cleanup
  ticket to strip `nav[]` from core manifests (or mark them inert in `docs/MODULE_GUIDE.md`). Not
  blocking KDL-486.
- **G4 — CommandPalette omits module entries and type leaves** (`CommandPalette.tsx:37-38` uses only
  `FLAT_ITEMS` + `GROUPS`). In Mode A the Studio entry — the primary surface — is unreachable from
  the palette. **Recommendation:** small follow-up to also consume `nonCoreNav`; falls under E1-style
  extension, no board decision.
- **G5 — No per-item progress affordance in the sidebar.** If the board ever wants stage progress
  visible at sidebar level (the prototype hints at richer nav), that is a new affordance on L1/L3
  surfaces — a board decision. This doc deliberately keeps progress in-surface (§5 S4).
