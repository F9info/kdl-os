# BRAND_KIT_AI_ARCH — the `brand-kit` AI inference contract (D2)

**Issue:** KDL-475 (Template Engine follow-on #3, AI half only). **Status:** PROPOSED — for review.
**Governing decisions:** D2 (`.agents/PRODUCT_MODES_ARCH.md:132-136`), D3 (`:137-140`), §7 item 3 (`:151-155`).
**Companion spec:** KDL-471 `brand-kit` module spec (Paperclip document `spec` on KDL-471) — owns logo
intake, palette extraction, contrast, persistence, PDF. This doc owns ONLY the AI inference contract.
**Stack (LOCKED by KDL-475):** LangChain.js + OpenRouter, inside the existing `ai-services` workspace.

> **Reconciliation note vs KDL-471 D-BK-2.** The KDL-471 spec recommended routing inference to the
> Claude brain (`HIGH`). KDL-475 locks the stack to OpenRouter. This doc follows KDL-475 (later, more
> specific, board-issued): inference runs on **named OpenRouter models** (§2) through the existing
> OpenRouter client + budget/audit plumbing. D-BK-2 is superseded; everything else in KDL-471 stands.

The module shell/persistence half is specced separately after `projects` (KDL-449) lands. Therefore
**nothing in this contract touches storage**: every function takes plain typed inputs and returns plain
typed outputs. `logoAssetRef` is an opaque string the AI layer never dereferences in v1 (multimodal is
OQ-B in KDL-471). Callers persist results wherever tenancy ends up putting them.

---

## 1. The stable interface

Lives in `ai-services/src/services/brand-inference.js` (JS ESM, JSDoc-typed like the rest of the
workspace); the contract below is expressed as TypeScript for precision. Exposed over HTTP as
`POST /api/ai/brand-inference` (one route, `call` discriminator), JWT-authenticated like the existing
routes (`ai-services/src/index.js:48-50`).

**Stability rule:** this interface is versioned by `schemaVersion` and MUST NOT change when the model
behind it changes. Models, prompts, temperatures, and providers are implementation detail hidden behind
the envelope; only `envelope.model` reveals them, and callers may not branch on it.

```ts
type BrandInferenceSchemaVersion = 1;

/** Deterministic palette summary — produced by the extraction pipeline (§7), never by the model. */
interface ExtractedPaletteSummary {
  primary:    { hex: string; oklch: [number, number, number]; hueName: string };
  secondary?: { hex: string; oklch: [number, number, number]; hueName: string };
  accent?:    { hex: string; oklch: [number, number, number]; hueName: string };
  neutral:    { hex: string; oklch: [number, number, number] };
  paletteConfidence: 'high' | 'medium' | 'low';
}

interface BrandInferenceInput {
  companyName: string;              // 1..200 chars
  industry: string;                 // free text, 1..120 chars — NOT an enum; the regex era is over
  tagline?: string;                 // 0..300 chars
  locale?: string;                  // BCP-47, default 'en'
  logoAssetRef?: string;            // opaque media ref; NOT dereferenced in v1 (KDL-471 OQ-B)
  palette: ExtractedPaletteSummary;
}

type FallbackCode =
  | 'F1_NO_KEY'         // key missing or a known placeholder ('local', 'sk-your-*') — checked at call time
  | 'F2_AUTH'           // provider 401/403
  | 'F3_TIMEOUT'        // no response within timeoutMs (default 20_000)
  | 'F4_RATE_LIMIT'     // provider 429 after one jittered retry
  | 'F5_BUDGET'         // budget-tracker gate refused the call (checkBudget() === false)
  | 'F6_BAD_OUTPUT'     // Zod-invalid after the repair loop's maxIterations cap (§3)
  | 'F7_LOW_CONFIDENCE';// model self-reported confidence < 0.5

/** Every result — AI or fallback — arrives in this envelope. Same shape on both paths. */
interface InferenceEnvelope<T> {
  schemaVersion: BrandInferenceSchemaVersion;
  source: 'ai' | 'fallback';
  fallbackReason: FallbackCode | null;   // non-null iff source === 'fallback'
  rulesVersion: string | null;           // fallback rule-table version, null on the AI path
  model: string | null;                  // OpenRouter model id actually used, null on fallback
  usage: { inputTokens: number; outputTokens: number } | null; // null on fallback
  estimatedCostUsd: number;              // 0 on fallback — this is what credits meters (§5)
  confidence: number;                    // 0..1; fallback results are fixed at 0.3
  attempts: number;                      // 1..maxIterations; 0 when the call was never made (F1/F5)
  result: T;
}

interface InferenceOptions {
  timeoutMs?: number;        // default 20_000 per call
  signal?: AbortSignal;
  sessionId?: string;        // audit-log correlation, e.g. 'brand-kit:<projectId>'
  forceFallback?: boolean;   // tests/local dev: skip the provider entirely (reason F1_NO_KEY)
}

interface TypographyResult {
  pairingId: string;                       // id from the curated pairing whitelist (§2.1)
  heading: { family: string; weights: number[]; fallbackStack: string };
  body:    { family: string; weights: number[]; fallbackStack: string };
  scaleRatio: number;                      // 1.125 | 1.2 | 1.25 | 1.333
  rationale: string;                       // 1–2 sentences, internal display only
}

interface ToneResult {
  voice: string;                           // one paragraph, <= 500 chars
  adjectives: string[];                    // 3..5 items
  dos: string[];                           // 3..6 items
  donts: string[];                         // 3..6 items
}

interface StrategyResult {
  positioning: string;                     // <= 600 chars, client-facing (lands in the PDF)
  audienceNotes: string;                   // <= 800 chars
  elevatorPitch: string;                   // <= 300 chars
}

export function inferTypography(
  input: BrandInferenceInput, opts?: InferenceOptions
): Promise<InferenceEnvelope<TypographyResult>>;

export function inferTone(
  input: BrandInferenceInput, opts?: InferenceOptions
): Promise<InferenceEnvelope<ToneResult>>;

export function generateBrandStrategy(
  input: BrandInferenceInput & { typography?: TypographyResult; tone?: ToneResult },
  opts?: InferenceOptions
): Promise<InferenceEnvelope<StrategyResult>>;
```

Contract invariants (tested in §6):

- **Never throws for provider reasons.** Provider/format failures degrade to `source:'fallback'` with
  a code. The only thrown errors are input-validation errors (caller bugs) and `AbortSignal` aborts.
- **Total function over valid input.** Every valid `BrandInferenceInput` produces a fully-populated
  result on both paths — the fallback is a complete brand kit, not a stub (KDL-262 reality, §4).
- **No colour output.** Result schemas contain no colour fields by construction; palette is input-only
  (§7). A model that emits colours has them dropped by Zod's `.strip()`.
- **Additive evolution only** within `schemaVersion: 1`; breaking changes bump the version and v1
  shapes keep being served.

## 2. Prompt + model plan (per call)

Execution goes through a new `openrouterStructured()` brain function beside `openrouterBrain`
(`ai-services/src/brains/openrouter.js`), built on LangChain.js: `ChatOpenAI` from `@langchain/openai`
(already a dependency, `ai-services/package.json`) pointed at `OPENROUTER_BASE_URL`, with
`.withStructuredOutput(zodSchema)` doing schema-enforced JSON. It reuses the existing gates verbatim:
`checkBudget()` before the call, `recordSpend()` + `auditLogger()` after
(`ai-services/src/orchestrator/budget-tracker.js:9-20`, `brain-router.js:28-36`).

| Call | OpenRouter model | Shots | Temp | max_tokens | Budget (in/out tokens) | Latency p95 |
|---|---|---|---|---|---|---|
| `inferTypography` | `anthropic/claude-haiku-4.5` | few-shot (3) | 0.0 | 512 | ~1,800 / ~250 | 4 s |
| `inferTone` | `anthropic/claude-haiku-4.5` | few-shot (2) | 0.3 | 768 | ~1,200 / ~400 | 5 s |
| `generateBrandStrategy` | `anthropic/claude-sonnet-4.5` | zero-shot | 0.7 | 1,024 | ~1,400 / ~650 | 10 s |

Model ids are env-overridable (`BRANDKIT_MODEL_STRUCTURED`, `BRANDKIT_MODEL_COPY`) — swapping a model
is a config change, not an interface change (§1 stability rule).

**Why these models.** Typography and tone are *constrained selection/structured-generation* tasks: the
hard part is instruction-following and valid JSON, not creativity — Haiku-class models do this reliably
at ~1/10th the cost of frontier models, and temperature 0 + few-shot makes output near-deterministic.
Strategy copy is the one place prose quality is the product (it lands verbatim in the client-facing
guidelines PDF), so it gets a Sonnet-class model and creative temperature. Both are Anthropic models
served via OpenRouter, satisfying the locked stack while keeping quality characteristics we already
trust from the Claude brain. Free-tier/32k budget models (`moonshot-v1-32k`, the current default) are
explicitly rejected for strategy copy: client-facing brand prose is the differentiator (D2), and saving
~$0.01 per generation there is a false economy.

**Prompt structure (all calls).** System prompt: role ("brand identity specialist"), the output JSON
schema in prose, hard constraints, and — for typography — the **curated pairing whitelist** as compact
JSON. User message: structured plain text built from `BrandInferenceInput` (company name, industry,
tagline, locale, palette summary as hue names + hex + confidence). Inputs pass the existing PII
scrubber (`scrubMessages`, `ai-services/src/governance/compliance.js`) first, same as chat.

### 2.1 Typography whitelist — the model selects, never invents

`ai-services/src/services/data/font-pairings.json`: ~40 entries of
`{ id, heading, body, weights, vibeTags[], fallbackStack }`, all Google-Fonts/OFL (matches the
theme-engine font-allowlist posture and PDF-embedding licensing, KDL-471 §6). The model returns only
`pairingId`, `scaleRatio`, and `rationale`; families/weights/stacks are resolved locally from the
whitelist. A hallucinated `pairingId` fails Zod (`z.enum` over the whitelist ids) and enters the repair
loop. Few-shot exemplars: three (industry, palette) → pairingId picks with one-line reasons, chosen to
span vibe space (a law firm / serif, a kids brand / rounded, a dev-tools brand / mono-flavoured).

**Tone few-shot:** two full exemplars pinning list lengths, adjective register, and the "dos/donts are
imperatives, not descriptions" convention. **Strategy zero-shot:** exemplars would leak phrasing into
client copy; instead the prompt pins voice via the just-inferred `ToneResult` (passed as context) and
bans superlative boilerplate ("world-class", "cutting-edge", …) by name.

## 3. Zod schemas + repair/retry loop

Schemas live in `ai-services/src/services/brand-inference-schemas.js` and are the single source of
truth for both the HTTP layer and `withStructuredOutput`:

```js
export const TypographySchema = z.object({
  pairingId: z.enum(PAIRING_IDS),
  scaleRatio: z.union([z.literal(1.125), z.literal(1.2), z.literal(1.25), z.literal(1.333)]),
  rationale: z.string().min(10).max(400),
  confidence: z.number().min(0).max(1),
}).strip();

export const ToneSchema = z.object({
  voice: z.string().min(40).max(500),
  adjectives: z.array(z.string().min(2).max(30)).min(3).max(5),
  dos: z.array(z.string().min(5).max(120)).min(3).max(6),
  donts: z.array(z.string().min(5).max(120)).min(3).max(6),
  confidence: z.number().min(0).max(1),
}).strip();

export const StrategySchema = z.object({
  positioning: z.string().min(80).max(600),
  audienceNotes: z.string().min(80).max(800),
  elevatorPitch: z.string().min(40).max(300),
  confidence: z.number().min(0).max(1),
}).strip();
```

**Repair loop.** Hard cap `MAX_ITERATIONS = 3` per call (1 initial attempt + up to 2 repairs) —
non-negotiable rule 2 (`CLAUDE.md:165`), no env override upward. On a Zod failure the repair attempt
re-sends the same conversation plus the raw invalid output and the flattened Zod error
(`fromZodError`-style prose), instructing the model to return corrected JSON only. Temperature drops to
0 on repair attempts regardless of the call's base temperature. Each attempt is separately
budget-checked, spend-recorded, and audit-logged (a repair is a real paid call, so credits sees it —
§5).

**When the cap is hit:** the call resolves — never throws — to the fallback result with
`fallbackReason: 'F6_BAD_OUTPUT'`, `attempts: 3`. Per non-negotiable rule 3, the cap hit is never
silent: an `auditLogger` row with `event: 'brand_inference_cap_hit'` plus a `logger.error` with the
last Zod error is written. (Rule 3's literal `BLOCKERS.md` write applies to agent-run contexts — the
eval harness in §6 does write `BLOCKERS.md` on cap hit; a deployed container has no meaningful
`BLOCKERS.md`, so the audit row is the runtime equivalent. Reviewer should confirm this reading.)

## 4. Offline fallback — the rule table's only surviving role

The prototype's `inferTypography`/`inferTone` (five regexes over an industry string, per
`.agents/PRODUCT_MODES_ARCH.md:132-136`) survive ONLY as a deterministic rule table:
`ai-services/src/services/data/inference-rules.json` — ordered entries of
`{ match: [industry keyword stems], pairingId, tone: {...}, strategyTemplate: {...} }` plus a mandatory
default entry. Evaluation is first-match over lowercased keyword stems: pure, synchronous,
deterministic. Strategy copy on the fallback path is template interpolation (`{companyName}`,
`{industry}`, hue name) — honest boilerplate, clearly badged, never pretending to be inference.

