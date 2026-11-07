# KDL OS: Task List

Source: `docs/KDL_OS_Vision_Gap_Report.md` (gaps G1 to G16) plus the six security reviews from 2026-11-07. Work happens one task at a time, in the order you give. Nothing starts without your go-ahead.

Status key: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` dropped.
Effort is a rough planning guess: S (hours), M (about a day), L (several days).

## Working rules for every task

- Read `CLAUDE.md`, `.agents/HANDOFF.md`, `STATUS.md` first.
- Branch from `master`, rebase before every push, never push to `master`. One concern per PR. One workspace lockfile per PR.
- Zod for validation. `successResponse` / `errorResponse`. Controllers wrapped in `try/catch -> next(error)`. Prisma only from `config/database.js`.
- A regression test for each bug fixed. Run tests and linters, use exit codes.
- Prisma migrations need design review. Never edit a lockfile by hand in a Dependabot PR.
- Update `.agents/HANDOFF.md` and the changelog in `STATUS.md` when a task ends.

## Decisions (taken 2026-11-07, owner delegated the choice)

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Project type: one value or a set of flags? | **Set of flags**: admin, website, landing, static | Your Project F and G rows combine types |
| D2 | Landing page: its own Project, or a Site inside a Project? | **Site inside a Project** (existing model) | Smallest change, already works |
| D3 | Static export: API container or separate worker? | **API container for now**, with env isolation from S7 | A separate worker is a later step |
| D4 | Existing "default project"? | **Keep it** as the seeded demo project | No data migration needed |
| S1 | Purge the DB dump from git history? | **No.** Untrack, ignore, rotate credentials | A history rewrite needs a force-push. Repo has broken refs and many branches |

# Phase 0. Urgent security (independent, can run any time)

## S1. Purge the committed database dump
- **Gap:** `backups/kdl_db_before_step10_20260706_113121.sql` is tracked. It has `users.password_hash`, `refresh_tokens.token_hash`, `app_settings`.
- **Do:** `git rm --cached` the file. Add `backups/` and `*.sql` to `.gitignore`. Purge from history (needs your approval, it rewrites history and force-pushes). Rotate admin passwords and settings secrets from 2026-07-06. Revoke all refresh tokens.
- **Done when:** the file is not in `git ls-files` or history. Credentials rotated.
- **Effort:** S. **Needs your approval:** yes (history rewrite).

## S2. TLS, HSTS and security headers at the production edge
- **Gap:** `infra/nginx/nginx.conf` has `listen 80` only. No headers, no `server_tokens off`. `X-Forwarded-For` is client-controlled. No `limit_req`.
- **Do:** 443 server with TLS 1.2+, redirect 80 to 443, HSTS, nosniff, frame, Referrer-Policy, Permissions-Policy, baseline CSP. Use `$remote_addr` and `X-Forwarded-Proto`. Add `limit_req` on `/api/auth/` and `/ai/`. Or document the load balancer that terminates TLS.
- **Done when:** the merged prod compose config passes a header check.
- **Effort:** M.

## S3. Production compose hardening
- **Gap:** default seed password in the base compose, prod keeps the dev `site-preview` (`next dev`), MailHog in prod, floating image tags, `env_file` gives every container all secrets.
- **Do:** `${SEED_ADMIN_PASSWORD:?required}` in prod and staging. Replace `site-preview` with a built image or drop it from prod. Point prod SMTP at a real server. Pin image tags and make `IMAGE_TAG` required. Scope env per service.
- **Done when:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` shows no dev defaults.
- **Effort:** M.

## S4. Secret scanning and CI supply chain
- **Gap:** no secret scanning. Actions pinned by tag. No SBOM or signing. `|| true` on audits. `frontend/.env.local` tracked.
- **Do:** gitleaks in CI and pre-commit. Pin actions to SHAs. Add provenance, SBOM and cosign to the CD build. Remove `|| true` where a gate is intended. `git rm --cached frontend/.env.local`.
- **Effort:** M. **Note:** CI and lockfile changes go in separate PRs.

