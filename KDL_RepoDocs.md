# KDL Starter Kit — Repository Documentation
**Kalam Dream Labs Pvt Ltd**
**Version:** v1.1
**Subtitle:** Agent architecture, orchestration, phases, prompting, loop engineering, plugins, and product architecture
**Date:** June 2026
**Status:** Pending Approval

---

## About This Document

This document covers the repository-level documentation for the KDL Starter Kit. It includes the project overview, the AI brain architecture, the agent registry, the orchestration system (session lifecycle, handoff protocol, budget tracking, context continuity), required project MD files, execution phases, AI services API endpoints, Claude prompting patterns for agents, loop engineering patterns, the official Claude Code plugins used during development, and the product architecture.

**See also:** KDL_DevEnvironment.md — Tech stack, services, schema, folder structure, and environment variables

---

## Overview

The KDL Starter Kit is a **generic, production-ready SaaS boilerplate** that is also **AI-agent buildable**. The entire project is designed to be developed, maintained, and extended by AI agents using a two-brain system (Claude + OpenRouter) — with humans approving phases, not writing code.

---

## Part A — AI Brain Architecture

### A1. Two-Brain System

Every AI task routes through one of two brains based on complexity. Low-complexity tasks (boilerplate, config files, simple utils) are flagged as manual tasks — see MANUAL_TASKS.md.

```
┌─────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR                          │
│         (routes tasks, tracks budget, manages           │
│          handoffs, maintains STATUS.md)                 │
└────────────────────┬──────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │                     │
 ┌────────▼───────┐    ┌────────▼─────────┐
 │  MAIN BRAIN    │    │  BUDGET BRAIN    │
 │    Claude      │    │   OpenRouter     │
 │  (Anthropic)   │    │ (Kimi / default) │
 └────────────────┘    └──────────────────┘
```

### A2. Brain Profiles

#### Main Brain — Claude (Anthropic)
- **When to use:** Architecture decisions, complex debugging, security review, code review, ambiguous requirements
- **Models:** claude-sonnet-4-6 (default), claude-opus-4-8 (hard problems)
- **Access:** Claude subscription (Paperclip AI) — no per-token API cost
- **Budget limit:** Daily session limit from subscription plan
- **Fallback:** OpenRouter for routine tasks to preserve Claude budget

#### Budget Brain — OpenRouter (Model-Agnostic)
- **When to use:** Routine code generation, CRUD implementations, frontend components, repetitive structured tasks
- **What is OpenRouter:** A single OpenAI-compatible API endpoint (`https://openrouter.ai/api/v1`) that aggregates 100+ models. Switch models by changing one config string — no code changes needed.
- **Default model:** `moonshot-ai/moonshot-v1-32k` (Kimi — strong at coding, very low cost)
- **Free-tier alternatives:** `meta-llama/llama-3.1-8b-instruct:free`, `google/gemma-2-9b-it:free`
- **Paid alternatives:** `mistralai/mistral-nemo`, `anthropic/claude-haiku-4-5`
- **API:** OpenRouter API (OpenAI-compatible) — single key, any model
- **Cost:** ~10–20× cheaper than Claude per token
- **Budget limit:** Daily OpenRouter API budget (set conservatively — see BUDGET.md)
- **Fallback:** When daily budget is exhausted → task goes to MANUAL_TASKS.md

### A3. Brain Routing Rules

```
TASK ARRIVES
     │
     ▼
Is it architecture / security / critical decision?
     ├─ YES → CLAUDE
     └─ NO
          │
          ▼
     Task complexity?
          ├─ HIGH → CLAUDE
          ├─ MEDIUM → OPENROUTER
          └─ LOW (boilerplate, configs, simple utils)
                    │
                    ▼
               OpenRouter budget available?
                    ├─ YES → OPENROUTER (cheapest free-tier model)
                    └─ NO → MANUAL_TASKS.md (Prasanna completes offline)
```

### A4. Task Complexity Classification

| Complexity | Examples | Brain |
|-----------|---------|-------|
| CRITICAL | Architecture decisions, security, data model design | Claude |
| HIGH | Complex feature logic, multi-file refactors, debugging | Claude |
| MEDIUM | CRUD endpoints, form components, service wrappers | OpenRouter |
| LOW | Boilerplate, config files, comments, simple utils | OpenRouter (free tier) or Manual |

---

## Part B — Agent Registry

### B1. Agent Roster (9 Agents)

Each agent has a defined role, default brain, tools, and handoff responsibility.

---

#### Agent 1: Orchestrator
- **Role:** Master coordinator. Reads the task queue, assigns work to agents, tracks budget, manages context, writes STATUS.md after every session
- **Default brain:** Claude (decisions require judgment)
- **Tools:** File read/write, STATUS.md, BUDGET.md, CONTEXT.md, HANDOFF.md
- **Skills:** Task planning, brain routing, conflict resolution, progress tracking
- **Triggers:** Every session start, every phase transition, every handoff
- **Responsibility:** Before ending any session — write HANDOFF.md with full context for the next agent

---

#### Agent 2: Backend Architect
- **Role:** Designs API structure, Prisma schema, middleware stack, module boundaries. Does NOT write implementation code.
- **Default brain:** Claude (architecture decisions are CRITICAL)
- **Tools:** File read/write, Prisma docs reference, API design patterns
- **Skills:** System design, data modeling, security patterns, REST API design
- **Triggers:** Phase 2 start, any schema change request, new module addition
- **Outputs:** Updated schema.prisma, DECISIONS.md entries, API contract docs

---

