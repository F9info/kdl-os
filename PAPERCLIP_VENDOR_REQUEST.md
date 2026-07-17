# Paperclip AI — Platform Feature Request (from KDL OS / Kalam Dream Labs)

**From:** Prasanna, Kalam Dream Labs (company "KDL OS", control plane 127.0.0.1:3100)
**Date:** 2026-07-16
**Context:** We ran an evidence-based efficiency audit of our KDL OS build company. We've already applied every config/context fix on our side (model right-sizing, thinking effort, context trimming, a comment-discipline instruction). The four items below **can only be fixed at the Paperclip platform level** and are, by our measurements, the largest remaining sources of wasted tokens/runs. Each is stated with the evidence that motivates it.

---

## Summary of evidence (measured on our company)

- **CEO agent cumulative tokens: 2.0M input / 3.5M output / 834.7M cached** — a ~417:1 cache-read : input ratio, i.e. an enormous context re-sent every run.
- Many runs are **non-productive**: hard-fails on the org spend ceiling (several after burning 70k–380k tokens first), control-plane cancels, and sub-1k-token "no-change" heartbeat polls.
- The **priciest runs (70k–111k tokens) open with repo re-discovery** ("Check repo location / layout"); some found the leased clone empty ("no repo, no .git") and had to redo work.
- **Run transcripts are not persisted** ("No persisted transcript for this run"), so we cannot measure per-run duration, per-stage timing, or the idle/reasoning/tool split.

---

## Request 1 — Warm / reused per-agent workspace (stop fresh clone per run)

**Problem:** Each run appears to acquire a fresh environment lease / clone and re-discover the repository. This is the dominant cost of our most expensive runs, and we've seen clones come up empty, forcing re-clone and redo of already-committed work.

**Ask:**
- Option to **pin a durable, reused workspace per agent** (or a warm shared checkout) instead of provisioning a clone per run.
- Guarantee the lease reuses the same checkout so prior commits are present on wake.
- Surface a "workspace reused vs re-cloned" signal per run.

**Expected impact:** Removes the 70k–111k-token orientation openers; eliminates empty-clone redo.

---

## Request 2 — Run observability / instrumentation

**Problem:** We cannot measure where time/tokens actually go because transcripts aren't persisted and the runs table shows only relative timestamps + a single token figure.

**Ask (per run):**
- **Persist the transcript** with per-tool-call timestamps.
- **Per-run token breakdown**: input / output / cache-read / cache-write (not just a cumulative per-agent total).
- **Start/end wall-clock** on the runs table.
- **Outcome class tag**: productive / no-op poll / cancelled / spend-fail — so a "waste ratio" becomes a first-class metric.

**Expected impact:** Lets us (and you) verify optimizations with real numbers instead of inference.

---

## Request 3 — Durable task checkpoint / resume

**Problem:** Memory is effectively prose journals the agent re-reads and re-interprets each run. When a run is interrupted (spend limit, cancel) mid-task, the next run reconstructs context from scratch — we've observed work restarting from step A instead of continuing at step E.

**Ask:**
- A **machine-readable per-task checkpoint** (sub-steps + last-completed marker) that a resuming run loads directly, rather than inferring progress from comments/journals.
- Resume-from-checkpoint semantics on wake after interruption.

**Expected impact:** Interrupted tasks resume cheaply instead of redoing completed sub-steps.

---

## Request 4 — Event-driven coordination + wake de-duplication

**Problem:** Even with heartbeat-on-interval off, the orchestrator generates observation-only runs, and its own comments can re-trigger wakes ("Echo wake of my own comment"). We've added a comment-discipline instruction as a stopgap, but the platform is the right place to fix this.

**Ask:**
- Drive wakes from **task-state-change events** (assigned, review-ready, blocked-cleared) rather than blind polling.
- **Suppress wakes that echo an agent's own most recent comment.**
- **De-duplicate wakes** for a task that already has an active run on another agent.

**Expected impact:** Sharply fewer no-op runs; run-count per shipped change drops.

---

## Priority

1 (warm workspace) and 2 (observability) first — 1 removes the biggest measured token sink; 2 lets everyone measure the rest. 3 and 4 follow.

We're happy to share the full audit report and run-log evidence on request.