## S5. Auth hardening
- **Gap:** M-1 to M-6 and L-1 to L-9 from the auth review. Key ones: login limiter keyed `ip:email` only, non-atomic lockout that can lock out a victim, in-memory rate limits, unescaped `user.name` in the reset email, reset token race, account enumeration, no auth event logging.
- **Do:** IP-only limiter, atomic Redis lockout, Redis-backed limiter store, escape email HTML, `updateMany ... used:false` on reset, generic register response, `writeActivity` for login, lockout, reset, change. Cap password at 72 bytes, raise the minimum, rate limit `/refresh`.
- **Done when:** a regression test per fix.
- **Effort:** L (split into small PRs).

## S6. AI services: spend and tenant safety
- **Gap:** Claude spend uncapped, agent loop unbounded, Redis session keys not tenant-scoped, Meili tool has no tenant filter, retrieved text goes into the system prompt, PII not scrubbed on ingest, audit log not durable.
- **Do:** `CLAUDE_DAILY_BUDGET` pre-call check with atomic reserve, per-run agent cap, `{tenant}:{user}:{session}` keys, tenant filter or remove the Meili tool, delimit retrieved chunks as untrusted data, scrub before ingest, audit record with actor and tenant.
- **Done when:** budget exhausted returns 503 for HIGH. Regression tests.
- **Effort:** L.

## S7. Template Engine export security
- **Gap:** build subprocess inherits all API secrets and runs dependency scripts. Static build and download skip the approval gate and are not audit-logged. `apiBase` accepts any scheme. No global build limit.
- **Do:** allowlisted env and `--ignore-scripts`, or a separate worker. Require `EXPORT = DONE`. Audit log start and download. `apiBase` https only with an allowlist. Global build semaphore and rate limit. Stream the zip.
- **Effort:** M to L. **Depends on:** D3. Overlaps T14 and T15.

# Phase 1. Project foundation (the core of Story 5)

## T01. Project model: type, status, config
- **Gap (G1):** `Project` has name, slug, is_default, is_shared only.
- **Do:** Prisma migration adding type (per D1), status, config JSON. Update Zod schemas, service, API. Seed existing rows with sensible defaults.
- **Done when:** a project can be created through the API with type, status, config. Existing data migrates cleanly.
- **Effort:** M. **Depends on:** D1.

## T02. Projects UI: list, create, switch, dashboard
- **Gap (G1):** the backend has `POST /api/projects`, the frontend never calls it. No `/admin/projects`. Dashboard ignores projects.
- **Do:** `/admin/projects` list and create dialog, project switcher in the admin shell, dashboard cards per project with type and status.
- **Done when:** a user creates three projects of different types and switches between them.
- **Effort:** M to L. **Depends on:** T01, D4.

## T03. Remove the default-project assumption
- **Gap (G2):** hard-coded in landing, onboarding, cms, page-builder `createPage`, `useDefaultProjectId`, Template Engine redirect.
- **Do:** resolve the project from the active project (header or route), not `is_default`. Make `project_id` required on content tables (team, FAQ, sectors, catalog, work, gallery, testimonials, case studies, menus, builder pages) with a backfill migration.
- **Done when:** no module calls `getDefaultProject` for normal operation. Content created in project A is invisible in project B.
- **Effort:** L. **Depends on:** T01, T02.

## T04. Per-project pages and slugs
- **Gap (G4):** `BuilderPage.slug` is globally unique, `listPages()` has no project filter.
- **Do:** unique on `(project_id, slug)`. Filter every page query by project. Update public routing to resolve by project and slug or domain.
- **Done when:** two projects each have a "home" and "about" page with no collision.
- **Effort:** M. **Depends on:** T03.

