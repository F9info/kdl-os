# Local CI Verification — When GitHub Actions Is Down

Use this runbook when GitHub Actions is unavailable (billing outage, runner capacity, etc.) and you need to verify a PR — especially security work such as Dependabot PRs or CVE patches that must not stall.

This mirrors what each CI job does, in order of risk.

---

## Prerequisites

You need: Node 20+, `npm`, `pnpm` 9, Docker (for a11y checks only).

```bash
# Verify toolchain
node --version   # must be >= 20
npm --version
pnpm --version   # must be >= 9
docker info      # only needed for a11y-smoke
```

---

## 1. Lockfile guard

Mirrors: `lockfile-guard` workflow.

```bash
# From repo root:
git diff --name-only origin/master...HEAD -- \
  '*/package-lock.json' '*/pnpm-lock.yaml' '*/yarn.lock'

# Count distinct workspace directories in the output.
# More than one workspace = fail (split the PR or let Dependabot handle it).
```

---

## 2. Backend checks

Mirrors: `backend-check` job.

```bash
cd backend
npm ci
npm audit --audit-level=high          # gate: fails on high/critical
node --check src/index.js             # syntax only, no runtime

JWT_SECRET="ci-jwt-secret-must-be-at-least-32-characters-long" \
JWT_REFRESH_SECRET="ci-refresh-secret-must-be-at-least-32-characters" \
  npm test
```

---

## 3. Frontend checks

Mirrors: `frontend-check` job (lint/typecheck/build only; smoke E2E needs Postgres + Redis).

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm audit --audit-level=high         # gate: fails on high/critical
pnpm format:check
pnpm lint
pnpm type-check

BACKEND_INTERNAL_URL=http://localhost:4000 \
  pnpm build

pnpm test
```

### Optional: smoke E2E locally

Requires a running backend with Postgres + Redis. If you have `docker compose` available:

```bash
# From repo root — start infra only
docker compose -f docker-compose.infra.yml up -d

# Then in separate terminals:
cd backend && \
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kdl_ci \
  REDIS_URL=redis://localhost:6379 \
  JWT_SECRET=ci-jwt-secret-must-be-at-least-32-characters-long \
  JWT_REFRESH_SECRET=ci-refresh-secret-must-be-at-least-32-characters \
  APP_ENCRYPTION_KEY=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef \
  CORS_ORIGIN=http://localhost:3000 \
  APP_PUBLIC_URL=http://localhost:4000 \
  npx prisma migrate deploy && npm run db:seed && node src/index.js

# In another terminal:
cd frontend && \
  cp -r .next/static .next/standalone/.next/static && \
  cp -r public .next/standalone/public && \
  node .next/standalone/server.js

# Run smoke:
E2E_BASE_URL=http://localhost:3000 \
E2E_ADMIN_EMAIL=admin@kdl.com \
E2E_ADMIN_PASSWORD=kdl-dev-seed-password \
  pnpm e2e e2e/smoke.spec.ts
```

---

## 4. AI-services checks

Mirrors: `ai-services-check` job.

```bash
cd ai-services
npm ci
npm audit --audit-level=high
node --check src/index.js
JWT_SECRET="ci-jwt-secret-must-be-at-least-32-characters-long" npm test
```

---

## 5. Frontend lint (a11y rules)

Mirrors: `frontend-lint` job (runs same `pnpm lint` as step 3 — already covered above).

---

## 6. Weekly dependency audit

Mirrors: `dependency-audit` workflow (runs full `npm audit` / `pnpm audit`).

```bash
# All three workspaces:
(cd backend      && npm audit --audit-level=info) || true
(cd backend      && npm audit --audit-level=high)

(cd frontend     && pnpm audit --audit-level=info) || true
(cd frontend     && pnpm audit --audit-level=high)

(cd ai-services  && npm audit --audit-level=info) || true
(cd ai-services  && npm audit --audit-level=high)
```

---

## Verdict guide for security PRs

| Check result | Action |
|-------------|--------|
| All gates pass locally | Merge with a comment noting local verification; link this doc |
| Lockfile touches > 1 workspace | Split or defer to Dependabot |
| `npm audit --audit-level=high` fails on the fix itself | Do not merge — escalate |
| Only `--audit-level=low` advisories remain | Merge; log in docs/DEPENDENCY_TRIAGE.md |

**Always record that local verification was used** — add a PR comment:

```
CI unavailable (billing outage — see KDL-424). Verified locally per docs/CI_LOCAL_VERIFICATION.md:
- [x] backend: lint, audit, tests
- [x] frontend: lint, typecheck, build, tests
- [x] ai-services: lint, audit, tests
```