**Provenance:** the prototype source is not in the repo (KDL-471 OQ-A stands); the table ships as
`rulesVersion: "reconstructed-v0"` (~10 industries) and is re-seeded from the real prototype rules when
the board supplies the file. `rulesVersion` is in the envelope precisely so re-seeding is observable.

**Exact trigger conditions** (the FallbackCode table in §1, normatively):

| Code | Trigger | Provider called? |
|---|---|---|
| `F1_NO_KEY` | `OPENROUTER_API_KEY` unset, `''`, `'local'`, or matching `/^(sk-your-|your-|placeholder)/i` — evaluated at call time, so fixing env needs no redeploy. Also `forceFallback: true`. | no |
| `F5_BUDGET` | `checkBudget()` false (the $2/day Redis gate) | no |
| `F2_AUTH` | 401/403 from OpenRouter | yes |
| `F3_TIMEOUT` | no completion within `timeoutMs` (default 20 s, AbortSignal) | yes |
| `F4_RATE_LIMIT` | 429, after exactly one retry with 1–3 s jitter | yes |
| `F6_BAD_OUTPUT` | Zod-invalid after `MAX_ITERATIONS` (§3) | yes |
| `F7_LOW_CONFIDENCE` | valid output but self-reported `confidence < 0.5` — fallback result is served, the AI result is discarded (not persisted half-trusted) | yes |

