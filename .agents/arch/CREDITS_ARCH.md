# CREDITS_ARCH — per-project internal metering ledger (D3)

**Issue:** KDL-476 · **Author:** Backend Architect · **Status:** SPEC (no implementation in this issue)
**Board decision:** `.agents/PRODUCT_MODES_ARCH.md` §6 **D3** — credits are **internal metering in v1**,
designed to become commerce. No payment provider, no invoicing, no tax, no dunning. D2 makes every
generation carry a real per-call cost, so metering ships before any AI-driven module does.

**Dependencies**
- **`projects` spec (KDL-474, `.agents/arch/PROJECTS_ARCH.md`)** — not merged at time of writing.
  Credits assumes the tenancy boundary it defines: a `Project` model, `String @id @default(cuid())`,
  `@@map("projects")`. Only the two relation lines in the Prisma schema below touch that seam; if the
  projects spec changes the model name or id type, this doc changes in exactly those lines. Build
  Phase C1 (below) is **blocked on projects PR-1** (the migration that creates `projects`).
- **`brand-kit` AI spec (KDL-475, referenced in this issue's text as KDL-451; target doc
  `.agents/arch/BRAND_KIT_AI_ARCH.md`)** — in progress by the AI Services agent, not merged. §5
  *proposes* the metering hook shape for that spec to adopt; the shape is coordinated via this doc and
  the KDL-476 PR review, and any divergence must be resolved in whichever PR merges second.

**Stack constraints (LOCKED):** Prisma singleton from `backend/src/config/database.js`; Zod for all
request validation; `successResponse`/`errorResponse` from `backend/src/shared/utils/response.js`;
module layout and `module.json` manifest per the `integrations` module; multi-file Prisma schema
(`backend/prisma/schema/credits.prisma`); snake_case columns + `@@map` snake_case tables + cuid ids,
matching every existing schema file. PRs follow `docs/MERGE_DISCIPLINE.md` (< 400 non-generated lines,
one concern, rebase-before-CI).

---

## 0. Units and terminology

- **Credit** — the internal metering unit shown to operators. 1 credit's USD meaning is a config
  value, not a schema property.
- **µc (micro-credit)** — the storage unit: **1 credit = 1,000,000 µc**. All amounts are
  `BigInt` µc. Rationale: per-call AI costs are tiny fractions (AI_SERVICES_ARCH meters
  ~$0.000002/token), floats are banned for money-like values, and `BigInt` gives exact integer
  arithmetic in both Postgres (`bigint`) and Node (native `BigInt`) with no `Prisma.Decimal`
  round-trip hazards in the service layer. Column suffix `_mc` marks the unit.
- **USD→µc conversion** happens only at the metering edge (§5), via `AppSetting`
  `credits.usd_per_credit` (string decimal, e.g. `"0.01"`). `usdToMc(usd)` rounds **half-up to the
  nearest µc, minimum 1 µc for any non-zero cost** so real spend never meters to zero.
- **Available balance** — what a new reservation may draw on: the materialised
  `credit_balances.balance_mc`. Open holds have *already been subtracted* from it (see §1 invariant).

---

## 1. Data model

Three tables. The **ledger** is the append-only source of truth of *facts*. The **balance** is a
materialised aggregate for the hot path. **Holds** are mutable in-flight state (a state machine, not
part of the ledger — every hold *transition* is recorded as a ledger fact).

### 1.1 Prisma schema — `backend/prisma/schema/credits.prisma`

