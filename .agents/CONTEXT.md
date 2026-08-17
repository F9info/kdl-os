# KDL Starter Kit — Project Context

Last updated: 2026-07-16

## Current state
- **All 6 build phases + the 15 modules are complete** (Auth, Users, Settings, Media DAM, User-Management/RBAC, Theme Engine, etc.). The project is now in **evolve-to-production** mode, not initial build.
- **Operating model: the CEO runs autonomously.** The user's only steering lever is the company **Goal + milestones**. The CEO plans, assigns, executes, reviews, advances phases, and merges without human-approval gates (see CEO HEARTBEAT.md "Full autonomy" + "Strict goal-adherence").
- **Tech stack is LOCKED** (see CLAUDE.md "Tech Stack" + "Model Allocation"). Do not change it; a genuine gap is *proposed* to the board for approval, never added unilaterally.
- **Runtime config:** Claude Code adapter on the Claude subscription. CEO heartbeat every 30 min, thinking Medium, web/Chrome enabled. Coders on Sonnet 4.6; architects/reviewer/security/AI-services on Fable 5.

## What the goal points at (current milestones)
M1 Close open MEDIUM review findings · M2 Whisper transcription (`/api/ai/transcribe`, 501 stub) · M3 forgot-password backend (`/api/auth/forgot-password`) · M4 production hardening · M5 deployment readiness. (See the company Goal for the live list — the user updates it to change priority.)

## Known open items (from code review)
- MEDIUM findings M1–M7 in ai-services (logger module; Redis SCAN vs keys(); scrub MANUAL_TASKS write; bound Promise.all in ingest; scoped MeiliSearch key; import.meta.url paths; jwt algorithms).
- Whisper transcription endpoint (501 stub) and forgot-password backend endpoint (frontend is a static stub).

## Where to look
- Conventions, tech stack (locked), model allocation, module how-to → `CLAUDE.md`
- Repo orientation (modules → paths → ports) → `.agents/WORKSPACE_MAP.md`
- Locked decisions → `.agents/DECISIONS.md` · Lessons/pitfalls → `.agents/LESSONS.md`
- Recent handoffs/status (rolling) → `.agents/HANDOFF.md`, `STATUS.md` (archives: `*_ARCHIVE.md`)
- Module specs → `.agents/<MODULE>_ARCH.md`

## Key decisions (unchanged)
PostgreSQL host 5433 · Redis host 6380 · ES Modules throughout backend · Prisma client from `config/database.js` singleton only · no `ANTHROPIC_API_KEY` (Claude via the Paperclip subscription). The old OpenRouter "budget brain" / `BUDGET.md` path is retired.
