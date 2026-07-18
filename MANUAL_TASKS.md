# MANUAL_TASKS.md — Tasks for Prasanna to Complete Manually

**Owner:** Prasanna  
**When to use this file:** Agents append to this file whenever a LOW-complexity task hits the daily OpenRouter budget limit, or whenever a task is better done manually (config values, secrets, account setup).

Agents never skip these tasks — they log them here and continue with the rest of their work. Prasanna completes these offline and ticks them off.

---

## How This Works

1. Agent encounters a LOW task and OpenRouter budget is exhausted
2. Agent writes the task here with full context (what file, what to write, why)
3. Agent continues with the next non-blocked task
4. Prasanna completes the manual task, checks the box, and notes the file path
5. Orchestrator reads this file at next session start — clears completed items

---

## Pre-Build Setup Tasks (Do Before Phase 1)

These require human accounts and credentials — agents cannot do them.

- [ ] **Create GitHub repository** — `kalamdreamlabs/kdl-starter-kit` (public OSS or private — confirm positioning decision from Part P4 first)
- [ ] **Set up OpenRouter account** — get API key at https://openrouter.ai — add to `.env` as `OPENROUTER_API_KEY`
- [ ] **Set up MinIO** — run locally or use MinIO Cloud. Add credentials to `.env`
- [ ] **Set up MeiliSearch** — run via Docker (included in docker-compose) or cloud. Set `MEILISEARCH_API_KEY`
- [ ] **Set up SMTP** — Gmail app password or SendGrid. Fill `SMTP_*` vars in `.env`
- [ ] **Set up Sentry** — create project at sentry.io, get DSN. Add `SENTRY_DSN` to `.env`
- [ ] **Confirm JWT_SECRET** — generate a secure 64-char random string and set in `.env`
- [ ] **Copy `.env.example` → `.env`** — fill in all values before running Phase 1

---

## Phase 1 Manual Tasks (Root Infrastructure)

Low-complexity config files that are safe to write by hand:

- [ ] **`.gitignore`** — standard Node.js + Next.js gitignore. Copy from https://github.com/github/gitignore
- [ ] **`README.md`** — project title, one-line description, "coming soon" placeholder. Agent will expand after Phase 6.
- [ ] **`pnpm-workspace.yaml`** — content: `packages: ['backend', 'frontend', 'ai-services']`
- [ ] **`turbo.json`** — basic Turborepo pipeline config (build, lint, test tasks). Agent can generate, or copy from https://turbo.build/repo/docs

---

## Phase 2 Manual Tasks (Backend Foundation)

- [ ] **`.env.example`** — copy from `KDL_DevEnvironment.md → Part K` and fill with placeholder values (not real secrets). Agent generates this but confirm all vars are present.
- [ ] **`prisma/seed.js` test run** — after agent writes the seed file, run `pnpm prisma db seed` manually and confirm the seeded admin logs in (`SEED_ADMIN_EMAIL`, default `admin@kdl.com`; password is `SEED_ADMIN_PASSWORD` if set, else printed once by the seed).

---

## Phase 3 Manual Tasks (Backend Modules)

- [ ] **Postman / curl smoke test** — after agent completes Phase 3, run these manually:
  ```bash
  # Register
  curl -X POST http://localhost:4000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.com","password":"Test@123"}'

  # Login
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@kdl.com","password":"<your SEED_ADMIN_PASSWORD>"}'
  ```
  If both return 200 → Phase 3 is approved. Confirm to agent.

---

## Phase 4 Manual Tasks (Frontend)

- [ ] **Browser smoke test** — after agent completes Phase 4, open http://localhost:3000 and confirm:
  - Login page renders
  - Login with the seeded admin credentials works (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, see docs/ENV_REFERENCE.md)
  - Admin dashboard loads with sidebar
  - Users table shows at least 1 user
  If all pass → Phase 4 is approved. Confirm to agent.

---