```prisma
enum CreditEntryType {
  GRANT    // + operator/system mint (later: purchase)
  RESERVE  // - hold placed before a generation
  SETTLE   // + (held - actual) refund of unused hold; negative if actual > held
  RELEASE  // + hold returned (generation failed / caller aborted)
  EXPIRE   // + hold returned by reap-on-touch after expires_at
  ADJUST   // ± operator correction or late settlement; reason mandatory
}

enum CreditHoldStatus {
  PENDING
  SETTLED
  RELEASED
  EXPIRED
}

model CreditBalance {
  id         String   @id @default(cuid())
  project_id String   @unique
  balance_mc BigInt   @default(0) // available µc; invariant: == Σ credit_ledger_entries.amount_mc
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  project Project @relation(fields: [project_id], references: [id], onDelete: Restrict)

  @@map("credit_balances")
}

model CreditHold {
  id              String           @id @default(cuid())
  project_id      String
  amount_mc       BigInt
  status          CreditHoldStatus @default(PENDING)
  source          String // caller tag, e.g. "brand_kit.typography"
  idempotency_key String           @unique
  expires_at      DateTime
  resolved_at     DateTime?
  actor_id        String? // user who triggered the generation
  created_at      DateTime         @default(now())
  updated_at      DateTime         @updatedAt

  project Project              @relation(fields: [project_id], references: [id], onDelete: Restrict)
  entries CreditLedgerEntry[]

  @@index([project_id, status])
  @@index([status, expires_at])
  @@map("credit_holds")
}

model CreditLedgerEntry {
  id               String          @id @default(cuid())
  project_id       String
  entry_type       CreditEntryType
  amount_mc        BigInt // signed effect on available balance
  balance_after_mc BigInt // materialised balance immediately after this entry
  hold_id          String?
  source           String // "admin.grant", "brand_kit.typography", "seed", ...
  reason           String? // mandatory in service layer for ADJUST
  idempotency_key  String?         @unique
  actor_id         String?
  metadata         Json? // PII-scrubbed; whitelisted keys only (§7)
  created_at       DateTime        @default(now())

  project Project      @relation(fields: [project_id], references: [id], onDelete: Restrict)
  hold    CreditHold?  @relation(fields: [hold_id], references: [id], onDelete: Restrict)

  @@index([project_id, created_at])
  @@index([hold_id])
  @@map("credit_ledger_entries")
}
```

`onDelete: Restrict` everywhere: a project with metering history is never hard-deleted out from under
its ledger (the projects spec owns project lifecycle; archival there must tolerate Restrict here).

### 1.2 Why the balance is materialised, not summed

The preflight gate (§3) runs on **every generation** — the hottest new path in the product. Summing an
append-only ledger is O(entries-per-project) and grows without bound; the check must also happen
*inside a row lock* (§4), and locking an aggregate is not a thing — you lock a row. A single
`credit_balances` row per project gives an O(1), lockable, indexed read.

### 1.3 How balance and ledger are kept consistent — transaction boundary, not a cron

Every mutation goes through **one** code path (`applyEntries`, service-internal) that, inside a single
`prisma.$transaction`:

1. `SELECT ... FOR UPDATE` the project's `credit_balances` row (§4);
2. inserts the ledger entry/entries, computing `balance_after_mc` from the locked value;
3. updates `credit_balances.balance_mc` to the last `balance_after_mc`;
4. applies the hold state transition (if any) in the same transaction.

Balance and ledger therefore cannot diverge under crashes: either the transaction committed (both
moved) or it didn't (neither moved). **Invariant, checkable at any time:**
`credit_balances.balance_mc == Σ credit_ledger_entries.amount_mc` per project. A read-only
reconciliation endpoint (§7) recomputes the sum for operators; it never "fixes" anything, because the
transaction boundary is the correctness mechanism — there is no repair cron, and none is needed.

---

## 2. Append-only enforcement

The ledger has **no soft-mutation path**. Three layers, outermost first:

1. **DB trigger (authoritative).** The migration that creates the tables also ships hand-added SQL
   (workflow: `prisma migrate dev --create-only`, append SQL, then apply — first trigger in this repo,
   flagged as precedent for the reviewer):

   ```sql
   CREATE OR REPLACE FUNCTION credits_ledger_append_only() RETURNS trigger AS $$
   BEGIN
     RAISE EXCEPTION 'credit_ledger_entries is append-only (% blocked)', TG_OP;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER credit_ledger_entries_append_only
     BEFORE UPDATE OR DELETE ON credit_ledger_entries
     FOR EACH ROW EXECUTE FUNCTION credits_ledger_append_only();
   ```

   `TRUNCATE` is not trigger-blocked in the same way; dev/test DBs may truncate during resets, which
   is acceptable — production access runs through the app role, which gets
   `REVOKE TRUNCATE ON credit_ledger_entries` in the same migration (a no-op in dev where the app
   connects as the owner; documented, not load-bearing there).

2. **Service layer.** The credits service exposes **no** update/delete of ledger entries — the only
   write verb is *append*. Corrections are new `ADJUST` entries with a mandatory `reason` and a
   `metadata.corrects` pointer to the original entry id. No other module may touch
   `prisma.creditLedgerEntry` directly (same convention that keeps modules out of each other's
   tables today).

