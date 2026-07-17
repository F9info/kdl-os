## Summary

<!-- One-line description of what this PR does. Reference the issue: KDL-NNN -->

## Type

- [ ] Feature / bug fix (product change)
- [ ] CI / tooling / infra (no product change)
- [ ] Dependency update (lockfile change)
- [ ] Docs only

## Merge discipline checklist

**All boxes must be checked before requesting review.**

- [ ] This branch is rebased on top of current `master` (run `git fetch && git rebase origin/master` if not)
- [ ] PR touches **one concern only** — split if it mixes feature + refactor + lockfile
- [ ] Lockfile changes are in **at most one workspace** (frontend _or_ backend _or_ ai-services — never all three in one PR)
- [ ] If lockfile was updated: ran `pnpm install --frozen-lockfile` / `npm ci` locally and CI is clean
- [ ] No `fix(ci):` commits — if you had to add one, the branch needed a rebase first; squash it before merging

## Screenshots / preview (required for visible UI changes)

<!--
If "Feature / bug fix (product change)" is checked above AND the change touches
any UI, paste before/after screenshots OR the staging preview URL.

Staging (always-on): https://staging.kdl.f9tech.com  ← board can click any time
  - macOS: Cmd+Shift+4 → drag region, then drag the file here
  - Browser full-page: DevTools → Cmd+Shift+P → "Capture full size screenshot"
  - Backend-only PRs: delete this section or write "N/A — no UI change".
-->

| Before | After |
|--------|-------|
| _screenshot or "N/A"_ | _screenshot_ |

## Verification

<!-- How was this tested? Pick the smallest proof that the change works. -->

- [ ] `pnpm build` / `npm test` passes locally
- [ ] Relevant unit / e2e test added or updated
- [ ] Screenshots or staging URL attached above (required for any visible UI change)

## Dependency pin changes (fill in if this PR pins or unpins a package)

| Package | Old version | New version | Reason |
|---------|-------------|-------------|--------|
|         |             |             |        |

See `docs/MERGE_DISCIPLINE.md` for the pin policy.
