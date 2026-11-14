# Installation flow

A fresh KDL OS shows the installer before the login page. It runs in the browser; the server records every
step, so a refresh resumes where it stopped and a failed step can be retried.

| # | Step | What it does |
|---|------|--------------|
| 0 | **Setup token** | Opening the installer needs a token that only the server shows (see below). |
| 1 | Database | Tests the connection and checks that every migration is applied. Read-only: the connection comes from the server's `DATABASE_URL`, never from a web form. |
| 2 | Company | Name, logo, phone, email. Saved as the company identity. |
| 3 | Admin account | Name, email, password (12+ characters). Only a bcrypt hash is kept, and only until step 4 uses it. |
| 4 | Core installation | Runs the core seeders (modules, projects, roles and permissions, default users, brand kit, theme, credits) and creates the Super Admin. Same ordered list as `npm run db:seed` (`backend/prisma/core-seed.js`). |
| 5 | Application type | Admin only, Admin + frontend, Landing, Static... decides which modules are installed. |
| 6 | Modules | Core modules first (always on), then what the chosen type installs, then optional extras to tick, each with its description, dependencies and status. For a website it also asks "Start with a sample website?" (default yes). |
| 7 | Launch | Installs and enables the type's modules plus the chosen extras, marks the install complete, then shows a completion screen: database and core status, seeders run, modules enabled, whether sample content was created, links to the site and to sign in. |

## The Modules step

`GET /api/install/modules` lists everything from the module manifests (`core`, `description`, `dependsOn`, `env`,
`conflictsWith`), so a new module appears with no installer change. An extra is offered only if it is not core,
is visible in the catalog and is not already part of the type; it is shown as blocked (and cannot be ticked) when
the server lacks an env var it needs or it conflicts with a module being installed. `PUT /api/install/modules`
validates the selection against that same list, then stores it in `app_settings` (`install.extra_modules`).
Choosing a different application type clears the extras and the sample-content answer, because they were picked for
the old type.

The sample-content answer is the existing `onboarding.frontend` setting (`yes`/`no`) that the Frontend (CMS) seed
and every module's sample rows already read. `no` creates the website with no demo site, landing pages or sample
rows. It is only asked when the type or an extra creates a website.

## The setup token

The installer has no login, so before the install is complete every wizard route needs the token
(`x-setup-token` header). Without it, anyone who can reach a new instance could finish the install.

- While the install is open, the backend generates one at start and prints it **once** in its log:
  `docker compose logs backend | grep SETUP`. Only its SHA-256 is stored.
- Lost it? `npm run install:token` (or `docker compose exec backend node scripts/install-token.js`) prints a new one.
- Scripted installs set `KDL_SETUP_TOKEN` (16+ characters) in the environment instead.
- With no token configured, every request is refused. Once the install is complete the routes answer 409 and
  no token is created.
- `GET /api/install/status` stays public but says only `installed` / `token_required` until a valid token is sent.

## The admin account

- A seeded Super Admin that nobody has signed in to yet (for example from `npm run db:seed`) is **taken over**
  by the wizard's account, so there is never a second, forgotten admin with a default password.
- An account that has signed in is never touched; using its email is refused.

## Progress, logs, retry

- Steps are recorded in `app_settings` (`install.steps`), with a capped log (`install.log`, last 200 lines).
  `GET /api/install/progress` returns both.
- Steps 4 and 6 take a lock: one run at a time, a stuck run is retried after 10 minutes, a failure leaves the step
  retryable, and a finished step is never run twice. Every seeder is idempotent, so a retry never duplicates data.
- The login gate fails **closed**: if the install status cannot be read, sign-in answers 503, never "let them in".

## Existing installs

A database that is already in use (somebody has signed in, or company identity is set) is marked complete at start
and never sent through the installer. `KDL_SKIP_INSTALL_WIZARD=1` does the same for CI.

## The seeder manager

All seeding goes through one manager, `backend/src/shared/seeders/manager.js`. The core seeders are registered in
`backend/prisma/core-seed.js`, each with a `version` and the seeders it `dependsOn`; `npm run db:seed` and the
installer's Core installation step both run that same registry.

- **Order:** dependencies first, otherwise the registered order. An unknown dependency, a duplicate name or a cycle
  throws at start.
- **Transactions:** each seeder runs in its own transaction and receives the transaction client. A failure rolls
  that seeder back, is recorded as `failed`, and stops the run (later seeders may need it).
- **Run record:** `app_settings` key `seeders.runs` holds the latest version, status, time and duration of every
  seeder, and `seeders.log` the last 200 lines. Module seeds (`modules/<slug>/seed.js`) are recorded the same way as
  `module:<slug>` inside the install transaction.
- **Versions:** every seeder is idempotent, so by default all run (a code update may add rows). Bump a seeder's
  `version` when its output changes, then run only what is out of date.

```bash
node prisma/seed.js --plan               # what would run and why, changes nothing
node prisma/seed.js --pending            # only seeders never run, failed, or with a changed version
node prisma/seed.js --only=roles,credits # those, plus what they depend on
```

## Navigation links

- **Website menus (Header, Footer)** are filled from the pages that exist: each new page is added as a `page` link (by page id, so a renamed slug cannot break it), and a deleted page is removed from the menus. With "sample website" off the menus start empty.
- **Landing page header and footer links** in the built-in templates name a section, not an address (`Pricing|@LandingPricing`). When the page is built (`resolveSectionLinks`, `backend/src/modules/landing/templates.js`) the first section of that type gets an anchor and the link becomes `#anchor`; a link whose section is not on the page is dropped. Every landing section has an optional **Anchor** field in the editor for the same purpose.

## Browser tests

Two Playwright specs cover this flow (`frontend/e2e/`):

- `installer-fresh.spec.ts` runs the whole wizard on an **empty** database: a wrong token is refused, every step, a refresh
  mid-wizard, launch, the completion screen, sign-in as the new admin, and the installer being closed afterwards. It is
  skipped unless `E2E_FRESH_INSTALL=1` and `E2E_SETUP_TOKEN` are set, so a normal e2e run is unaffected.
- `platform-sweep.spec.ts` runs on any **installed** stack and changes nothing: the dashboard's platform status, the main
  admin screens, and (when the sample landing pages exist) four different headers with working menu links.

```bash
# fresh stack (the token is in the backend log: docker compose logs backend | grep "SETUP TOKEN")
cd frontend
E2E_FRESH_INSTALL=1 E2E_SETUP_TOKEN=<token> E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/installer-fresh.spec.ts
E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_EMAIL=asha@acme.test E2E_ADMIN_PASSWORD='correct horse battery 9' \
  pnpm e2e e2e/platform-sweep.spec.ts
```

## Developer and Admin sign-ins

The seed creates `developer@kdl.com` (Developer) and `siteadmin@kdl.com` (Admin) outside production, each with a **random
one-time password** printed once in the backend log; both must change it at first login. There is deliberately no fixed
default password. To choose them: `SEED_TEAM_PASSWORD` (one password for both, 12+ characters, not printed),
`SEED_DEVELOPER_EMAIL`, `SEED_SITE_ADMIN_EMAIL`; `SEED_TEAM_USERS=false` skips both accounts.