#### Agent 3: Backend Coder
- **Role:** Implements all backend code — controllers, services, middleware, routes, queues, workers
- **Default brain:** OpenRouter (routine coding is MEDIUM complexity)
- **Escalate to Claude when:** Logic is ambiguous, security-sensitive, or multiple approaches exist
- **Tools:** File read/write, npm, Prisma CLI
- **Skills:** Node.js, Express, Prisma, BullMQ, Redis, JWT, Zod validation
- **Triggers:** Phase 2 and 3 tasks
- **Outputs:** All backend source files under `backend/src/`

---

#### Agent 4: Frontend Architect
- **Role:** Designs component tree, routing structure, state management strategy, shared component API
- **Default brain:** Claude
- **Tools:** File read/write, Next.js docs reference
- **Skills:** Next.js App Router, TypeScript, component architecture, UX patterns
- **Triggers:** Phase 4 start, new module UI addition
- **Outputs:** Component design doc, routing map, store design

---

#### Agent 5: Frontend Coder
- **Role:** Implements all frontend code — pages, components, hooks, stores, types
- **Default brain:** OpenRouter
- **Escalate to Claude when:** Complex state logic, auth flow, performance issues
- **Tools:** File read/write, npm
- **Skills:** Next.js 15, TypeScript, TailwindCSS, shadcn/ui, Zustand, TanStack Query
- **Triggers:** Phase 4 tasks
- **Outputs:** All frontend source files under `frontend/src/`

---

#### Agent 6: DevOps Agent
- **Role:** Writes all infrastructure code — Docker Compose, Dockerfiles, Nginx config, GitHub Actions workflows
- **Default brain:** OpenRouter
- **Tools:** File read/write, Docker docs reference
- **Skills:** Docker, Nginx, GitHub Actions, shell scripting
- **Triggers:** Phase 1 and Phase 6
- **Outputs:** docker-compose.yml, Dockerfiles, infra/nginx/, .github/workflows/

---

#### Agent 7: AI Services Agent
- **Role:** Implements the ai-services layer — brain router, LangChain chains, ChromaDB embeddings, Whisper transcription
- **Default brain:** Claude (the AI layer itself requires careful design)
- **Tools:** File read/write, LangChain docs, ChromaDB docs
- **Skills:** LangChain.js, ChromaDB, OpenAI API, OpenRouter API, vector embeddings
- **Triggers:** Phase 5
- **Outputs:** All files under `ai-services/src/`

---

#### Agent 8: Code Reviewer
- **Role:** Reviews all code produced by other agents before a phase is marked complete. Checks correctness, security, consistency, and adherence to patterns.
- **Default brain:** Claude (review requires judgment)
- **Tools:** File read, diff review
- **Skills:** Code quality, security patterns, Node.js, TypeScript, Prisma, React
- **Triggers:** End of every phase (before human approval)
- **Outputs:** REVIEW.md with findings, inline code suggestions

---

#### Agent 9: Documentation Agent
- **Role:** Generates and maintains all MD documentation files — CLAUDE.md, API docs, README, AGENTS.md updates
- **Default brain:** OpenRouter (documentation is LOW–MEDIUM complexity)
- **Escalate to Claude when:** Writing complex technical explanations or architecture overviews
- **Tools:** File read/write
- **Skills:** Technical writing, Markdown, API documentation
- **Triggers:** After every phase completion
- **Outputs:** All documentation MD files

---

### B2. Agent Task Matrix

| Phase | Lead Agent | Support Agent | Reviewer | Brain Mix |
|-------|-----------|---------------|---------|-----------|
| Phase 1 | DevOps | — | Code Reviewer | OpenRouter + Claude review |
| Phase 2 | Backend Architect → Backend Coder | Documentation | Code Reviewer | Claude arch + OpenRouter code |
| Phase 3 | Backend Coder | Backend Architect | Code Reviewer | OpenRouter (CRUD) |
| Phase 4 | Frontend Architect → Frontend Coder | Documentation | Code Reviewer | Claude arch + OpenRouter code |
| Phase 5 | AI Services Agent | Backend Coder | Code Reviewer | Claude design + OpenRouter impl |
| Phase 6 | DevOps | Documentation | Code Reviewer | OpenRouter + Claude review |

---

## Part C — Orchestration System

### C1. Session Lifecycle

Every agent session follows this exact lifecycle:

```
1. SESSION START
   Agent reads:  CONTEXT.md → HANDOFF.md → STATUS.md → BUDGET.md
   Agent writes: STATUS.md (status: in_progress, agent: [name], brain: [brain])

2. WORK
   Agent executes assigned tasks
   Agent checks budget after each task (BUDGET.md)
   If budget exceeded → save checkpoint → write HANDOFF.md → stop

3. SESSION END
   Agent writes: HANDOFF.md (full context for next agent)
   Agent writes: STATUS.md (completed tasks, files changed, next tasks)
   Agent writes: BUDGET.md (tokens used this session)
   Agent writes: DECISIONS.md (if any architectural decisions were made)
```

### C2. Handoff Protocol

When an agent cannot continue (budget, task done, blocked), it writes HANDOFF.md:

```markdown
## Handoff — [timestamp]

### Who I Am
Agent: [name]
Brain used: [claude / openrouter]
Session: [session ID]

### What I Completed
- [list of completed tasks with file paths]

### Current State
- Files modified: [list]
- Tests passing: [yes/no/na]
- Migrations run: [yes/no/na]

### Why I'm Stopping
- [ ] Task completed — next phase starts
- [ ] Budget exceeded — continue on next brain
- [ ] Blocked — needs human input

### What the Next Agent Must Do
1. [specific next task]
2. [specific next task]

### Important Context
[anything the next agent must know to avoid mistakes]

### Do Not Touch
[files or decisions that must not be changed]
```