## T05. Per-project theme and identity
- **Gap (G3):** theme tokens, active mode, button and form styles, identity and media are global.
- **Do:** add project scope to theme-engine values and active theme (reuse the existing `ProjectSettingValue` override pattern where it fits). Per-project identity with install-level fallback. Scope media by project, or a shared library with project tags.
- **Done when:** editing project A colors does not change project B. Regression test.
- **Effort:** L. **Depends on:** T03.

## T06. Isolation tests
- **Gap:** only credits, brand-kit and collateral have project-scoping tests.
- **Do:** route tests proving a member of project A gets 403 or empty results on project B for pages, menus, theme, content, sites, forms.
- **Effort:** M. **Depends on:** T03 to T05.

# Phase 2. Onboarding and settings

## T07. Seed Admin and Developer users, one-command setup
- **Gap (G10):** only the Super Admin is seeded. No one-command setup.
- **Do:** seed an Admin and a Developer user in development (random printed passwords, forced change), or add a documented create-user step. Add a `make setup` or script that creates `.env`, starts compose and seeds. Retire or rewrite `setup.sh`.
- **Done when:** a fresh clone reaches a working login with three roles in one command.
- **Effort:** S to M.

## T08. Settings: separate names and logos, theme mode on admin-only installs
- **Gap (G9):** one `app_name` for company and app. No application logo. The Light/Dark/System UI is in a non-core module.
- **Do:** add `company_name` and `company_logo` next to `app_name` and the app logo in Identity. Move the Light/Dark/System control into core settings. The wizard asks for both names.
- **Done when:** User Story 1 step 6 works with no Theme module installed.
- **Effort:** S to M.

## T09. Automatic demo project on Frontend install
- **Gap (G8):** the demo is opt-in via a wizard answer and lands in the default project. Dependency seeds insert DemoLogo rows regardless.
- **Do:** installing the Frontend product creates a separate "Demo" project with starter pages, sections and sample content, unless declined. Fix dependency seeds to follow the same rule. Fix the dead `/p/demo-*` menu links.
- **Done when:** installing Frontend on a clean database gives a complete, editable demo project, and reinstall creates no duplicates.
- **Effort:** M. **Depends on:** T03, D4.

# Phase 3. Content as data

## T10. Template and theme library in the database
- **Gap (G8):** landing templates, starter pages and themes are code constants. No Template model.
- **Do:** Template and ThemePreset tables, seeders from the existing constants (upsert by key, never overwrite user edits), admin screens to browse, duplicate, edit, delete. Landing and Studio read from the DB.
- **Done when:** a user duplicates and edits a template with no code change.
- **Effort:** L. **Depends on:** T03.

## T11. Page duplicate and reusable page layouts
- **Gap (G12):** no page duplicate endpoint. Reusable page layouts exist only for detail pages.
- **Do:** `POST /api/page-builder/:id/duplicate`. Save a page as a layout and apply it to a new page.
- **Effort:** S to M.

# Phase 4. Guided frontend workflow

## T12. Guided project workflow (11 steps)
- **Gap (G7):** steps are scattered screens.
- **Do:** one stepper in this order: Project Setup, Theme, Homepage, Header and Navigation, Footer, Pages, Section Builder, Layout, Content, Preview, Launch. Each step links to the existing screen, shows done or not, and remembers progress per project.
- **Done when:** a new user completes a website without leaving the stepper.
- **Effort:** L. **Depends on:** T02, T05.

## T13. Project-level preview and Launch
- **Gap (G7):** preview is per page, and Launch is per-page Publish only.
- **Do:** project preview with desktop, tablet and mobile frames across all pages. A Launch action that checks readiness, publishes all pages and records launch state and time on the project.
- **Effort:** M to L. **Depends on:** T12.

# Phase 5. Static website export

## T14. Make the static export complete and independent
- **Gap (G6):** detail pages missing, no per-page SEO, sitemap or robots. Baked `localhost:4000`. MinIO hotlinks with expiring URLs. Forms need a backend. Drafts and landing pages leak in.
- **Do:**
  1. Export sector, catalog and work detail pages.
  2. Export per-page SEO, canonical, OG and Twitter tags. Generate `sitemap.xml` and `robots.txt`.
  3. Copy uploaded media into the export and rewrite URLs. Remove expiring presigned URLs.
  4. Remove the baked API URL. Give forms a static-friendly target (configurable endpoint or a third-party form action).
  5. Filter by published status and by `site_id`.
  6. Add a test that the output contains no admin or backend code.
