# PaperclipAI — Cross-Check & Token-Burn Diagnosis

**Checked:** 2026-07-11 · via browser at `127.0.0.1:3100/KDL` · Company: **KDL OS**
**Goal:** full cross-check — why usage/limits are exhausted in 15–30 min, and what's missing.

## What's healthy ✅
- CEO agent completed the work: **KDL-150 "Fix Media DAM bugs + add per-user/shared media" → done**, merged **PR #14** into master, branch deleted, issue closed. Recent tasks KDL-146→150 all "done".
- Adapter = **Claude Code** (`claude`, CLAUDE LOCAL), primary model resolves to **anthropic/claude-sonnet-5** (good — not Opus).
- **Cheap model = Claude Fable 5 is ON** (routine work already offloaded).
- 10 agents enabled; success-rate trend healthy.

## Root causes of the fast burn 🔴

1. **Runs are uncapped.** CEO config: **Max turns per run = 1000**, **Timeout = 0 (unlimited)**. One run was **cancelled after 1h14m**; run token counts range **26k–152k tokens** (one at 152.7k). A single runaway run can drain the Claude subscription rate window in minutes.
2. **Large context re-sent every run.** The successful run cached **444.1k tokens** — that's CLAUDE.md + all `.agents/*` specs loaded each session (the session protocol reads 5 files every run, and `CLAUDE.md`'s "Common Mistakes to Avoid" list is very long and keeps growing). High input/cache per turn × many turns = fast burn.
3. **Org monthly spend limit hit.** Multiple runs 20–21h ago failed with **"You've hit your org's monthly spend limit"** ($60 cap; dashboard shows $17.49 / 29%). Per-agent budgets are **Disabled (unlimited)**, so nothing caps an individual agent.
4. **Thinking effort = Auto** on the CEO — can escalate to high-effort thinking on routine steps.

## What's missing ⚠️

1. **No skills are attached to any agent.** The CEO's Skills tab says *"No company-library skills installed on this agent,"* and every skill in the store shows **"0 agents."** 5 skills are installed at the company level (`paperclip`, `paperclip-board`, `paperclip-converting-plans-to-tasks`, `paperclip-create-agent`, `para-memory-files`) but **not assigned** to the agents that need them. Without the `paperclip` coordination skill and the plan→tasks skill, the CEO improvises orchestration — more turns, more tokens.
2. **Relevant catalog skills not installed/attached:** `code-review`, `doc-maintenance` (bundled), `github-pr-workflow` (bundled) — directly relevant to this project's Code Reviewer / docs / PR flow.
3. **Inbox = 74 unread** and **1 agent error** — approvals/notifications and an error are piling up unattended.

## Recommended fixes (in priority order)

**A. Cap runs (biggest immediate lever) — CEO + other coding agents**
- Max turns per run: **1000 → ~120**
- Timeout (sec): **0 → 1800** (30 min hard stop)
- Thinking effort: **Auto → Medium** (Low for routine agents)

**B. Attach skills to agents**
- CEO: `paperclip`, `paperclip-board`, `paperclip-converting-plans-to-tasks`, `para-memory-files`
- Backend Architect / coders: `paperclip`, `para-memory-files` (+ `github-pr-workflow`)
- Code Reviewer: `code-review`, `paperclip`
- Docs agent: `doc-maintenance`

**C. Shrink per-run context (repo side)**
- Trim `CLAUDE.md`: move the long "Common Mistakes to Avoid" / "What Is NOT Built" logs into a separate `.agents/LESSONS.md` that agents read only when relevant, so the always-loaded prompt is smaller.
- Reinforce scoped reads (the module ARCH docs already have "Read Scope" tables — make that the default habit; avoid whole-file reads).

**D. Budget / limits (your call)**
- Set a **per-agent** monthly cap (e.g. CEO $20) so one agent can't drain the org pool; keep the soft alert at 80%.
- Decide whether to raise the **$60 org cap** or keep runs cheaper via A–C.
- If the 15–30 min limit is the **Claude subscription rate window** (likely, since runs are CLAUDE LOCAL), A + C are the real fix — capping turns/among and shrinking context per turn.

## Applied 2026-07-11 (via Paperclip UI)

**Skills attached** (were all empty — "0 agents" on every skill):
| Agent | Skills now attached |
|---|---|
| CEO | paperclip · paperclip-converting-plans-to-tasks · para-memory-files |
| Backend Architect | paperclip · paperclip-converting-plans-to-tasks |
| Frontend Architect | paperclip · paperclip-converting-plans-to-tasks |
| Code Reviewer | paperclip |
| Backend Coder | paperclip |
| Frontend Coder | paperclip |
| DevOps | paperclip |
| Documentation | paperclip |
| AI Services | paperclip |

**Run caps:** CEO **Max turns 1000 → 120**, **Timeout 0 → 1800s** (saved).
**AI Services:** stale **error flag cleared** (its last run was a dependency-blocked cancel, not a crash) → back to idle.

## Applied 2026-07-11 (part 2)
1. ✅ **Capped all 9 build agents' runs** — Max turns **→ 120**, Timeout **→ 1800s** on CEO, Backend Architect, Frontend Architect, Backend Coder, Frontend Coder, Code Reviewer, DevOps, Documentation, AI Services. (Were 500–1000 turns / 0 timeout.) This is the biggest burn lever.
4. ✅ **Trimmed `CLAUDE.md`** — moved the long, ever-growing "Common Mistakes to Avoid" list (~45 lines) into **`.agents/LESSONS.md`** and left a one-line pointer. The always-loaded prompt is now much smaller, cutting input/cache tokens on every run.

## Still to do (needs your go-ahead / can't do)
2. **Install catalog skills to the company, then attach:** `code-review` → Code Reviewer, `doc-maintenance` → Documentation, `github-pr-workflow` → the two Coders. (They're in the catalog but not company-installed yet.)
3. **Org monthly spend cap ($60):** decide raise vs. keep — I won't touch billing. Per-agent budgets are all Disabled; consider a per-agent cap (e.g. CEO $20) with 80% alert.
5. **`test` agent** left as-is (general/sandbox, not part of the build workflow).
6. **Optional:** set Thinking effort Auto → Medium on the coders/reviewer for routine work (Auto can escalate).