### C3. Budget Tracking

BUDGET.md tracks spend per session:

```markdown
## Budget Log

| Date | Session | Agent | Brain | Tokens In | Tokens Out | Cost USD | Running Total |
|------|---------|-------|-------|-----------|------------|----------|---------------|
| ...  | ...     | ...   | ...   | ...       | ...        | ...      | ...           |

## Limits
Claude: subscription (no per-token cost — preserve for HIGH/CRITICAL tasks)
OpenRouter: daily API budget (set in .env as OPENROUTER_DAILY_BUDGET)

## Current Session
Claude sessions used: [N] today
OpenRouter spent: $X.XX / daily limit
Manual tasks queued: [N] (see MANUAL_TASKS.md)
```

### C4. Context Continuity Rules

1. **CONTEXT.md is the single source of truth** — all agents read it at session start
2. **HANDOFF.md is overwritten** every session — only the latest handoff matters
3. **STATUS.md is append-only** — never delete past entries
4. **DECISIONS.md is append-only** — architectural decisions are permanent record
5. **No agent may change a decision** logged in DECISIONS.md without Claude + human approval

---

## Part D — Required Project MD Files

These files must exist in the repo root. Agents create and maintain them throughout the project.

### D1. File Registry

| File | Owner | Purpose | Updated by |
|------|-------|---------|-----------|
| `CLAUDE.md` | Documentation Agent | Master context file for all Claude agents. Project overview, tech stack, patterns, conventions | Documentation Agent after each phase |
| `AGENTS.md` | Orchestrator | Agent registry — who does what, current assignments, contact (API config) | Orchestrator |
| `CONTEXT.md` | Orchestrator | Shared project context — decisions, patterns, what's built, what's not | Orchestrator after each session |
| `HANDOFF.md` | Current Agent | Active handoff document — what was done, what's next | Any agent ending a session |
| `STATUS.md` | All Agents | Append-only project log — every session, every agent, every change | Every agent, every session |
| `BUDGET.md` | Orchestrator | Token/cost tracking per agent per session | Orchestrator after each session |
| `DECISIONS.md` | Backend Architect / AI Services Agent | Permanent log of architectural decisions with rationale | Any agent making arch decisions |
| `PROGRESS.md` | Orchestrator | High-level phase progress tracker — % complete per phase | Orchestrator at phase transitions |
| `REVIEW.md` | Code Reviewer | Code review findings per phase | Code Reviewer Agent |
| `BLOCKERS.md` | Any Agent | Current blockers needing human input | Any agent that hits a blocker |
| `API_REFERENCE.md` | Documentation Agent | Auto-generated API docs (all endpoints, request/response shapes) | Documentation Agent after Phase 3 |
| `ENV_REFERENCE.md` | DevOps Agent | Full environment variable reference with descriptions | DevOps Agent after Phase 1 |
| `SETUP.md` | Documentation Agent | Step-by-step local setup guide (dev + Docker) | Documentation Agent after Phase 6 |

### D2. CLAUDE.md Structure (what it must contain)

```markdown
# KDL Starter Kit — Claude Context

## Project Overview
[1-paragraph summary]

## Tech Stack
[concise table]

## Folder Structure
[annotated tree — same as plan section 5]

## Coding Conventions
- ES Modules (import/export) throughout backend
- TypeScript strict mode in frontend
- Zod for ALL validation (no manual checks)
- successResponse/errorResponse from utils/response.js for ALL API responses
- Every controller function wrapped in try/catch → next(error)
- Prisma client imported from config/database.js (singleton)
- All file uploads go through storage.service.js (never write to disk directly)

## Patterns
- Backend modules follow: routes → controller → service → Prisma
- Frontend pages use: useQuery for reads, useMutation for writes
- Auth state lives in auth.store.ts (Zustand)
- API calls go through lib/axios.ts (never raw fetch)

## What Is NOT Built Yet
[updated list after each phase]

## Common Mistakes to Avoid
[updated by Code Reviewer agent after each review]
```

---

## Part I — Execution Phases

### Phase Overview

| Phase | What Gets Built | Lead Agent | Brain | Human Approval |
|-------|----------------|-----------|-------|----------------|
| 1 | Root infra + docker-compose + all MD files | DevOps + Documentation | OpenRouter | Prasanna |
| 2 | Backend foundation (config, middleware, shared) | Backend Architect + Coder | Claude arch / OpenRouter code | Prasanna |
| 3 | Backend modules (Auth, Users, Settings, Media) | Backend Coder | OpenRouter | Prasanna |
| 4 | Frontend (auth pages, admin, all components) | Frontend Architect + Coder | Claude arch / OpenRouter code | Prasanna |
| 5 | AI Services (brain router, chat, embed, transcribe) | AI Services Agent | Claude | Prasanna |
| 6 | CI/CD, Dockerfiles, review, final docs | DevOps + Code Reviewer | OpenRouter + Claude | Prasanna |

### Phase Detail

**Phase 1 — Root Infrastructure**
- docker-compose.yml with all 9 services
- docker-compose.prod.yml
- .env.example (complete with all vars)
- .gitignore
- README.md
- infra/nginx/nginx.conf
- All `.agents/` MD files created with initial content
- docs/ folder with empty templates
- *Review:* Docker Compose boots cleanly