3. **Test lock.** A unit/integration test asserts that `prisma.creditLedgerEntry.update(...)` and
   `.delete(...)` against a real row **throw** (trigger fires), so the guarantee can't silently
   regress in a future migration squash.

Holds (`credit_holds`) are deliberately **not** append-only — they are operational state. Their audit
trail is the ledger: every transition writes a `RESERVE`/`SETTLE`/`RELEASE`/`EXPIRE` entry linked via
`hold_id`, so the mutable table can be fully reconstructed from immutable facts.

---

## 3. The preflight gate — hold lifecycle

### 3.1 Where in the request lifecycle

The gate lives in the **service layer of the calling module**, not in Express middleware: the estimate
(model, token budget) is only known after the caller has validated input and chosen a model, and a
single user request may fan out into several metered AI calls (brand-kit runs typography + tone +
strategy). HTTP middleware would gate too early with too little information. The calling pattern is:

```
controller → (Zod validate) → module service
  → creditsService.reserveCredits(...)   ← the gate; throws INSUFFICIENT_CREDITS → HTTP 402
  → downstream AI call
  → creditsService.settleHold(...)       on success
  → creditsService.releaseHold(...)      on failure
```

### 3.2 Hold semantics

- `reserveCredits` writes a `RESERVE` ledger entry of `-estimate_mc`, decrements the balance, and
  creates a `PENDING` hold with `expires_at = now() + credits.hold_ttl_seconds` (AppSetting, default
  **900 s** — comfortably above any sane AI-call timeout). Because the reserve *already* debited
  available balance, a concurrent reservation can never see held funds (§4).
- **Success → `settleHold(holdId, actualMc)`**: one `SETTLE` entry of `+(held − actual)` (the unused
  refund; `metadata` records `{held_mc, actual_mc}` plus usage), hold → `SETTLED`. If the estimate was
  low, `actual > held` makes the entry negative — allowed, because the cost is already incurred and
  the ledger records facts, not wishes. An overage beyond `credits.max_overage_pct` (default 25 %)
  additionally emits an activity-log alert (§7) so bad estimators get fixed. Settlement can drive the
  balance negative; a negative balance simply makes every subsequent `reserve` fail until a grant.
- **Failure / caller abort → `releaseHold(holdId, reason)`**: one `RELEASE` entry of `+held`, hold →
  `RELEASED`. Cost `0` — a failed provider call that still billed us is a `settleHold` with the billed
  amount, caller's choice per its provider contract.
- **Timeout** is not a distinct state: the caller's own timeout handler calls `releaseHold` (reason
  `"timeout"`). What timeouts *actually* threaten is the crash case:

### 3.3 Crash-mid-generation (explicit)

If the process dies between reserve and settle/release, a `PENDING` hold outlives its caller and the
project's spendable balance is silently smaller than it should be. Recovery is **reap-on-touch, not a
cron**:

- Every `reserveCredits` for a project first — inside the same locked transaction — finds that
  project's `PENDING` holds with `expires_at < now()`, writes one `EXPIRE` entry (`+held`) per hold,
  and flips them to `EXPIRED`. The next generation attempt therefore self-heals the balance before
  its own preflight check. (`@@index([status, expires_at])` and `@@index([project_id, status])` make
  this cheap.)
- The admin balance endpoint (§7) also reaps on read, so an operator looking at a stuck project sees
  the healed number, and a force-release endpoint covers the "nobody will ever generate again on this
  project" corner.
- **Late settlement**: if a settle arrives for a hold that reap already flipped to `EXPIRED` (crash,
  then the AI call turned out to have succeeded and a retry worker reports cost), `settleHold` does
  not fail silently — it writes an `ADJUST` entry of `-actual_mc` with
  `metadata: {late_settlement: true, hold_id}` and `reason: "late_settlement"`. Real spend is never
  dropped on the floor. A settle for a still-`PENDING` hold past its `expires_at` (not yet reaped)
  settles normally — grace by construction.
