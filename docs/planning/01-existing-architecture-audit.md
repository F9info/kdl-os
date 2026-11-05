# 01 — Existing Architecture Audit

Status: PLANNING ONLY. Nothing here has been implemented. Findings come from a read-only code inspection on 2026-11-04. Items marked (verify) were reported but not independently re-checked.

## 0. Verification log (2026-11-04, second pass, read-only)

Claims from the first exploration were re-checked directly against the code.

| Claim | Result |
|---|---|
| `SiteLayout` table unused | **Confirmed.** Only `schema/site-layout.prisma` and its migration reference it; no backend code. |
| Header/footer layout in `localStorage` | **Confirmed** (`lib/website-layout-overrides.ts:118,128`). |
| No favicon / app-config | **Confirmed.** `frontend/public` holds only `seed/`, `vendor/`; no `icon`/`favicon` file, no `icons` in `app/layout.tsx`; zero hits for `app-config` anywhere. |
| `'KDL Admin'` hardcoded | **Confirmed, in 5 places:** `app/layout.tsx:14` (title), `(auth)/layout.tsx:27`, `AdminShell.tsx:23`, `AdminSidebar.tsx:287` (fallback), plus a comment. Login page branding also needs identity. |
| Website Details requires `menus` module | **Confirmed.** Page wrapped in `<ModuleGuard slug="menus">` (`website-details/page.tsx:307`); nav entry lives in `menus/module.json:15`. Admin-only users cannot reach it without enabling Menus. |
| `brand-profile-logo` ignored on save | **Confirmed** (`website-details/page.tsx:99`). |
| `app_settings` public GET unused by site | Public GET exists (`settings/routes.js:10-11`, `optionalAuthenticate`). Not re-checked for site consumers. |
| Publish workflow is partial | **Confirmed and sharper:** `BuilderPage` has only `status DRAFT|PUBLISHED`. No versions, no rollback, no SEO columns, no `site_id`; only `project_id`. Publishing is a flag flip. |
| Onboarding is one yes/no | **Confirmed.** `projects/onboarding.js`: key `onboarding.frontend`; "no" only stores the answer. |
| "~700 hardcoded Tailwind palette classes" | **Not reproduced.** A regex count over `admin/page-builder` finds **237** raw palette-class occurrences. Treat 700 as unverified; scale is "hundreds", not exact. |
| `conflictsWith` mode-switch in use | **Corrected.** The key is in the manifest schema and 9 manifests, but every manifest I read has it empty. Mechanism exists; **no real conflict is declared.** |
| Module count | 34 directories under `backend/src/modules`, 33 manifests (one directory without `module.json`, not identified). |

**Corrections found during T1.2 (2026-11-04):**
- "Two logos" was overstated. `brand-kit/service.js:196` calls `setGlobalLogo(path)` on every BrandKit logo upload, so the admin `logo` field follows the BrandKit logo. It is one logo written to two places, not two independent logos.
- "Two company-name stores" was overstated. The per-project `brand-intake.<projectId>` store is dead (nothing in the frontend calls it, per a comment in `contact-fields.js`). The only live store is the global `brand-profile-*` fields.
- Storage drivers (local, MinIO, S3) all serve files via **presigned URLs that expire after 7 days**, so stored logo values are storage paths and must be resolved at read time.

Not independently re-verified (still from the first pass): the nginx routing details, the Theme Engine `webapp` vs `webapp_admin` split, `patchBrand`/`patchLayout` bake behavior, and per-block use of `use-settings-field-values` (3 blocks).

Impact on the plan: no change to direction. Doc 04 should not assume existing `conflictsWith` data. Doc 05/06 should treat publishing as "flag only today".

## 1. Current architecture

- One monorepo: `backend/` (Express 5 + Prisma 6), `frontend/` (Next.js 15), `ai-services/`, `infra/`.
- nginx gives a single origin: `/api/` -> backend, `/ai/` -> ai-services, `/` -> generated `site-preview` app, admin routes (`/admin`, `/login`, ...) -> frontend.
- The admin app also contains its own public renderers (`app/_site/SitePage.tsx`, `app/p/[slug]`, `sectors/`, `catalog/`, `work/`).
- The generated site is built by the Template Engine from `frontend/projects/<slug>` (`template-engine/site/generator.js`).