**Phase 2 — Backend Foundation**
- prisma/schema.prisma (4 base tables)
- prisma/seed.js
- backend/package.json (all deps)
- backend/src/config/ (all 5 config files)
- backend/src/middleware/ (all 5 middleware files)
- backend/src/shared/ (services, queues, workers, utils)
- backend/src/index.js (entry point, all routes registered)
- *Review:* Backend starts, DB connects, all services initialize

**Phase 3 — Backend Modules**
- modules/auth/ (register, login, logout, refresh, forgot/reset password)
- modules/users/ (CRUD + role management + status toggle)
- modules/settings/ (get all, get by key, update)
- modules/media/ (upload, list, delete via MinIO)
- prisma seed runs successfully
- *Review:* All API endpoints work end-to-end (Postman/curl test)

**Phase 4 — Frontend**
- frontend/package.json
- All config files (next.config.ts, tailwind.config.ts, tsconfig.json)
- src/lib/ (axios, queryClient, utils)
- src/stores/ (auth.store, ui.store)
- src/types/ (api.types, models.types)
- src/hooks/ (useAuth, usePagination, useDebounce)
- src/components/layout/ (AdminSidebar, TopBar, PageHeader)
- src/components/shared/ (DataTable, Modal, ConfirmDialog, Pagination, EmptyState, StatusBadge)
- src/app/layout.tsx + globals.css + Providers.tsx
- (auth) pages: login, register, forgot-password
- (admin) pages: dashboard, users, settings
- *Review:* Full auth flow works, admin CRUD works in browser

**Phase 5 — AI Services**
- ai-services/package.json
- ai-services/src/orchestrator/ (brain-router, budget-tracker, context-manager)
- ai-services/src/agents/ (base, research, content, task)
- ai-services/src/tools/ (rag.tool, search.tool, memory.tool)
- ai-services/src/knowledge/ (ingest, retrieve)
- ai-services/src/memory/ (short-term Redis, long-term ChromaDB)
- ai-services/src/workflows/ (base.workflow)
- ai-services/src/governance/ (audit-logger, compliance)
- ai-services/src/brains/ (claude.js, openrouter.js, mlx.js)
- ai-services/src/chains/rag-chain.js
- ai-services/src/controllers/ (chat, embed, transcribe) + routes + index.js
- *Review:* Chat endpoint responds, brain fallback works, ChromaDB embeds

**Phase 6 — DevOps & Final**
- backend/Dockerfile (multi-stage)
- frontend/Dockerfile (Next.js standalone)
- ai-services/Dockerfile
- .github/workflows/ci.yml (lint + typecheck)
- .github/workflows/deploy-staging.yml (build + SSH deploy)
- SETUP.md, API_REFERENCE.md, ENV_REFERENCE.md updated
- CLAUDE.md finalized
- *Review:* Full docker compose up works, CI passes, all docs accurate

---

## Part J — AI Services API Endpoints

| Method | Endpoint | Brain Used | Description |
|--------|----------|-----------|-------------|
| POST | /ai/chat | brain-router decides | Chat — routed to Claude or OpenRouter based on complexity |
| POST | /ai/chat?brain=claude | Claude forced | Force Claude for this request |
| POST | /ai/chat?brain=openrouter | OpenRouter forced | Force OpenRouter for this request |
| POST | /ai/embed | OpenRouter preferred | Index document into ChromaDB |
| POST | /ai/search | OpenRouter preferred | Semantic search in ChromaDB |
| POST | /ai/transcribe | Whisper API | Audio → text |
| GET | /ai/status | — | Returns current brain status, budget remaining |
| GET | /ai/budget | — | Returns full budget log |

---

## Part M — Claude Prompting Patterns for Agents

Based on production prompt engineering research, all KDL agents use a three-part formula when invoking Claude:

**Formula: Role Frame + Context + Structured Output Request**

```
"Act like a senior [role] building [context for a production system used by real users].
Do not guess. Think deeply before making changes.
Provide: [exact list of deliverables]."
```

### M1. Global Rules (go into CLAUDE.md)

These apply to every agent session:

1. **Role Frame First** — every prompt opens with `"Act like a senior [role]..."` — shifts Claude from code generator to engineer with stakes.
2. **No Guessing** — `"Do not guess. Think deeply before making changes."` — prevents hallucinated fixes in production code.
3. **Technical Lead Behavior** — before writing code, ask clarifying questions, challenge bad decisions, identify scaling risks, prioritize simplicity, think 5 years out.
4. **Elevated Stakes** — always include `"...used by real users / going into a real production app / prepare for massive traffic"` to anchor quality.

### M2. Per-Agent Role Frames (go into AGENTS.md)

