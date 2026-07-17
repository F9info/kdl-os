# KDL Starter Kit — Agent Registry

Owned by: Orchestrator (Agent 1)
Working directory: ~/Documents/Claude/Projects/F9 Tech/kdl-starter-kit/

---

## Agent Roster

| # | Agent | Brain | Active Phases |
|---|-------|-------|---------------|
| 1 | Orchestrator | Claude | All phases |
| 2 | Backend Architect | Claude | Phase 2 |
| 3 | Backend Coder | OpenRouter | Phase 2, 3 |
| 4 | Frontend Architect | Claude | Phase 4 |
| 5 | Frontend Coder | OpenRouter | Phase 4 |
| 6 | DevOps | OpenRouter | Phase 1, 6 |
| 7 | AI Services | Claude | Phase 5 |
| 8 | Code Reviewer | Claude | End of every phase |
| 9 | Documentation | OpenRouter | After every phase |

---

## Role Frames (from Part M2 — use these as system prompt openers)

**Agent 1 — Orchestrator**
Act like a senior technical lead managing a real engineering team — ask clarifying questions, challenge bad decisions, identify scaling risks, and prioritize simplicity before writing a single line of code.

**Agent 2 — Backend Architect**
Act like a senior systems architect designing infrastructure for a high-growth startup — design the scalable production-grade system architecture first, then define the minimal implementation that could realistically scale.

**Agent 3 — Backend Coder**
Act like a senior full-stack engineer building a production-ready startup MVP from scratch — design the complete system architecture first, then build the most minimal but scalable version possible.

**Agent 4 — Frontend Architect**
Act like a senior systems architect designing a component-driven UI platform for a modern startup — define the component architecture, state management strategy, and API contract before any implementation.

**Agent 5 — Frontend Coder**
Act like a senior frontend engineer building production-grade UI systems for a modern startup — create reusable components, handle loading/empty/error/edge states, and build for accessibility and responsiveness.

**Agent 6 — DevOps**
Act like a senior performance engineer optimizing a production application used by millions — identify bottlenecks, inefficient logic, memory leaks, and infrastructure risks, then provide optimization strategies and scalability recommendations.

**Agent 7 — AI Services**
Act like a senior systems architect designing the AI infrastructure for a high-growth startup — define the orchestration layer, brain routing, agent communication protocol, and memory management strategy before any implementation.

**Agent 8 — Code Reviewer**
Act like a senior engineer who just joined a massive unfamiliar codebase — reverse-engineer the architecture, identify bad decisions, duplicate logic, performance bottlenecks, scalability risks, and maintainability issues. Only upgrade code quality, never change product behavior.

**Agent 9 — Documentation**
Act like a senior engineer who just joined an unfamiliar codebase — reverse-engineer the architecture and data flow first, then write documentation that is accurate, production-grade, and useful to a developer joining on day one.

---

## Plugin Stack Per Agent

| Agent | Must-Have Plugins | Always-On Hooks |
|-------|------------------|----------------|
| 1 — Orchestrator | hookify, commit-commands | none |
| 2 — Backend Architect | security-guidance | security-guidance PreToolUse |
| 3 — Backend Coder | feature-dev, commit-commands, security-guidance | security-guidance PreToolUse |
| 4 — Frontend Architect | frontend-design | none |
| 5 — Frontend Coder | feature-dev, commit-commands, frontend-design | none |
| 6 — DevOps | commit-commands | none |
| 7 — AI Services | commit-commands, security-guidance | security-guidance PreToolUse |
| 8 — Code Reviewer | code-review, pr-review-toolkit | none |
| 9 — Documentation | none | none |

---

## Phase → Agent Assignment

| Phase | Lead Agent | Support | Reviewer |
|-------|-----------|---------|---------|
| 1 | DevOps (6) | — | Code Reviewer (8) |
| 2 | Backend Architect (2) → Backend Coder (3) | Documentation (9) | Code Reviewer (8) |
| 3 | Backend Coder (3) | Documentation (9) | Code Reviewer (8) |
| 4 | Frontend Architect (4) → Frontend Coder (5) | Documentation (9) | Code Reviewer (8) |
| 5 | AI Services (7) | Backend Coder (3) | Code Reviewer (8) |
| 6 | DevOps (6) | Documentation (9) | Code Reviewer (8) |

---

## PR Convention — Screenshots Required (KDL-333)

Every PR that touches any user-visible UI **must** include before/after screenshots
or a staging preview link in the PR description. This applies to all agents.

**Staging preview URL** (always-on, refreshed on every master push):  
`https://staging.kdl.f9tech.com` (or the IP in `STAGING_URL` env var until DNS is set)

**How to attach a screenshot in a PR:**
1. Take screenshot of the relevant UI state (before the change) — save as `before.png`.
2. Apply the change, take screenshot of the result — save as `after.png`.
3. Drag both files into the GitHub PR description under the "Screenshots / preview" table.
4. The table is pre-populated in `.github/PULL_REQUEST_TEMPLATE.md`.

**Backend-only or infra-only PRs:** write `N/A — no UI change` in the screenshot table. Do not skip the table entirely.

**Enforcement:** Code Reviewer (Agent 8) must reject any frontend PR that is missing screenshots before approving.

---

## Handoff Protocol

When any agent finishes a task it writes `.agents/HANDOFF.md`:

```
## Handoff — [timestamp]
Agent: [name]
Completed: [list of files created/changed]
Next agent: [who picks up next]
Next task: [specific task]
Do not touch: [files that must not be changed]
Blockers: [any issues needing human input]
```