**How callers tell which path ran:** `source` + `fallbackReason` + `rulesVersion` in every envelope —
persisted by the module shell (KDL-471 already reserves `inferenceSource`/`fallbackReason` columns) so
the Studio UI badges fallback kits ("generated offline — re-run when AI is available") and a later
re-run upgrades them. `estimatedCostUsd: 0` and `model: null` are corroborating signals, but `source`
is the normative one.

**KDL-262 reality (design constraint, not solved here):** in this environment every provider key is a
placeholder (`OPENAI_API_KEY=local`), so `F1_NO_KEY` is the *default local path*. That is deliberate:
it means the fallback is exercised on every local run and in CI with zero network access, which is
exactly the testability property §6 needs.

## 5. Cost model + metering hook (for `credits`, KDL-450 / D3)

One **generation** = one user-triggered inference pass = **3 calls** (typography, tone, strategy),
sequential because strategy consumes the tone result. Worst case with full repair loops: 9 calls.

| Call | Model (per-MTok pricing) | Tokens in/out | Cost/call |
|---|---|---|---|
| typography | Haiku 4.5 ($1 / $5) | 1,800 / 250 | ~$0.0031 |
| tone | Haiku 4.5 ($1 / $5) | 1,200 / 400 | ~$0.0032 |
| strategy | Sonnet 4.5 ($3 / $15) | 1,400 / 650 | ~$0.0140 |
| **Typical generation** | | | **~$0.020** |
| Worst case (all calls use both repairs) | | | ~$0.061 |