| Agent | Role Frame (one sentence) |
|-------|--------------------------|
| Orchestrator | Act like a senior technical lead managing a real engineering team — ask clarifying questions, challenge bad decisions, identify scaling risks, and prioritize simplicity before writing a single line of code. |
| Backend Architect | Act like a senior systems architect designing infrastructure for a high-growth startup — design the scalable production-grade system architecture first, then define the minimal implementation that could realistically scale. |
| Backend Coder | Act like a senior full-stack engineer building a production-ready startup MVP from scratch — design the complete system architecture first, then build the most minimal but scalable version possible. |
| Frontend Architect | Act like a senior systems architect designing a component-driven UI platform for a modern startup — define the component architecture, state management strategy, and API contract before any implementation. |
| Frontend Coder | Act like a senior frontend engineer building production-grade UI systems for a modern startup — create reusable components, handle loading/empty/error/edge states, and build for accessibility and responsiveness. |
| Code Reviewer | Act like a senior engineer who just joined a massive unfamiliar codebase — reverse-engineer the architecture, identify bad decisions, duplicate logic, performance bottlenecks, scalability risks, and maintainability issues. Only upgrade code quality, never change product behavior. |
| DevOps Agent | Act like a senior performance engineer optimizing a production application used by millions — identify bottlenecks, inefficient logic, memory leaks, and infrastructure risks, then provide optimization strategies and scalability recommendations. |
| AI Services Agent | Act like a senior systems architect designing the AI infrastructure for a high-growth startup — define the orchestration layer, brain routing, agent communication protocol, and memory management strategy before any implementation. |
| Documentation Agent | Act like a senior engineer who just joined an unfamiliar codebase — reverse-engineer the architecture and data flow first, then write documentation that is accurate, production-grade, and useful to a developer joining on day one. |

### M3. Prompt Patterns Reference (source: power.ai)

| # | Pattern Title | When to Use |
|---|--------------|-------------|
| 1 | Full Startup Engineering Team | Starting a new feature or module from scratch |
| 2 | Audit Codebase Like Senior Engineer | Code review, pre-PR, or refactor planning |
| 3 | Production Debugging Monster | Investigating a live bug or unexpected behavior |
| 4 | Performance Optimization Engineer | Slow endpoints, memory issues, scaling prep |
| 5 | Rebuild Messy Code → Clean Architecture | Refactoring without changing behavior |
| 6 | Architect Entire Startup Backend | New service design, DB schema, API design |
| 7 | Senior Frontend Engineer | New screen, component library, UI patterns |
| 8 | AI Technical Lead Mode | Any decision point — architecture, trade-offs |
| 9 | Production Security Audit | Pre-launch security review, auth hardening |

---

## Part N — Loop Engineering Patterns

Loop Engineering is the shift from writing one-off prompts to designing **autonomous agent loops** — systems that define an end state, run, self-correct, and stop without constant manual input.

### The Core Recipe — Two Loops + One Rule

Every reliable agent workflow requires exactly these three things:

| # | What | Description |
|---|------|-------------|
| 1 | **Self-Correction Loop** | Within a session — agent acts, receives feedback from the environment, iterates until the goal is met |
| 2 | **Memory Loop** | Across sessions — agent writes what it learns into files so future sessions start with that knowledge, not from scratch |
| — | **Maker ≠ Grader** | The agent doing the work must never be the one evaluating it — grading must happen in an independent context window or via a separate sub-agent |

---

Every loop is built on five components, all of which already exist in the system:

| Loop Component | KDL Implementation |
|---------------|-------------------|
| **Context Management** | `CONTEXT.md` + `HANDOFF.md` — agents read these at session start so context survives across turns |
| **Feedback Quality** | Test results, linter output, API response codes, Code Reviewer findings — meaningful signals, not vague success/fail |
| **Verification Gates** | Phase review checkpoints + `REVIEW.md` — no phase closes without a Code Reviewer pass |
| **Termination Condition** | Explicit per-loop `donePredicate` — tests pass, quality score met, or human approved |
| **State Management** | `STATUS.md` (append-only log) + Redis short-term memory + ChromaDB long-term memory |

---

### N1. Self-Correction Loop (within session)

Use when there is a clear, testable definition of success. The loop runs until the success condition is met or a max-iteration limit is hit.

**Pattern:**

```
GOAL DEFINED (e.g., "all tests pass")
     │
     ▼
Run agent → get feedback signal (test results / lint / build output)
     │
     ├─ SUCCESS CONDITION MET → write HANDOFF.md → stop
     │
     └─ FAILURE → analyze feedback → patch → loop
     │
     └─ MAX ITERATIONS HIT → write BLOCKERS.md → escalate to human
```

**Loop contract:**

```js
// ai-services/src/workflows/deterministic.workflow.js
{
  goal: "string — what done looks like",
  maxIterations: 10,            // hard stop — never infinite
  feedbackFn: async () => {},   // returns { passed: bool, signal: string }
  donePredicate: (feedback) => feedback.passed === true,
  onSuccess: () => writeHandoff(),
  onMaxHit: () => writeBlocker("Loop hit max iterations — human review needed"),
}
```

**KDL use cases:**

| Loop | Trigger | Feedback Signal | Done When |
|------|---------|----------------|-----------|
| Bug-fix loop | Sentry error / failing CI | Test suite output | All tests pass |
| Schema migration loop | Schema change request | `prisma migrate dev` exit code | Zero migration errors |
| Lint-fix loop | PR opened | ESLint / TypeScript output | Zero errors |
| Seed verification loop | Phase 1 complete | DB query result | Seed data confirmed |

---

### N2. Memory Loop (across sessions)

The self-correction loop fixes things within a session. The memory loop prevents the agent from starting from scratch next session. When an agent fails, investigates, and finds a fix, it writes that knowledge into files — and reads it back at the next session start.

**The Memory Ladder — 5 Rungs:**

```
RUNG 1: FAIL
   Agent encounters an error or unexpected result
   → Do not discard — this is a learning signal

RUNG 2: INVESTIGATE
   Agent analyzes root cause — reads logs, diffs, test output
   → Identifies exactly what went wrong and why

RUNG 3: VERIFY
   Agent confirms the fix works — re-runs the failing test or check
   → Must pass before writing anything to memory

RUNG 4: DISTILL
   Agent writes a concise, reusable lesson to a memory file
   → One specific rule, not a narrative — e.g. "Never import Prisma client directly in middleware; always use config/database.js singleton"

RUNG 5: CONSULT
   Next session: agent reads memory files before starting work
   → Applies distilled lessons; doesn't repeat the same mistake
```

