# Grep-Verify Completion Gate

Hard gate from KDL-330 Fix B2 (implemented in KDL-335): **no parent issue is closed until the claimed work is proven to exist on `master`.** "The child said done" and "the PR was opened" are not proof — commits get stranded on stacked bases, sessions die before pushing, and merged PRs can target the wrong base.

## The rule

Before PATCHing any parent issue (or any issue that claims landed code) to `done`, the closer runs:

```bash
scripts/grep-verify.sh \
  --commit <claimed-sha> \
  --file <claimed/path.ts> \
  --grep 'someClaimedSymbol:claimed/path.ts' \
  --pr <pr-number>
```

and pastes the full output into the closing comment. **Any `FAIL` line blocks the close.** Fix the gap (merge the PR, push the commit, re-do the work) or keep the issue open with the failure as the stated blocker.

## What it checks

| Flag | Proof |
| --- | --- |
| `--commit SHA` | Commit exists **and** is an ancestor of `origin/master` — catches stranded/unpushed/unmerged commits |
| `--file PATH` | File exists on `origin/master` — catches "done" reports referencing files that never landed |
| `--grep PATTERN:PATH` | Claimed code content actually greps on `origin/master` (fixed-string match) |
| `--pr N` | PR is `MERGED`, its base is `master` (not a stacked branch), and its merge commit is reachable from `origin/master` |

The script fetches `origin/master` first, so the verdict reflects the real remote, not a stale local checkout. `--allow-stale` skips the fetch for offline use and is marked in the output — do not use it for a real close.

## Why each check exists (observed failure modes)

- **Ancestor check:** a PR was merged into a stacked base branch that never reached `master`; the parent was nearly closed on top of stranded work.
- **Commit-exists check:** children have reported "done" with commit SHAs that were never pushed (session died before push).
- **PR-base check:** merged ≠ on master when the base was another feature branch.
- **File/grep checks:** "done" comments have referenced files/symbols that existed only in a dead worktree.

## Scope

- Applies to **every** parent-issue close and any close whose evidence is "commit X / file Y / PR Z landed".
- Does not replace CI, code review, or functional verification — it only proves *existence on master*, the minimum bar against false completions.
- Exit code is `0` only when every check passes, so it can be wired into automation as a true hard gate.