## 2. Settings: there is no single store

| Kind | Storage | Admin UI | Site reads live? |
|---|---|---|---|
| Generic KV flags | `AppSetting` (`app_settings`) | none (redirect only) | no |
| Dynamic fields | `Type` / `Category` / `SettingField`, `SettingValue`, `ProjectSettingValue` | `/admin/settings/*` | only 3 blocks |
| Company name, contact | `SettingField`, type `brand-profile` | `/admin/website-details` | no, baked into page JSON |
| Website logo | `BrandKit.logo_media_id` | `/admin/website-details` | no, baked into Header props |
| Admin sidebar logo | `SettingField` slug `logo` | `/admin/settings/fields` | n/a (separate logo) |
| Colors / fonts | Theme Engine (`webapp`, `webapp_admin`, ...) | `/admin/theme-engine` | yes (CSS tokens) |
| Navigation | `Menu` / `MenuItem` | `/admin/menus` | yes |
| Header/footer layout | browser `localStorage`; `SiteLayout` table unused | Studio website stage | no |
| SEO | sectors + detail pages only | their forms | partial |
| Modules | `Module` table + `module.json` | `/admin/modules` | gates nav and routes |

## 3. Feature status

| Feature | Status |
|---|---|
| Module registry, install/enable/disable, dependsOn, conflictsWith, core protection | Implemented |
| Puck page builder + packs | Implemented |
| Section Builder (custom blocks) | Implemented; insertion is a copy, not a live link |
| Theme Engine (tokens, versions, platforms) | Implemented; block coverage partial |
| Template Engine / Studio (9 stages) | Implemented |
| Menus | Implemented, live |
| Brand Kit | Implemented, with duplicate/legacy fields |
| Header/footer persistence | Partial (localStorage) |
| Global SEO | Missing |
| Favicon, app name, app title | Missing |
| Product selection (Admin/Website/Landing) | Missing |
| Setup wizard | Partial (one yes/no dialog) |
| Landing pages as an independent product | Missing |
| Multi-site / multi-project | Partial (one project allowed) |
| Preview / publish workflow | Partial (verify) |

## 4. Problems

1. Brand data is a snapshot baked into page JSON; edits need a Website-stage re-run.
2. Two logos (BrandKit vs `logo` field); `brand-profile-logo` is deliberately ignored.
3. Two company-name stores (`brand-intake.<projectId>` legacy vs `brand-profile`).
4. `SiteLayout` Prisma model has no backend code referencing it.
5. Header/footer are per-page block instances, so edits do not propagate.
6. Colors in three places (Brand Kit palette, Theme Engine, hardcoded Tailwind palette classes; 237 occurrences counted under `admin/page-builder`, see section 0).
7. `webapp` and `webapp_admin` token sets are edited in different tabs.
8. Root layout title hardcoded `'KDL Admin'`; no favicon.
9. `app_settings` public GET is unused.
10. Admin-only user cannot reach Website Details without enabling the `menus` module.
11. Legacy number-prefixed block props (`faq1Question`) co-exist with migrated arrays on old pages.

## 5. Naming problems

"Engine" used for Theme, Template; "Studio", "Website Details", "Brand Kit", "Setting Fields", "Settings" all overlap. Users cannot tell which screen controls what.

## 6. Technical risks

- Migrating identity data (4 stores -> 1) must be reversible and idempotent.
- Live brand binding changes the render path of every Header/Footer block.
- Hardcoded palette classes will not respond to theme or identity colors until refactored.
- Public endpoints (`/app-config`) must expose only whitelisted, non-secret fields.
- CLAUDE.md locks the tech stack; none of this plan requires a stack change.

## 7. Preserve

Module manifest system, Puck + Section Builder, Theme Engine versions/locks, Studio stages, live menus, RBAC, activity logging.