**Memory file format (in `.agents/` or `ai-services/src/memory/`):**

```markdown
## Lesson — [date]
**Trigger:** [what failure caused this]
**Root cause:** [what actually went wrong]
**Rule:** [one-sentence rule the next agent must follow]
**Verified:** [yes — test name / check that confirmed the fix]
```

**Where memory lives in the KDL system:**

```
.agents/
├── CONTEXT.md        ← project-level memory (decisions, patterns)
├── HANDOFF.md        ← session-level handoff
└── DECISIONS.md      ← architectural decisions (permanent)

ai-services/src/memory/
├── short-term.js     ← Redis — in-session context (already planned)
├── long-term.js      ← ChromaDB — semantic vector memory (already planned)
└── lessons.md        ← NEW: distilled lessons from the memory ladder
```

The new `lessons.md` file is written by any agent after completing the memory ladder. The Orchestrator reads it at every session start and injects relevant lessons into the agent's context before work begins.

---

### N3. Non-Deterministic Loops (Builder + Verifier)

Use when success is subjective — UI quality, copy tone, API design taste. An adversarial verifier (a second agent using a **different model**) judges the output against a rubric until the quality gate is met. This is where the Maker ≠ Grader rule is operationalized.

**Pattern:**

```
QUALITY RUBRIC DEFINED (e.g., "no AI slop, WCAG AA, shadcn/ui patterns")
     │
     ▼
Builder agent produces output
     │
     ▼
Verifier agent scores output against rubric → returns { score, failReasons[] }
     │
     ├─ SCORE ≥ THRESHOLD → accept → proceed
     │
     └─ SCORE < THRESHOLD → failReasons fed back to Builder → loop
     │
     └─ MAX ITERATIONS HIT → surface best-attempt to human for decision
```

**Loop contract:**

```js
// ai-services/src/workflows/non-deterministic.workflow.js
{
  rubric: string[],             // explicit quality criteria
  threshold: 0.85,             // score required to exit (0–1)
  maxIterations: 5,
  builderBrain: "openrouter",  // builds the output
  verifierBrain: "claude",     // judges it — different model = less bias
  onSuccess: (output) => acceptAndLog(output),
  onMaxHit: (best) => surfaceToHuman(best, "Best attempt — needs human call"),
}
```

**KDL use cases:**

| Loop | Builder Brain | Verifier Brain | Rubric |
|------|-------------|---------------|--------|
| UI component review | OpenRouter | Claude | shadcn/ui patterns, accessible, no hardcoded colors, responsive |
| API design review | OpenRouter | Claude | RESTful, consistent naming, correct status codes, Zod-validated |
| Documentation review | OpenRouter | Claude | Accurate, no hallucinated APIs, useful to a day-1 developer |
| Content generation | OpenRouter | Claude | No AI slop, on-brand, specific not vague |

---

### N4. The Maker ≠ Grader Rule

This is a non-negotiable architectural principle, not just a style preference.

**Why it exists:** The same model, in the same context window, grading its own output will almost always find it acceptable. It lacks the independent perspective needed to catch its own blind spots and hallucinations.

**How it is enforced in KDL:**

1. **In non-deterministic loops:** Builder and Verifier always run in separate context windows with different models (OpenRouter builds, Claude grades).
2. **In phase reviews:** Code Reviewer Agent (Agent 8) runs independently — it does not share a session with the agent that wrote the code.
3. **In memory validation (Rung 3 of the ladder):** The agent that distills a lesson must verify via an objective check (test pass / exit code), not self-assessment.
4. **In goal loops:** A secondary lightweight model (e.g., Claude Haiku) acts as checker after every turn — the main agent cannot mark itself done.

---

### N5. Loop Files in ai-services/

```
ai-services/src/workflows/
├── base.workflow.js               ← already planned (extended by both below)
├── deterministic.workflow.js      ← NEW: self-correction loop (goal + feedback + max-iter)
└── non-deterministic.workflow.js  ← NEW: builder + verifier + rubric pattern

ai-services/src/memory/
├── short-term.js                  ← already planned (Redis)
├── long-term.js                   ← already planned (ChromaDB)
└── lessons.md                     ← NEW: distilled lessons from memory ladder
```

All workflow files extend `base.workflow.js` and use the brain-router — so they automatically respect brain budgets and fall back through the tier system.

---

### N6. Loop Logging

Every loop iteration is written to `STATUS.md` via `governance/audit-logger.js`:

```
[2026-06-16 14:22] LOOP self-correction/bug-fix | iter 1/10 | 3 tests failed | patching...
[2026-06-16 14:23] LOOP self-correction/bug-fix | iter 2/10 | 0 tests failed | DONE
[2026-06-16 14:25] MEMORY LADDER | rung 4 distill | lesson written to lessons.md
[2026-06-16 14:26] MEMORY LADDER | rung 5 consult | 2 lessons loaded for next session
```

---

### N7. Loop Termination Rules (Non-Negotiable)

1. **Every loop has a `maxIterations` hard limit** — no infinite loops under any circumstances.
2. **On max hit, always write `BLOCKERS.md`** — never silently fail.
3. **Deterministic loops require a real signal** — not a string match on Claude's output. Use exit codes, test runners, linters.
4. **Maker ≠ Grader** — the agent that builds must never be the agent that grades. Always a separate context window or model.
5. **Human approval gates still apply** — loops run within a phase, they do not skip the phase approval step.
6. **Loops are the most expensive pattern** — token usage is multiplicative (every iteration = a full model call). Set `maxIterations` conservatively. Default: 10 for self-correction, 5 for builder/verifier. Log costs to `BUDGET.md` per loop run.