- Idempotency: `settleHold`/`releaseHold` take the hold id and are state-machine-guarded (only
  `PENDING` transitions; a repeat settle/release of an already-resolved hold returns the original
  outcome, keyed by the caller-supplied `idempotency_key` on the resulting entry). A crashed caller
  that retries the whole generation gets a fresh reserve with a fresh `idempotency_key`; the old
  hold expires. A retried *reserve* with the same key (network blip between caller and commit)
  returns the existing hold instead of double-debiting — enforced by the `@unique` on
  `credit_holds.idempotency_key`.

---

## 4. Concurrency — no double-spend

**Locking strategy: pessimistic per-project row lock** on `credit_balances`, taken as the first
statement of every mutating transaction:

```js
await prisma.$transaction(async (tx) => {
  const [row] = await tx.$queryRaw`
    SELECT id, balance_mc FROM credit_balances
    WHERE project_id = ${projectId} FOR UPDATE`;
  // reap expired holds (§3.3), check row.balance_mc >= estimateMc, insert entries, update balance
});
```

(Raw SQL because Prisma has no native `FOR UPDATE`; this is the one sanctioned `$queryRaw` in the
module, parameterised, wrapped in `applyEntries`.)

**Proof sketch.** Two simultaneous generations G1, G2 against one balance of 100 credits, each
reserving 60:

1. Both open transactions; G1 wins the `FOR UPDATE` lock on the project's single balance row. G2
   **blocks** — not fails — on the same lock.
2. G1 reads 100, checks 100 ≥ 60, writes `RESERVE −60` with `balance_after_mc = 40`, updates the
   balance row, commits, releasing the lock.
3. G2's `SELECT ... FOR UPDATE` now returns the **committed** value 40. This relies on
   **READ COMMITTED** (Postgres and Prisma default), where a lock wait re-reads the row version
   committed by the lock holder; credits transactions MUST run at this level. (Under
   REPEATABLE READ the same schedule would instead abort G2 with a serialization error — still no
   double-spend, but a different failure mode than specified here.) Check
   40 ≥ 60 fails → `INSUFFICIENT_CREDITS`, transaction rolls back, nothing was written.

Double-spend would require two transactions to both read a pre-debit balance, which would require
both holding the same row lock simultaneously — impossible. Because *every* balance mutation
(grant, reserve, settle, release, expire, adjust) goes through the same `applyEntries` lock, there is
no unlocked side door. Deadlocks cannot occur between credits transactions: each locks exactly one
balance row and never a second. The concurrency integration test in Phase C2 runs two genuine
parallel reserves against one project on a real Postgres and asserts exactly one succeeds and the
ledger sum matches the balance.

Balance-row creation: the projects module creates the `credit_balances` row (balance 0) in the same
transaction that creates a project (seam registered in PROJECTS_ARCH). `reserveCredits` against a
missing row fails closed (`INSUFFICIENT_CREDITS`); `grantCredits` upserts it (unique on `project_id`
makes the race benign).

---

## 5. Metering hook contract (for BRAND_KIT_AI_ARCH / KDL-475)

**Proposed shape** — BRAND_KIT_AI_ARCH is not merged; the AI Services agent should adopt this
interface or negotiate changes in review of whichever PR lands second. All functions are exports of
`backend/src/modules/credits/service.js`; amounts are `BigInt` µc.

```js
// The gate. Throws CreditError('INSUFFICIENT_CREDITS') → controller maps to HTTP 402.
reserveCredits({ projectId, actorId, source, estimateMc, idempotencyKey })
  → { holdId, expiresAt, balanceAfterMc }

// Success path. `usage` is stored (scrubbed) in ledger metadata.
settleHold({ holdId, actualMc, idempotencyKey,
             usage: { provider, model, inputTokens, outputTokens, costUsd } })
  → { entryId, balanceAfterMc, overage: boolean }

// Failure path.
releaseHold({ holdId, reason })          → { entryId, balanceAfterMc }

// Conversion helper (AppSetting-backed; §0 rounding rules).
usdToMc(usdNumberOrString)               → BigInt

// Convenience wrapper — reserve, run fn, settle from its return, release on throw:
withCreditHold({ projectId, actorId, source, estimateMc, idempotencyKey }, fn)
  // fn: async () => ({ result, actualMc, usage })  → returns result
```

Usage sketch for a brand-kit stage:

```js
const brand = await withCreditHold(
  { projectId, actorId, source: 'brand_kit.typography',
    estimateMc: usdToMc(estimateUsd(model, maxTokens)),
    idempotencyKey: `bk:${jobId}:typography` },
  async () => {
    const r = await aiServices.inferTypography(input);       // AI_SERVICES_ARCH interface
    return { result: r, actualMc: usdToMc(r.cost ?? 0),
             // AI_SERVICES usage is snake_case — map explicitly, never spread:
             usage: { provider: r.provider, model: r.model,
                      inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens,
                      costUsd: r.cost } };
  });
```

Notes for the AI Services agent:
- AI_SERVICES_ARCH already returns `{ content, usage, cost, model }` from OpenRouter calls and
  `cost: null` for Claude-subscription calls. `cost: null` settles at `actualMc: 0` with usage still
  recorded and `metadata.provider = 'claude_subscription'` — the ledger keeps the *fact* that a
  zero-marginal-cost call happened; if the board later prices subscription calls, that's a rate-table
  change, not a schema change.
- One hold per provider call (per DAG stage), not per user request — partial failure then releases
  only the failed stage's hold.
- The existing `auditLogger` in ai-services stays; it logs AI telemetry, the ledger logs money. The
  `session_id`/job id should go in both so an operator can join them.

