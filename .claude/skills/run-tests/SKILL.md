---
name: run-tests
description: Use when you need the exact test, lint or type-check commands for a workspace (backend, frontend, ai-services) or to run one file or one test. Do not use for rebuilding containers.
---

# Run checks per workspace

Workspaces have separate package files. No root runner. backend and ai-services use npm, frontend uses pnpm.

```bash
# backend  (needs JWT_SECRET and JWT_REFRESH_SECRET, 32+ chars, in env)
cd backend && npm ci            # if node_modules is missing
npm test
npx vitest run path/to/file.test.js
npx vitest run path/to/file.test.js -t "test name"

# frontend
cd frontend && pnpm install     # if node_modules is missing
pnpm type-check && pnpm lint && pnpm test
pnpm test path/to/file.test.tsx
pnpm e2e e2e/smoke.spec.ts      # needs running backend + Postgres + Redis

# ai-services  (needs JWT_SECRET)
cd ai-services && npm test
```

Backend and ai-services have no lint script. Judge results by exit code. Full CI-mirroring sequence: `docs/CI_LOCAL_VERIFICATION.md`. If dependencies are not installed, say so instead of reporting a pass.