> **The new leverage:** Your ability to write precise finish lines, rubrics, and maintain memory discipline is now more valuable than your prompting skills. A well-written `donePredicate` and a maintained `lessons.md` compound across every future session.

---

## Part O — Official Claude Code Plugins for Development Agents

These are the official Anthropic-built plugins from the `claude-plugins-official` marketplace. They are tools the KDL agents install and use **during development** — not features of the finished product. Each plugin maps to one or more agents in the registry (Part B).

Install command for any agent:
```
/plugin install [plugin-name]@claude-plugins-official
```

---

### The 5 Essential Plugins (Most Widely Used)

#### 1. feature-dev
**What it does:** 7-phase structured feature development workflow — `/feature-dev` deploys three specialized sub-agents: `code-explorer` (traces execution paths, maps architecture), `code-architect` (proposes implementation approaches with trade-offs), `code-reviewer` (catches bugs and security issues with confidence-scored findings).

**KDL Agents:** Backend Coder (Agent 3), Frontend Coder (Agent 5)
**When to use:** Starting any new module or feature — Phases 2, 3, 4
**Note:** The comment on the original reel flagged this as "already replaced with superpowers" — meaning the `/feature-dev` command workflow can be superseded by the loop engineering patterns in Part N once agents are mature. Use it in early phases; graduate to custom loops later.

---

#### 2. code-review
**What it does:** Automated PR review using 5 parallel Sonnet sub-agents — covers CLAUDE.md compliance, bug detection, historical context, PR history, and inline code comments. Confidence-based scoring filters false positives.

**KDL Agents:** Code Reviewer (Agent 8)
**When to use:** End of every phase before human approval
**How it enhances Agent 8:** Agent 8's role (Part B) is to review all code before a phase closes. This plugin gives it 5 simultaneous review lenses instead of one sequential pass — directly improving review quality without extra cost per phase.

---

#### 3. commit-commands
**What it does:** Git workflow automation — `/commit`, `/commit-push-pr`, `/clean_gone`. Standardizes commit messages, pushes, and PR creation in one command.

**KDL Agents:** All code-writing agents (Agent 3, 5, 6, 7)
**When to use:** After any completed task before writing HANDOFF.md
**Integration:** Pairs with the session lifecycle in Part C — agents run `/commit` or `/commit-push-pr` as the final step of the work phase, then write STATUS.md and HANDOFF.md.

---

#### 4. security-guidance
**What it does:** PreToolUse hook that fires automatically before file edits. Monitors 9 security patterns: command injection, XSS, eval usage, dangerous HTML rendering, pickle deserialization, os.system calls, and more. Warns the agent before a vulnerable pattern is written, not after.

**KDL Agents:** Backend Architect (Agent 2), Backend Coder (Agent 3), Code Reviewer (Agent 8)
**When to use:** Always-on during Phases 2 and 3 (backend work)
**Note:** This is a hook, not a skill — it runs on every file edit automatically once installed. Install it for backend agents; disable for documentation-only sessions to avoid unnecessary token cost (Part N Rule 6).

---

#### 5. frontend-design
**What it does:** Auto-invoked skill for all frontend work. Guides agents toward distinctive, production-grade UI — avoiding generic AI aesthetics. Covers bold design choices, typography, animation, visual hierarchy, and component patterns.

**KDL Agents:** Frontend Architect (Agent 4), Frontend Coder (Agent 5)
**When to use:** All of Phase 4
**Integration:** This plugin's output is a direct input to the non-deterministic loop in Part N — Frontend Coder builds with `frontend-design` guidance, Claude Verifier scores against the same rubric.

---

### Additional Plugins Worth Knowing

| Plugin | What It Does | KDL Agent | When |
|--------|-------------|-----------|------|
| `pr-review-toolkit` | 6 specialized review agents (comments, tests, error handling, type design, code quality, simplification) | Agent 8 | Large PRs at phase transitions |
| `hookify` | Creates custom hooks from conversation patterns — prevents the agent from repeating a mistake it was corrected on | Agent 1 (Orchestrator) | After any correction from human review |
| `plugin-dev` | 8-phase guided workflow for building KDL-specific plugins with validation agents | Agent 1 | If KDL needs a custom plugin in Phase 5+ |
| `ralph-wiggum` | `/ralph-loop` — agent iterates on the same task autonomously until done. `/cancel-ralph` stops it. Intercepts exit attempts via a Stop hook. | Agent 3, 5 | **This is the self-correction loop from Part N, implemented as a plugin.** Use for deterministic loops where the feedback signal is clear. |

---

### Plugin Stack Per Agent

| Agent | Must-Have Plugins | Always-On Hooks |
|-------|------------------|----------------|
| Agent 1 — Orchestrator | `hookify`, `commit-commands` | none |
| Agent 2 — Backend Architect | `security-guidance` | `security-guidance` PreToolUse |
| Agent 3 — Backend Coder | `feature-dev`, `commit-commands`, `security-guidance` | `security-guidance` PreToolUse |
| Agent 4 — Frontend Architect | `frontend-design` | none |
| Agent 5 — Frontend Coder | `feature-dev`, `commit-commands`, `frontend-design` | none |
| Agent 6 — DevOps | `commit-commands` | none |
| Agent 7 — AI Services | `commit-commands`, `security-guidance` | `security-guidance` PreToolUse |
| Agent 8 — Code Reviewer | `code-review`, `pr-review-toolkit` | none |
| Agent 9 — Documentation | none | none |

