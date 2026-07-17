# Dependency Triage Process

## Overview

The frontend (`/frontend`) uses **pnpm** with two layers of dependency hygiene:

| Layer | Tool | Schedule | Action |
|-------|------|----------|--------|
| Automated updates | Dependabot | Weekly (Monday) | Opens PRs for minor/patch bumps |
| Vulnerability gating | `pnpm audit` in CI | Every PR | Fails build on high/critical CVEs |

---

## Dependabot PRs

Dependabot opens PRs every Monday for the following workspaces:

- `frontend/` — pnpm, grouped minor+patch into a single weekly PR
- `backend/` — npm, same schedule
- `.github/workflows/` — GitHub Actions pinning

**Major version bumps are excluded** from auto-PRs. They require manual review.

### Reviewing a Dependabot PR

1. Check the PR title — it should read `chore(deps): bump <package>`.
2. Review the changelog link Dependabot includes in the PR description.
3. Run CI (it runs automatically). If it passes, merge.
4. For packages with breaking API changes: test locally with `pnpm install && pnpm build && pnpm test` in `frontend/`.

### Dismissing / ignoring a Dependabot PR

If a bump introduces a regression and you need to hold it:

```bash
# In the PR, add a comment:
@dependabot ignore this version
# or ignore the minor series:
@dependabot ignore this minor version
```

Document the reason in the PR comment so future reviewers know why it was held.

---

## `pnpm audit` CI Gate

Every PR triggers two audit steps in `.github/workflows/ci.yml`:

```yaml
- name: Audit dependencies (warn — all severities)
  working-directory: frontend
  run: pnpm audit --audit-level=low || true   # never blocks

- name: Audit dependencies (gate — high/critical)
  working-directory: frontend
  run: pnpm audit --audit-level=high           # blocks the PR
```

The **warn step** prints the full audit report including moderate/low findings without failing.
The **gate step** fails the build if any **high** or **critical** CVE is present.

### When the gate fails on your PR

1. Run `pnpm audit` locally in `frontend/` to see the full report.
2. Identify the vulnerable package and the fix version.
3. **If a fix exists:** update the dependency in `package.json` and run `pnpm install`. Commit the updated `pnpm-lock.yaml`.
4. **If no fix exists yet (zero-day window):**
   a. Assess exploitability in context (is the vulnerable code path reachable in production?).
   b. If non-exploitable: add an override in `frontend/package.json` → `pnpm.overrides` to pin a safe transitive version, or use `pnpm audit --ignore-vulnerabilities <advisory-id>` with a comment explaining the rationale.
   c. If exploitable: escalate immediately — do not merge the PR.
5. Re-run CI after the fix.

### Adding a justified audit exception

For transitive dependencies with no upstream fix:

```json
// frontend/package.json
{
  "pnpm": {
    "overrides": {
      "vulnerable-pkg": ">=fixed-version"
    }
  }
}
```

Always leave a code comment or PR description explaining the override and link the upstream advisory.

---

## Manual audit (on demand)

```bash
cd frontend
pnpm audit                          # full report, all levels
pnpm audit --audit-level=high       # high/critical only
pnpm audit --json | jq '.advisories' # machine-readable
```

---

## Escalation

| Severity | SLA | Owner |
|----------|-----|-------|
| Critical | Fix or mitigate within 24 h | On-call engineer |
| High | Fix within 7 days or open a tracking issue | Frontend lead |
| Moderate / Low | Triage at next sprint | Team |