**Known divergence from the in-flight brand-kit spec (must be reconciled before C2).**
`BRAND_KIT_AI_ARCH.md` on branch `arch/kdl-475-brand-kit-ai-contract` (unmerged at time of writing)
currently proposes a different seam: a `recordBrandInferenceUsage(...)` decorator *inside*
ai-services — post-hoc usage recording with no holds, no settle/release, and no idempotency keys —
and an `InferenceEnvelope` exposing `estimatedCostUsd` plus camelCase usage fields rather than the
raw `{ cost, usage }` shape consumed above. This spec's position: the preflight gate (§3) requires
the hold lifecycle, so brand-kit stages must call `withCreditHold` in the backend service layer;
a record-after-the-fact decorator cannot enforce a balance check and is not an acceptable
substitute. Envelope mapping when KDL-475's shape is adopted: `estimatedCostUsd` feeds the
*estimate* (`estimateMc = usdToMc(estimatedCostUsd)`), the settled `actualMc` comes from the final
actual cost (`usdToMc(costUsd)`, or the envelope's actual-cost field if it grows one);
`source: 'fallback'` (Claude-subscription path, no marginal cost) settles at `actualMc: 0` with
usage still recorded, per the `cost: null` rule above. Whichever PR lands second reconciles §5 and
the envelope; this dependency is also noted in §8.

---

## 6. Additive-commerce seam

Everything a billing module needs later already exists; nothing here changes when it arrives:

1. **Single mint path.** `grantCredits({ projectId, amountMc, source, actorId, reason, metadata,
   idempotencyKey })` is the only way credits enter a project — v1 callers are seed and the admin
   endpoint. A future billing module calls the *same* function with `source: 'purchase'` and
   `metadata: { external_ref }` (provider charge id). Its webhook dedupe rides the existing
   `idempotency_key @unique` for free.
2. **One-way references.** Future tables (`payments`, `invoices`, `price_books`, …) reference
   `credit_ledger_entries.id` / `credit_holds.id`; no column is ever added to the ledger for them.
3. **Enum growth is additive.** New entry types (`PURCHASE_REVERSAL` for refunds/chargebacks, …) are
   Postgres `ALTER TYPE ... ADD VALUE` — no rewrite, no backfill. Refunds are new negative entries,
   never mutations, which is exactly what the append-only trigger already enforces.
4. **Pricing lives outside.** `credits.usd_per_credit` is a metering conversion, not a price. Package
   pricing, tax, currency are entirely the future module's tables; the ledger stays currency-free
   (µc only) so no money-representation migration is ever needed.
5. **Gate is already the enforcement point.** Plan/quota logic later composes in front of
   `reserveCredits` (e.g. "free tier: max N generations/day") without touching the ledger.

---

## 7. Admin & observability

New module `backend/src/modules/credits/` (controller/routes/schema/service/module.json/seed.js per
the `integrations` layout). `module.json`: slug `credits`, `core: false`, `apiPrefix: "/api/credits"`,
permission group `credits`, nav entry gated on `credits:view`. All routes `authenticate` +
`requirePermission('credits', ...)`; all inputs Zod-validated; all responses
`successResponse`/`errorResponse`. `BigInt` serialises to string in JSON responses (documented in the
route schemas; frontend treats amounts as strings).

| Route | Perm | Behaviour |
|---|---|---|
| `GET /api/credits/projects/:projectId/balance` | `credits:view` | Balance + open holds; reaps expired holds first (§3.3) |
| `GET /api/credits/projects/:projectId/ledger` | `credits:view` | Cursor-paginated, filter by `entry_type`/date range |
| `GET /api/credits/projects/:projectId/reconciliation` | `credits:view` | Recomputes Σ ledger vs balance; read-only diagnostic, never mutates |
| `POST /api/credits/projects/:projectId/grants` | `credits:manage` | `grantCredits` (amount, reason required) |
| `POST /api/credits/projects/:projectId/adjustments` | `credits:manage` | `ADJUST` entry, reason required |
| `POST /api/credits/holds/:holdId/release` | `credits:manage` | Force-release a stuck `PENDING` hold |

**Activity log** (existing `activity_logs`, `module: 'credits'`): `grant`, `adjust`,
`hold_force_release`, and `settle_overage` (fired when overage exceeds `credits.max_overage_pct`).
**PII scrubbing:** ledger `metadata` and activity-log `properties` accept a **whitelist only** —
amounts, ids, model names, token counts, provider, `costUsd`, `external_ref`. Prompt text, generated
content, and user input never enter the ledger or the activity log (the ai-services PII scrubber
guards the AI side; credits simply never accepts free-form payloads). `source` is a code-defined tag,
not user input.

**AppSettings** (all with defaults in seed): `credits.usd_per_credit` (`"0.01"`),
`credits.hold_ttl_seconds` (`900`), `credits.max_overage_pct` (`25`).

**Open questions for the board (do not guess):**
- **OQ-C1** Initial per-project grant in v1 (seed grants 1,000 credits/project in dev; the production
  default is a product decision).
- **OQ-C2** Should non-AI expensive operations (print-geometry PDF export in `collateral`) meter in
  v1? Spec assumes **no** — AI calls only, per D3's motivation.

---

## 8. Phased build plan (PR-sized, per `docs/MERGE_DISCIPLINE.md`)

Each PR < 400 non-generated lines, one concern, rebased on master, backend-workspace lockfile only
(C1–C4 shouldn't touch lockfiles at all).

| PR | Contents | Gates | Depends on |
|---|---|---|---|
| **C1 — schema** | `prisma/schema/credits.prisma`; migration incl. append-only trigger + revoke SQL (`--create-only`, hand-edited — new precedent, call out in PR body) | `prisma validate` exit 0; migration applies clean on dev DB; trigger-rejection smoke (SQL `UPDATE` fails) | **projects PR-1** (`Project` model) — C1 is blocked until it merges |
| **C2 — service core** | `service.js` (`applyEntries` lock path, `grantCredits`, `reserveCredits`, `settleHold`, `releaseHold`, `usdToMc`, `CreditError`); unit tests + **real-Postgres concurrency test** (two parallel reserves → exactly one wins; Σ ledger == balance) + append-only regression test (§2.3). Tests are pre-split to keep C2 under the 400-line cap: `service.test.js` (unit, mocked Prisma) in C2; if the cap is still at risk, the two integration tests (`concurrency.integration.test.js`, `append-only.integration.test.js`) split into an immediate **C2b** test-only PR gated identically | vitest green; concurrency test green against dev DB | C1 |
| **C3 — lifecycle edges** | `withCreditHold`, reap-on-touch, late-settlement `ADJUST`, overage policy + activity-log alert; tests for crash/expiry/late-settle/idempotent-retry matrix | vitest green | C2 |
| **C4 — HTTP + ops** | routes/controller/Zod schemas/`module.json`; grant/adjust/force-release + reconciliation endpoints; activity logging; seed (AppSettings + dev grant); README | vitest green; manual curl transcript in PR | C3; RBAC perms seeded |

Projects-side seam (balance row created with project) lands in the **projects** build plan, not here —
registered as a requirement on KDL-474.

Brand-kit integration (calling §5) belongs to the brand-kit build, not to credits: credits ships
fully testable via its own admin API before any consumer exists.