> **Install once, works globally.** Plugins live in `~/.claude/plugins/` and are available across all project sessions once installed. Hooks that are always-on add token cost to every session they are active — disable them for documentation-only sessions.

---

---

## Part P — KDL Product Architecture & Positioning

This part covers what the KDL Starter Kit **builds and delivers as a product** — distinct from how it is built (Parts A–O cover the dev agents and tooling). The source for this section is the Month 1 Work Report (KDL_WorkReport, May 2026).

---

### P1. Core Product Modules

The KDL OS Kit ships with **6 core modules** (Spec Part 1). These are the foundational capabilities available to every SaaS built on the kit. They are delivered as NestJS modules on the backend and Next.js App Router pages on the frontend.

| # | Module | What It Does |
|---|--------|-------------|
| 1 | **Auth** | Complete authentication system — JWT, refresh tokens, OAuth, session management. Connects to the `users` and `refresh_tokens` base tables. |
| 2 | **Data Model Builder** | Visual/configuration-driven tool for defining custom data models without writing migrations by hand. |
| 3 | **Dynamic API** | Generates CRUD API endpoints automatically from the data models defined in module 2. |
| 4 | **Admin Panel** | Full-featured admin interface — user management, settings, media, audit logs. |
| 5 | **Form Builder** | Drag-and-drop form construction with validation rules and submission handling. |
| 6 | **Project Management** | Lightweight project/task tracking layer built into the kit for teams using the platform. |

> **Status (as of May 2026):** Part 1 spec (all 6 modules) drafted and sent for review. Part 2 (Plugin Layer) not yet started — paused while the plugin architecture decision was finalized.

---

### P2. Product Agent Catalog

Beyond the 9 development agents (Part B) that *build* the kit, the kit itself ships with a catalog of **105 specialized product agents** — autonomous tools that end-users of any SaaS built on KDL can activate. These agents are organized into 9 categories and each has a defined brain assignment based on task complexity and cost.

**Brain distribution across 105 product agents:**

| Brain | Model | % of Agents | Rationale |
|-------|-------|-------------|-----------|
| Main | Claude (Anthropic) | 74% | Most agents require high reasoning quality — architecture-grade tasks |
| Budget | Qwen (via OpenRouter) | 24% | Routine structured tasks where cost savings outweigh quality difference |
| Local | Sarvam (India-specific) | 2% | Locale-specific agents requiring Indian language or regulatory context |

> **Note:** Sarvam is an Indian AI model with strong support for Indic languages and compliance-aware outputs — relevant for the India-first features in P3.

**Catalog reference:** The full 105-agent catalog (ID, role, skills, brain assignment, tools, memory, I/O, dependencies, lifecycle, MVP priority) lives in the `KDL_Agent_Catalog` Excel file. Awaiting Prasanna's feedback on prioritization — specifically which agents are truly MVP vs which can be deferred to later phases.

**Visual reference:** An interactive HTML site mapping all 105 agents across 9 categories is live at [kdloskitagentarchitecturepreview.netlify.app](https://kdloskitagentarchitecturepreview.netlify.app/).

---

### P3. India-First Strategic Features

Three differentiated features were proposed to position KDL OS Kit distinctly in the Indian market. These go beyond what any generic international SaaS boilerplate provides. Status: sent on WhatsApp, awaiting direction from Prasanna.

#### Feature 1 — GST Invoicing Primitives
Built-in GST-compliant invoicing support (GSTIN validation, HSN/SAC codes, tax computation, e-invoice API integration). Addresses a gap no existing OSS tool covers for Indian businesses.

#### Feature 2 — Aadhaar / DigiLocker Plugin
Identity verification and document retrieval using Aadhaar-based KYC and DigiLocker APIs. Enables compliant onboarding flows for Indian users without third-party identity vendor dependency.

#### Feature 3 — Kalam Mode
A civic impact endpoint — a mode that any SaaS built on KDL can activate to expose public-interest features or data at a reduced or zero cost tier. Named after Dr. A.P.J. Abdul Kalam. Positions KDL not just as a commercial tool but as infrastructure for civic technology in India.

> **Decision needed:** Whether these become core features of the KDL product roadmap or remain as optional plugins/ideas. This choice affects how Part 2 of the spec (Plugin Layer) is scoped.

---

### P4. Open Positioning Decision

The KDL OS Kit has one unresolved strategic question that affects both the GitHub setup and the contributor onboarding work:

**Is KDL OS Kit a public OSS product — or internal Kalam Dream Labs scaffolding?**

| Option | Implication |
|--------|------------|
| **Public OSS** | Public GitHub repo, Apache 2.0 license, contributor community, CONTRIBUTING.md, public roadmap |
| **Internal scaffolding** | Private repo, used only for KDL client projects, no external contributors |

> **Status:** GitHub repo creation is on hold pending this decision. Once confirmed, the repo can be stood up with full structure (README, CONTRIBUTING, LICENSE, monorepo skeleton) in 1–2 days, and contributor onboarding can follow within 3–5 days.

**What's needed to close this:** A 30-minute alignment call or WhatsApp decision on positioning direction.

---

*See also: KDL_DevEnvironment.md — Development Environment (tech stack, services, schema, folder structure, environment variables)*

*Kalam Dream Labs Pvt Ltd — Internal Reference Document v1.1*