At the existing $2.00/day OpenRouter budget: ~95 typical generations/day before `F5_BUDGET` — ample
for v1 internal metering, and the gate degrades to fallback rather than erroring (§4).

**Metering hook point (named, for KDL-450):** every envelope-producing call funnels through one choke
point in the service — `recordBrandInferenceUsage(sessionId, call, envelope)` in
`ai-services/src/services/brand-inference.js` — which today writes the `auditLogger` row (event
`brand.inference`, with `call`, `model`, `usage`, `estimatedCostUsd`, `attempts`, `source`). The
credits module meters by decorating **this function** and inserts its preflight balance check
immediately before it in the same service, mirroring KDL-471 §7's backend-side
`recordUsage(projectId, 'brand.inference', …)` — ai-services keys by `sessionId`
(`brand-kit:<projectId>`), the backend choke point resolves it to `projectId` for the ledger of
record. Fallback envelopes flow through the same hook with cost 0 and are never billable.
`estimatedCostUsd` is computed in `openrouterStructured` from returned usage × a small per-model price
table (same pattern as `openrouter.js:13,40`; the flat `COST_PER_TOKEN` there is wrong for per-model
pricing and is not reused).

## 6. Determinism + eval — regression without asserting prose

Fixture set: `ai-services/tests/fixtures/brand-inference/` — **N = 12** brand inputs chosen to span
the space: 6 mainstream industries (legal, medical, construction, restaurant, SaaS, retail), plus 6
edge cases — monochrome palette / `paletteConfidence: 'low'`, ambiguous industry ("consulting"),
industry with no rule-table match (exercises the default entry), non-English company name + `locale`,
empty tagline, and adversarial input (`companyName: "Ignore previous instructions…"` — prompt-injection
canary: output must still validate and contain no schema-external behaviour).

