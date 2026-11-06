# 10 — Primary workflow vs implementation: gap analysis

Date: 2026-11-06. Branch `akhil_kdl`. Method: code read + live stack (headless audit `frontend/e2e/flow-audit.spec.ts`, product scenarios e2e, API checks). Brief: "KDL OS – Primary Workflow & Architecture Implementation".

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Clone, configure, run, initial setup | Met | `docs/INSTALLATION_GUIDE(_SIMPLE).md`, `.env.example`, compose, seed, Setup Wizard. **README was stale (wrong ports, host `migrate dev`, old module list): fixed 2026-11-06.** Seeding is still a manual one-time command (documented). |
| 2 | Two roles, Developer and Admin, each with own dashboard + RBAC | **Gap** | Seeded roles: `super-admin`, `admin`, `user` (+ media roles). No `developer` role. One dashboard for everyone. RBAC itself works (`rbac.spec`). **Dashboard now permission-aware (fixed):** cards/queries only for `users:view`, `settings:view`, `media:view`; a role with none sees a welcome note and makes no 403 calls. **Open:** define the Developer role (permissions) and role-specific dashboard content. |
| 3 | Install/enable modules, nav follows, no duplicate settings | Met | Products resolver + Modules page; disabled modules leave the nav (`product-scenarios.spec`); duplicate stores removed (Q8/Q9, Identity is the only company store). |
| 4 | Build without code | Met | Identity, Products, Themes, Templates, Section Builder, Pages, Menus, SEO, preview, publish, all in admin. |
| 5 | Project types A–D | Partly | Admin and Landing and Website (web app) are products. **Static Website exists only as an export action** (Brands > Static website, one-click build + zip), not a selectable project type. |
| 6 | Combinations 1–7 in one install | Met functionally, **gap in presentation** | All seven are reachable (products admin / website / landing, + static export). The UI never names them, and "Web Application" vs "Static Website" is not a choice; a user must know to use the Static card. **Open:** a "website delivery" choice (web app / static) in Products + Wizard. |
| 7 | Section Builder | Mostly met | 105 section types, 29 with selectable design variants; add/edit/delete/reorder/duplicate via the editor (Puck built-ins, not disabled; **not yet covered by an interaction test**); content/images, colours (`*Color`, background), padding (65 blocks), typography (`typo*` fields in some packs); preview + Mobile/Tablet/Desktop viewports; linked sections reused across pages (T7.1). **Gap: no per-device configuration** (hide on mobile/tablet/desktop, per-breakpoint spacing); responsiveness is CSS-only and viewports are preview-only. |
| – | Dev data hygiene | Note | Dev DB holds ~11 `e2e-viewer-*` roles plus `media-*-test` roles left by earlier e2e runs (not seeded; `rbac.spec` cleanup does not remove them). Not a product defect; clean before demo. |

## Open items needing a decision (recommended order)
1. **Developer role**: which permissions separate Developer from Admin (suggestion: Developer = modules install/enable, products, themes/templates, integrations, storage, roles; Admin = content, users, media, forms, SEO), plus a role-aware dashboard.
2. **Website delivery choice** (Web application | Static export) shown in Settings > Products and the Setup Wizard, so combinations 1–7 are explicit.
3. **Per-device visibility** for every section (hide on mobile/tablet/desktop) via one generic wrapper in `composePacks`; per-breakpoint spacing later.
4. Section Builder interaction audit (drag-reorder, duplicate, delete, undo) in `flow-audit.spec.ts`.
