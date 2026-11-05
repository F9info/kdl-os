# 07 — Implementation Task List

Status: PROPOSAL. Nothing starts until you approve a specific task. Complexity: S (<0.5d), M (1-2d), L (3-5d), XL (>1w) in AI-assisted time. Paths are indicative; confirm in code before starting.

## Sequence and parallelism

```
P1 Identity ──► P2 Products/Wizard ──► P3 Live binding ──► P4 Global layout
                     │                                        │
                     └────────────► P5 Sites/Landing ◄────────┘
P5 ──► P6 SEO+Publish ──► P7 Rename, docs, tests
```
Independent: T1.x (identity backend) and T4.1 (layout schema design); T7.2 docs can start any time. Must be sequential: P1 -> P2 -> P3; P5 needs P4.

---

## Phase 1 — Application Identity (highest value, lowest risk)

**T1.1 Identity data model + API**
- Description: `identity.*` keys (or `ApplicationIdentity` row), CRUD API, public `GET /api/app-config` (whitelist), Redis cache.
- Purpose: one source of truth for branding.
- Backend: new module `identity` (routes/controller/service, Zod, `requirePermission('settings','edit')`, activity log, cache invalidation in service).
- DB: key/row only; no destructive change.
- Deps: none. Priority: P0. Complexity: M.
- Affected: `backend/src/modules/identity/*` (new), `modules/settings`.
- Acceptance: GET public returns only whitelisted fields; PUT validates; cache busts on save.
- Tests: service unit, route tests incl. permission denied, whitelist leak test.

**T1.2 Identity migration**
- Description: idempotent script copying `brand-profile-*` fields, BrandKit logo, `logo` field into identity. Old rows untouched.
- Complexity: M. Deps: T1.1. Priority: P0.
- Acceptance: re-runnable; before/after report; rollback = ignore new keys.
- Tests: fixture DB with/without legacy data.

**T1.3 Admin Identity page**
- Description: Settings > Application Identity (name, title, logos light/dark, favicon, colors, contact, social, copyright). Works without CMS/menus modules.
- Frontend: `frontend/src/app/admin/settings/identity/page.tsx`; uses `lib/axios.ts`, TanStack Query; nav entry gated only by `settings`.
- Complexity: M. Deps: T1.1. Priority: P0.
- Acceptance: admin-only install can set everything; no Studio/CMS needed.
- Tests: component test + e2e smoke.

**T1.4 Admin shell consumes identity**
- Description: `app/layout.tsx` metadata (title, favicon) and `AdminSidebar` logo/name from identity; remove hardcoded `'KDL Admin'`.
- Complexity: S. Deps: T1.1. Priority: P0.
- Acceptance: changing name/logo/favicon in T1.3 updates the admin without rebuild.

## Phase 2 — Products and Wizard

**T2.1 Product config + resolver**
- `products.enabled` setting; module manifest `products` hint; resolver (doc 04) + `GET /api/modules/graph`.
- Backend: `modules/modules/service.js` extension; reference counting `required_by`.
- Complexity: L. Deps: T1.1. Priority: P0.
- Acceptance: all 7 combinations resolve; conflicts reported; disable keeps data.
- Tests: table-driven resolver tests for all combos, conflict case, removal case.

**T2.2 Settings > Products UI** — product cards, preview of modules to enable, confirm. Complexity: M. Deps: T2.1.

**T2.3 Setup Wizard** — conditional steps (identity always; others per product); replaces `FrontendOnboardingDialog` (keep old flag readable). Complexity: L. Deps: T1.3, T2.1.

**T2.4 Product-aware nav** — sidebar hides Content/Design when no site product. Complexity: S. Deps: T2.1.

## Phase 3 — Live brand binding

**T3.1 Header/Footer/Logo blocks read `/api/app-config` at runtime** (stop baking in `patchBrand`/`patchLayout`/`patchLogoAtoms`). Complexity: L. Deps: T1.1.
- Risk: existing pages carry baked values; keep as fallback when identity empty.
- Acceptance: change company name -> site shows it with no Website-stage re-run.

**T3.2 Site `generateMetadata` + favicon from identity.** Complexity: S. Deps: T3.1.

**T3.3 Retire `resyncWebsiteIfBuilt` brand path** after T3.1 verified. Complexity: S.

## Phase 4 — Global Header/Footer

**T4.1 Persist layout server-side** (revive `SiteLayout` or new table keyed by Site), API, replace `localStorage` override. Complexity: L. Deps: none (schema design) / T5.1 for site keying.
**T4.2 Pages reference layout instead of copying blocks.** Complexity: L. Deps: T4.1.

## Phase 5 — Sites and Landing Pages

**T5.1 `Site` model + page.site_id + backfill default website Site.** Complexity: L. Deps: P2.
**T5.2 Public router resolves Site by host/path.** Complexity: L. Deps: T5.1.
**T5.3 Landing product: `landing` module, page templates, "New Landing Page" flow.** Complexity: L. Deps: T5.1, T2.1.
**T5.4 `forms` module: definitions, submissions, notifications, CTA binding.** Complexity: L.
**T5.5 Per-site identity overrides (logo/colors/SEO defaults).** Complexity: M.

## Phase 6 — SEO and Publishing

**T6.1 Per-page SEO fields + global defaults + sitemap/robots.** Complexity: M.
**T6.2 `PageVersion`, publish/unpublish/rollback, cache revalidate.** Complexity: L.
**T6.3 Signed preview links.** Complexity: M.
**T6.4 Pre-publish validation.** Complexity: M.

## Phase 7 — Section registry, rename, docs, tests

**T7.1 Section schema metadata (explicit tab/field types) + `SectionDefinition` + linked custom sections.** Complexity: XL. Deps: P5.
**T7.2 Terminology rename (labels only, routes redirect).** Complexity: M. Deps: P2.
**T7.3 Theme unification UI (webapp + webapp_admin under Design > Themes) and migration of hardcoded palette classes to tokens.** Complexity: XL (incremental).
**T7.4 Docs (Diataxis how-to + reference), e2e for 5 scenarios, TTHW measurement.** Complexity: L.
**T7.5 Cleanup: deprecate old brand stores after one release.** Complexity: S.

## Cross-cutting acceptance (every task)
Regression test per bug; Zod on all inputs; `try/catch -> next(error)`; Prisma singleton; activity logging wrapped in try/catch; one workspace lockfile per PR; rebase before push; PR body per CLAUDE.md.