- **Done when:** the exported folder opens from any static host with KDL OS unreachable, and every configured page and link works.
- **Effort:** L. **Depends on:** D3, S7.

## T15. Export robustness and status
- **Gap (G11):** in-memory job state, 404 on download after restart, generic errors, no timeout, same zip filename, no history.
- **Do:** persist build jobs in the database or BullMQ. Timeouts. Friendly error codes (npm offline, font fetch failed). `<slug>-<timestamp>.zip`. Keep the last N exports. Fix the permission mismatch between the page and the API.
- **Effort:** M. **Depends on:** T14.

# Phase 6. Landing pages

## T16. Landing page settings: theme, header, footer, SEO
- **Gap:** only a branding dialog. No per-landing theme or SEO.
- **Do:** per-landing theme override, header and footer choice, SEO fields (title, description, OG image, canonical), form and button settings.
- **Effort:** M. **Depends on:** T05, D2.

## T17. Landing Launch, generate and `landingpages` export
- **Gap (G5):** no Launch button, no `landingpages` folder, no export.
- **Do:** a Launch or Generate button per landing page. Output to `landingpages/<slug>/` with its own HTML, CSS, JS and assets. Independent URL. Zip download. Regenerate after edits. Reuse the static build engine from T14 and T15.
- **Done when:** two landing pages export to two folders, each opens on its own, and one export never overwrites the other.
- **Effort:** L. **Depends on:** T14, T15, T16, D2.

# Phase 7. Module system maturity

## T18. Gate core engines and public routes
- **Gap (G13):** page-builder, theme-engine, custom-blocks and projects have no gate. Public page-builder routes stay live when `cms` or `landing` is disabled.
- **Do:** gate public routes by the owning module or product. Keep core admin routes mounted. Render a clean empty state when a module is off.
- **Effort:** M.

## T19. Module update flow, uninstall, typed settings
- **Gap (G14):** `Module.version` is never compared with the manifest. Uninstall fails on permission grants. Settings are raw JSON.
- **Do:** compare versions, run an `upgrade` hook and re-run safe seeds. Make uninstall revoke grants and clean up, or fail with a clear message. Add a settings schema to `module.json` and render a form.
- **Effort:** M to L.

## T20. Seed correctness and idempotency
- **Gap (G15):** reinstall resurrects deleted demo rows and duplicates renamed ones. `seed-demo-site.js` overwrites user edits.
- **Do:** mark seeded rows with a `seed_key`. Never re-create a row the user deleted unless asked. Never overwrite edited rows. Make `seed-demo-site.js` safe, or fold it into T09.
- **Effort:** M. **Depends on:** T09.

# Phase 8. Documentation

## T21. Fix docs and refresh status
- **Gap (G16):** 11 contradictions plus a stale `STATUS.md`.
- **Do:** correct ports, reset-script rules, Prisma version, pnpm claim, credentials table, stale `CLAUDE.md` phase text, wizard description, and the `TEMPLATE_ENGINE_FLOW.md` platform picker and export wording. Run `node scripts/status-rollup.mjs`. Retire or rewrite `setup.sh`.
- **Effort:** S.

## T22. Documentation for the finished vision
- **Do:** per user story, a how-to (Diataxis): admin-only, website, static export, landing pages, multiple projects. Update `docs/KDL_OS_Project_Walkthrough.md` and regenerate its PDF.
- **Effort:** M. **Depends on:** the matching feature tasks.

# Suggested order

