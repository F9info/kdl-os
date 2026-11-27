---
name: session-handoff
description: Use at the END of a work session in this repo, after tests pass, to record what changed per the project's Session Protocol (HANDOFF.md and STATUS.md). Do not use mid-task.
---

# End-of-session handoff

From `CLAUDE.md` Session Protocol steps 8 to 10:

1. Prepend a new entry at the top of `.agents/HANDOFF.md`. Keep about 8 entries, move older ones to `.agents/HANDOFF_ARCHIVE.md`.
2. Prepend an entry under `## Rolling changelog` in `STATUS.md` (not the generated block at the top). Older entries go to `.agents/STATUS_ARCHIVE.md`.
3. If a module build state, template-engine driver or blocked issue owner changed, run `node scripts/status-rollup.mjs`.

Entry content: what changed (files), how it was verified (exit codes), what is left or blocked. If a loop hit its iteration cap, write `BLOCKERS.md`.