## Phase 5 Manual Tasks (AI Services)

- [ ] **Chat endpoint test** — after agent completes Phase 5:
  ```bash
  curl -X POST http://localhost:5000/ai/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello, what can you do?","sessionId":"test-123"}'
  ```
  Confirm response arrives and brain used is logged in `STATUS.md`.

- [ ] **Budget check** — open `BUDGET.md` and confirm OpenRouter spend is within daily limit. Adjust `OPENROUTER_DAILY_BUDGET` in `.env` if needed.

---

## Phase 6 Manual Tasks (DevOps & Final)

- [ ] **Docker full-stack test** — run `docker compose up --build` and confirm all 9 services start without errors
- [ ] **CI/CD** — push to GitHub and confirm GitHub Actions CI workflow runs green
- [ ] **Final approval** — review `REVIEW.md` (Code Reviewer Agent output) and confirm Phase 6 complete

---

## Ongoing: Agent-Queued Manual Tasks

*Agents append here during their sessions. Format below.*

---

```
## Manual Task — [Phase X] — [Date]
**Queued by:** [Agent name]
**Reason:** OpenRouter budget exhausted / requires human credentials / low-priority config
**Task:** [What to do]
**File:** [File path]
**Content to write:**
[exact content or instructions]
**Status:** [ ] Pending → [x] Done (date)
```

---

## Manual Task — KDL-333 — 2026-07-17
**Queued by:** DevOps agent  
**Reason:** Requires human cloud accounts, credentials, and VPS provisioning — agents cannot do these.  
**Task:** Activate the always-on staging preview URL (KDL-333)

### Step 1 — Provision a $6/month VPS (5 min)
Any provider works (Hetzner CX11, DigitalOcean Droplet, Vultr, etc.). Ubuntu 22.04.  
Note the public IP — call it `STAGING_HOST`.

### Step 2 — Bootstrap Docker on the VPS (2 min)
```bash
ssh ubuntu@<STAGING_HOST> 'bash -s' < infra/scripts/staging-bootstrap.sh
```

### Step 3 — Add GitHub secrets (repo → Settings → Environments → staging → Secrets)

> **Important:** Set these in the `staging` **environment** (Settings → Environments → staging → Secrets),
> NOT in repo-level Secrets → Actions. The `preflight` and `deploy-staging` jobs both declare
> `environment: staging`, so they can only read environment-scoped secrets. Repo-level secrets work
> too, but the environment is the canonical location and is what `preflight` checks.

| Secret name | Value |
|-------------|-------|
| `STAGING_HOST` | VPS IP or hostname |
| `STAGING_USER` | SSH user (`ubuntu` or `root`) |
| `STAGING_SSH_KEY` | Private key (generate with `ssh-keygen -t ed25519`; add public key to VPS `~/.ssh/authorized_keys`) |
| `STAGING_ENV` | Full contents of a staging `.env` file (copy from `.env.example`, fill real values — DB password, JWT secret, etc.) |
| `GHCR_TOKEN` | GitHub PAT with `read:packages` scope (Settings → Developer settings → Personal access tokens) |

### Step 4 — Add GitHub environment variable (repo → Settings → Environments → staging → Variables)

| Variable name | Value |
|---------------|-------|
| `STAGING_URL` | `http://<STAGING_HOST>` (or your domain once DNS is pointed) |

### Step 5 — Optional: point a domain
Point `staging.kdl.f9tech.com` (or similar) A record to the VPS IP.  
Update `STAGING_URL` env var to use the domain.  
Update the staging URL in `.github/PULL_REQUEST_TEMPLATE.md` to match.

### Step 6 — Trigger first deploy
Push any commit to `master` — `cd-staging.yml` runs automatically.  
Or: GitHub → Actions → "CD Staging" → "Run workflow".

**Status:** [ ] Pending → [ ] Done (date)

---

*Kalam Dream Labs Pvt Ltd — MANUAL_TASKS.md v1.0*