1. Decisions D1 to D4.
2. S1 now (urgent, small). S2 and S3 before any deployment.
3. T01 to T06 (project foundation).
4. T07 to T09 (onboarding).
5. T10, T11 (content as data).
6. T12, T13 (guided workflow and launch).
7. S7, T14, T15 (static export).
8. T16, T17 (landing pages).
9. T18 to T20 (module maturity).
10. S4, S5, S6 can run in parallel with the above at any point.
11. T21, then T22 as features land.

# Progress tracker

| ID | Task | Status |
|---|---|---|
| S1 | Purge committed DB dump | [~] untracked in git (committed in S4), ignored; history kept by decision; credential rotation is yours |
| S2 | TLS, HSTS, headers | [x] nginx.prod.conf (TLS 1.2+, HSTS, redirect); dev config hardened; verified in a container. Needs a real certificate to go live |
| S3 | Production compose hardening | [~] done: required IMAGE_TAG and seed password, real SMTP, no MailHog, next start, digest-pinned images. Open: per-service env_file, Chroma auth, Postgres app role |
| S4 | Secret scanning and CI supply chain | [x] scripts/secret-scan.mjs (pre-commit + CI), actions pinned to SHAs, token permissions, billing-check.yml YAML fixed; SBOM/provenance not done |
| S5 | Auth hardening | [x] IP-keyed Redis limiter, atomic lockout, escaped reset email, reset-token race, audit events, password 12 chars / 72 bytes, /refresh limited. Not done: generic register response (would break signup auto-login), Redis dependency left as custom store |
| S6 | AI services: spend and tenant safety | [x] Claude daily cap (atomic reserve, 503), per-run agent cap, tenant-scoped session keys, Meili tool removed (unused), retrieved text wrapped as data, scrub before ingest, audit has actor+tenant and goes to stdout. Not done: DB-persisted audit, per-instance caller limits |
| S7 | Template Engine export security | [ ] |
| T01 | Project model: type, status, config | [x] code and tests done; migration not yet applied to a real DB; not committed |
| T02 | Projects UI and dashboard | [x] code and tests done; not checked in a browser; not committed |
| T03 | Remove default-project assumption | [x] admin screens, landing and forms follow the active project. Moved on: page list and slugs to T04, identity to T05, seeds and onboarding to T09, public forms to T17, NOT NULL on pages done in T04, on the content tables is T04b |
| T04 | Per-project pages and slugs | [x] done and migration applied to dev DB; not browser-checked |
| T04b | NOT NULL project_id on the content tables (team, faq, sectors, catalog, work, gallery, testimonials, case studies, menus) with backfill | [ ] |
| T05 | Per-project theme and identity | [x] website theme (webapp) is per project; admin theme stays install-wide by design; identity uses the existing per-site overrides. Media scoping not done (T05b). Migration applied to dev DB; not browser-checked |
| T05b | Scope media by project (or project tags) | [ ] |
| T06 | Isolation tests | [x] found and fixed a real gap: content modules had no project access check. Guard + 26 tests. Not yet run against the live container |
| T07 | Seed Admin and Developer, one-command setup | [x] developer@kdl.com and siteadmin@kdl.com seeded (dev only, random one-time passwords, forced change); new setup.sh replaces the old bootstrap. Users created in the dev DB. Fresh-clone run not tested end to end |
| T08 | Settings: names, logos, theme mode | [ ] |
| T09 | Automatic demo project | [ ] |
| T10 | Template and theme library in DB | [ ] |
| T11 | Page duplicate and reusable layouts | [ ] |
| T12 | Guided 11-step workflow | [ ] |
| T13 | Project preview and Launch | [ ] |
| T14 | Complete and independent static export | [ ] |
| T15 | Export robustness and status | [ ] |
| T16 | Landing page settings | [ ] |
| T17 | Landing Launch and `landingpages` export | [ ] |
| T18 | Gate core engines and public routes | [ ] |
| T19 | Module update, uninstall, typed settings | [ ] |
| T20 | Seed correctness and idempotency | [ ] |
| T21 | Fix docs and refresh status | [ ] |
| T22 | Docs for the finished vision | [ ] |