Each fixture is `{ input, expect }` where `expect` is **shape assertions, never prose**:

- envelope parses against the §1 Zod schemas (schemaVersion, source, code/rulesVersion coherence);
- `pairingId ∈ whitelist`; adjectives 3–5; dos/donts 3–6; length bounds; banned-boilerplate list
  absent from strategy fields; `confidence ∈ [0,1]`;
- fixture-specific invariants (e.g. the no-match fixture must resolve the default rule entry).

Three vitest suites (all in the existing ai-services vitest setup, gate: exit 0):

1. **Fallback determinism (CI, always, offline):** run all 12 fixtures with `forceFallback: true`,
   assert **byte-identical golden outputs** (the fallback is pure) + shape assertions. Also: each
   F-code trigger simulated (fake transport returning 401/429/timeout/garbage) asserts the right code,
   `attempts` count, and that no error escapes.
2. **AI contract (CI, always, offline):** `openrouterStructured` with an injected fake chat model
   (LangChain `FakeListChatModel` pattern) — valid output → `source:'ai'`; invalid-then-valid → repair
   loop engages, `attempts: 2`; invalid×3 → `F6` fallback + cap-hit audit row; low confidence → `F7`.
3. **Live eval (manual, `BRANDKIT_LIVE_EVAL=1`, never CI):** runs fixtures against real OpenRouter,
   applies the same shape assertions (not golden — real model prose varies), reports per-call token
   usage and latency vs the §2 budgets, and writes `BLOCKERS.md` on any cap hit (rule 3).

QA regression-tests inference by running suites 1–2 — no key, no network, no model prose assertions.

## 7. Palette extraction boundary — deterministic, never the model

Normative restatement of KDL-471 §2–3: **canvas/sharp dominant-colour extraction, OKLCH 10-step
variant ramps, and WCAG contrast checking are DETERMINISTIC local compute. They MUST NOT go through
the model** — not for generation, not for "improvement", not for naming. Reasons: determinism (same
logo ⇒ same palette, a §6 requirement), zero cost, and colour maths is exactly what LLMs are bad at.

**The handoff point** is `ExtractedPaletteSummary` (§1): the extraction pipeline finishes completely,
then its summary (role hexes, OKLCH triples, human hue names, confidence) enters
`BrandInferenceInput.palette` as **context for typography/tone/strategy choices only**. Enforced
structurally from both sides: the input schema accepts no raw pixels or ramps (summaries only), and the
output schemas contain no colour fields (§1 invariant — anything colour-shaped the model emits is
stripped). Hue *names* for the summary come from a fixed 24-sector OKLCH hue-wheel lookup table —
deterministic, not model-generated.

---

## Open items for the reviewer / board

1. **D-BK-2 superseded** (§ preamble): confirm OpenRouter-only routing for brand inference is the
   board's intent, retiring KDL-471's Claude-brain recommendation.
2. **Rule-3 runtime reading** (§3): audit-log row as the deployed-container equivalent of the
   `BLOCKERS.md` write.
3. **Rule-table seeding** (§4): board still owes the prototype source (KDL-471 OQ-A) to replace
   `reconstructed-v0`.
