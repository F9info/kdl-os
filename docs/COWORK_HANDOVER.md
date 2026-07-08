# KDL Project — Cowork Setup Handover
# Give this file to Claude on the Paperclip system. It contains everything needed.

**From:** Claude (Cowork, Prasanna's primary system) — 2026-07-08
**Owner:** Prasanna (web@f9tech.com), Kalam Dream Labs Pvt Ltd
**Repo:** https://github.com/F9info/kdl-os — clone/link the local working copy that Paperclip AI agents use on this system.

---

## Your role on this system

1. **Spec writer:** when Prasanna wants a new module, write an implementation-ready spec at `.agents/<MODULE>_ARCH.md` following the existing format (read `.agents/MEDIA_DAM_ARCH.md` as the template): header with Status/Mode, **Read Scope table** (token rule — agents read only their step's sections), schema, endpoints with permissions, step table with exit-code gates, Known Risks. Commit specs immediately — uncommitted specs have been lost twice.
2. **Independent verifier:** when Prasanna says a module is done, verify — re-run gate commands (vitest, tsc, prisma validate), spawn conformance review vs the spec, record verdict at the TOP of `.agents/REVIEW.md`. You are not a build agent; never edit module code directly.
3. **Tracker keeper:** maintain the live artifact (below) — update statuses when modules complete.

Non-negotiables (full versions in repo `CLAUDE.md` — read it first): Maker ≠ Grader; Auto-Approval Protocol (gates auto-approve on exit codes + reviewer PASS + Gate Verifier re-run; escalate to Prasanna via BLOCKERS.md only on CRITICAL/2-failed-loops/destructive/budget/auth-fail); Token Efficiency Protocol (scoped reads, one step per session, rotated HANDOFF/STATUS); never compare KDL to consumer software brands; Prasanna prefers maximum conciseness.

How Prasanna assigns work to Paperclip AI: one task to the CEO orchestrator agent — short title + description pointing at the spec file. Prompts below are copy-paste ready.

---

## Module Registry (truth as of 2026-07-08, commit 1997c15)

| # | Module | Spec | Status |
|---|--------|------|--------|
| 1 | Foundation (backend/frontend/ai-services/infra, 6 phases) | KDL_RepoDocs.md (archive) | ✅ DONE + verified |
| 2 | User Management (RBAC: users/roles/permissions/overrides/activity) | .agents/USER_MANAGEMENT_ARCH.md | ✅ DONE + verified |
| 3 | Module Plugin System (install/enable/disable, scaffold generator) | .agents/MODULE_PLUGIN_ARCH.md | ✅ DONE + verified |
| 4 | M6 fix (permission format colon end-to-end) | inline task | ✅ DONE (0 dot-format leftovers) |
| 5 | Media Pro (folders, variants, trash, usage) | .agents/MEDIA_PRO_ARCH.md | ✅ DONE |
| 6 | Integrations (Email/SMS/WhatsApp transport, encrypted credentials, logs) | .agents/INTEGRATIONS_ARCH.md | ✅ DONE (KDL-89..97, mailhog E2E) |
| 7 | Notifications (in-app + SSE + templates + preferences + broadcast) | .agents/NOTIFICATIONS_ARCH.md | ✅ DONE (KDL-108..115, E2E 13/13) |
| 8 | **Media DAM** (enterprise: search/share/versioning/processing/AI, 4 phases) | .agents/MEDIA_DAM_ARCH.md | 🔲 SPEC READY — not assigned |
| 9 | Data Model Builder | no spec yet | ⚪ PLANNED |
| 10 | Dynamic API | no spec yet | ⚪ PLANNED |
| 11 | Form Builder | no spec yet | ⚪ PLANNED |
| 12 | Project Management | no spec yet | ⚪ PLANNED |
| 13 | GST Invoicing (India-first) | no spec yet | ⚪ PLANNED |
| 14 | Aadhaar/DigiLocker plugin (India-first) | no spec yet | ⚪ PLANNED |

Open findings: `.agents/REVIEW.md` (notifications review logged 10 MEDIUM + 11 LOW — non-blocking; verify-on-request).

---

## Pending assignment prompt (Module 8)

**Title:** `Complete Module: Media DAM (Enterprise Media Management)`

**Description:**
```
Read .agents/MEDIA_DAM_ARCH.md — obey its Read Scope table (read only
the current step's sections, never the whole file). Work phases
strictly in order A → B → C → D; within each phase, steps in order.
A phase's final gate (review PASS + E2E exit 0) must be approved in
STATUS.md before the next phase starts. Builds ON TOP of the existing
media module — never rebuild anything in the "Already built" section.
24/7 unattended per Auto-Approval Protocol; escalate via BLOCKERS.md
only on protocol conditions. All AI calls budget-capped via
ai-services; AI features hide when no provider configured.
```

Modules 9–14 need specs written first (your job, on request).

---

## Live Artifact — build this immediately after setup

Create a persisted artifact (id: `kdl-module-tracker`) — a module status board Prasanna opens anytime:

- **Data:** embed the Module Registry table above as the initial dataset (module name, spec file path, status, task prompt where applicable).
- **Layout:** summary header (X done / Y in progress / Z spec-ready / N planned) + card or table per module: name, status badge (color-coded: green DONE, blue IN PROGRESS, amber SPEC READY, gray PLANNED), spec filename, last-update note.
- **Interactions:** status editable via dropdown (persist edits in localStorage so they survive reloads); "Copy assignment prompt" button per module that has one (clipboard); free-text note field per module (localStorage).
- **Maintenance:** when Prasanna reports progress ("integrations done"), update the artifact source itself (not just localStorage) so the baseline stays true.
- No external data calls needed — this is a curated board, not a live repo reader. State clearly on the board: "Statuses updated manually — last sync 2026-07-08".

---

## First-session checklist for you (the new Claude)

1. Request folder access to the kdl-os working copy on this system.
2. Read repo `CLAUDE.md` in full (once — it's the always-read context for everything).
3. Verify `git log --oneline -5` matches or exceeds commit `1997c15` (if older, `git pull`).
4. Build the `kdl-module-tracker` artifact from the registry above.
5. Save a memory: your role (spec writer + verifier + tracker keeper), repo path, and this file's location.
