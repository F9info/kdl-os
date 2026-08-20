# Merge Discipline — KDL Starter Kit

Canonical reference for merge train rules, lockfile ownership, and dependency pin policy.
All agents and contributors must follow these rules. No exceptions.

---

## 1. Rebase-before-CI (mandatory)

Before pushing a branch for CI or review, it **must** be rebased on top of `master`:

```bash
git fetch origin
git rebase origin/master
```

**Why:** Stale branches fail CI because `pnpm-lock.yaml` or `package-lock.json` drifts between the PR branch and master. This produces spurious `fix(ci)` commits that clog the history and waste tokens re-fixing the same drift.

**Agent rule:** Never open a PR or push a CI run without rebasing first. If you find yourself writing a `fix(ci):` commit, stop — rebase instead and force-push.

---

## 2. Small PRs — one concern per PR

| Allowed in one PR | Must be split |
|---|---|
| Single feature or bug fix | Feature + lockfile bump |
| Single workspace lockfile update | Backend fix + frontend fix |
| CI/tooling change | Multiple unrelated fixes batched for convenience |
| Docs update | Any of the above |

**Max size:** < 400 lines changed (excluding generated files and lockfiles). If larger, split it.

**Agent rule:** Open the PR, then check `git diff --stat origin/master`. If the diff is > 400 lines of non-generated code, split before requesting review.

---

## 3. Lockfile ownership — one workspace per PR

Each PR may touch lockfiles in **at most one workspace**:

| Workspace | Lockfile |
|---|---|
| `frontend/` | `frontend/pnpm-lock.yaml` |
| `backend/` | `backend/package-lock.json` |
| `ai-services/` | `ai-services/package-lock.json` |

**Forbidden:** A feature PR that modifies `frontend/pnpm-lock.yaml` AND `backend/package-lock.json`.

**Why:** Cross-workspace lockfile changes in one PR make CI failures ambiguous and often signal that a rebase caused unintended package resolution changes in the wrong workspace.

The `lockfile-guard` CI job (`.github/workflows/lockfile-guard.yml`) enforces this automatically.

### Exception: Dependabot

Dependabot PRs are exempt — they own the lockfile by design. Merge them promptly (Monday is the scheduled day). Never manually edit a lockfile in a Dependabot PR.

---

## 4. Dependabot batching

Dependabot is configured to open **one grouped PR per workspace per week** (every Monday) covering all minor and patch bumps. Do not change the schedule to daily or per-package.

**Limit:** `open-pull-requests-limit: 3` per ecosystem. If the limit is hit, merge older PRs first.

**Major version bumps** are excluded from auto-PRs. When a major is released:
1. Open a tracking issue: `chore(deps): bump <package> to vX — manual review needed`
2. Test locally, read the migration guide, then merge manually.

---

## 5. Dependency pin policy

### When to pin (use exact version)

Pin a package only when:
- An upstream bug or breaking change is confirmed in a range of versions and a fix is not yet released.
- A transitive dependency has a CVE with no upstream fix (use `pnpm.overrides` / `overrides` in `package.json`).
- The package has a known unstable release cadence (e.g., tools with frequent breaking changes in minor versions).

### How to pin

For direct dependencies, set an exact version in `package.json`:

```json
"some-pkg": "1.2.3"
```

For transitive deps with a vulnerability and no fix:

```json
// frontend/package.json
"pnpm": {
  "overrides": {
    "vulnerable-transitive-pkg": ">=safe-version"
  }
}
```

Always add a comment in the PR description explaining:
- What version range is affected
- Link to the upstream issue / advisory
- When the pin should be removed (e.g., "remove after `parent-pkg` publishes v2.1.0")

### When NOT to pin

- Do **not** pin to avoid a Dependabot bump — fix the actual incompatibility instead.
- Do **not** pin the same package twice in different lockfiles (the `lockfile-guard` workflow will catch cross-workspace drift, but check manually too).
- Do **not** leave stale pins after the upstream fix is released. Pins accumulate into invisible tech debt.

### Pin removal

When the upstream fix ships:
1. Remove the override or loosen the version range.
2. Run `pnpm install` / `npm install` to update the lockfile.
3. Run CI.
4. Reference the original tracking issue in the PR description.

---

## 6. No `fix(ci)` commits in feature branches

A `fix(ci):` commit on a feature branch always means one of:
- The branch was not rebased before CI ran, or
- A lockfile drifted because the PR mixed concerns.

**Resolution:**

```bash
# Always prefer this:
git fetch origin
git rebase origin/master
git push --force-with-lease

# Over this:
git add .
git commit -m "fix(ci): sync lockfile"
git push
```

Squash any accidental `fix(ci)` commits before the PR is merged:

```bash
git rebase -i origin/master  # mark fix(ci) commits as fixup
```

---

## 7. No direct push to master — all code lands via GitHub PR merge (mandatory)

**Rule:** Never push commits directly to `master`. Every change — feature, fix, docs, hotfix — must
land through a GitHub Pull Request that is merged via the GitHub UI (or `gh pr merge`). GitHub
Actions billing outages or local workarounds are **not** exceptions to this rule.

**Why this matters:** When a commit is pushed directly to `master`, GitHub automatically closes any
open PR whose branch contains that commit — setting `state=CLOSED` and leaving `mergedAt=null`.
This corrupts the PR audit trail: the ledger shows the work as "closed" rather than "merged",
making it impossible to reconstruct what shipped from PR history alone.

**Incident record:** During the 2026-08 GH Actions billing outage, agents used a local-verify +
direct-push-to-master workaround. This caused at least PR #169 (feat(KDL-482) brand-kit Phase 1,
commit 3b3ab44) to be permanently recorded as CLOSED with no mergedAt, even though the code shipped.
The workaround is retired as of 2026-08-19 when billing was restored.

**The only correct merge path:**

```
1. Commit to a feature branch (never commit directly to master)
2. Push the branch: git push origin <branch>
3. Open a PR: gh pr create --base master --head <branch> ...
4. Wait for CI to pass (re-rebase on green master if needed)
5. Merge via GitHub: gh pr merge <number> --squash   (or merge button in UI)
```

**If CI is broken org-wide** (e.g., billing outage):
- Do NOT push directly to master.
- Do NOT merge the PR manually.
- Mark the Paperclip issue blocked with `unblockDescriptor: "CI billing outage — see BILLING_OUTAGE_RUNBOOK.md"`.
- Wait for billing to be restored, then merge normally.
- The billing-alert workflow (`billing-check.yml`) will open a GitHub issue when overage begins.

**Forbidden actions:**
- `git push origin master` (direct push)
- `git push origin HEAD:master`
- Any push that bypasses the PR workflow, regardless of emergency or time pressure

---

## 8. Summary checklist (copy into every PR)

```
- [ ] Branch pushed — not a direct push to master
- [ ] Rebased on current master
- [ ] Single concern (no mixed feature + lockfile)
- [ ] Lockfile in at most one workspace
- [ ] No fix(ci) commits (or squashed before merge)
- [ ] Pin change documented with reason and removal trigger (if applicable)
- [ ] Merged via GitHub PR (gh pr merge or UI) — never git push master
```

The `.github/pull_request_template.md` includes this automatically.
