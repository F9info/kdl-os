# KDL OS — Platform Health, Growth Strategy & Android / iOS Module Plan

_Date: 2026-10-18 · Basis: full code audit (backend, ai-services, frontend), dependency audit, deploy-pipeline audit, and a mobile-readiness audit of the real code. Every "exists / missing" statement below was checked against the repository, not assumed._

**How to read this:** top to bottom. §1 is the one-page answer. §2–3 are the platform's real condition. §4 is how it grows the business. §5–7 are the Android/iOS modules and the staged plan. §8 lists the decisions only you can make.

---

## 1. Executive summary

1. **The platform is sound but was drifting.** 28 backend modules, a 9-stage brand→site engine, a visual page builder, RBAC, media DAM, multi-channel messaging. Tests had silently drifted (fixed this session: backend 1385, frontend 307, ai-services 101 all green).
2. **Real security holes existed and are now fixed** (§3.1): hidden records served on public endpoints, unlimited account creation and password-reset email-bombing, an open redirect and stored-XSS paths via admin-entered links, menu tampering across menus, a refresh-token race, SSRF through AI provider URLs, and any logged-in user able to force unlimited paid Claude calls.
3. **Some risks remain and need your decision** (§3.2): the AI knowledge base is shared across tenants, ai-services has no per-user limits, 7 Dependabot PRs hold the dependency CVEs, and staging needs a human to provision a server.
4. **The wedge that sells is already built:** *logo → brand kit → website + print collateral in one flow.* Growth is about packaging it for repeatable verticals, adding WhatsApp/CRM/billing around it, and opening it to partners (§4).
5. **Mobile is a real gap, not a rebuild.** Auth, chunked uploads and theme tokens (Android/iOS/TV) already exist. Missing: device sessions, push, API versioning, app config/force-update, deep links, native token export, server-driven pages. That is **12 new modules** (§5) delivered in **6 stages** (§6).
6. **One strategic conflict to resolve first:** your F9 stack says *Mobile: Flutter*, but you asked for *native* Android and iOS. The backend modules below serve either, so build them first; decide the client technology with a 2-week spike (§8).

---

## 2. Where the platform stands today (facts)

| Area | State |
|---|---|
| Backend | 28 modules (26 real, 2 nav-only shims), Express 5 + Prisma 6, 24 schema files, ~1385 tests |
| Frontend | Next 15 admin + Puck page builder, 40+ multi-variant construction blocks, Section Builder, menu manager |
| Template engine | 9/9 stages real: intake → palette → inference → approval → guidelines/collateral/website → preflight → export |
| AI services | Dual-brain router (Claude / OpenRouter), RAG on ChromaDB, Whisper transcription, brand inference; 101 tests |
| Messaging | Email, SMS (MSG91/Twilio), WhatsApp (Meta/Gupshup), in-app + SSE |
| Media | DAM, chunked uploads (512 MB), variants, virus scan, 5 cloud importers |
| Theme engine | Tokens for **webapp, tv, android, ios**, light/dark, 3 device sizes |
| Credits | Per-project metering ledger with holds — the base for monetisation |
| Weak spots | 7 modules had no tests (menus now has 33); staging never deployed; 14→7 stale Dependabot PRs; docs drifted (CLAUDE.md corrected) |

---

## 3. Code health

### 3.1 Fixed in this session (all with regression tests)

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | High | Public list endpoints (`/faq/public`, `/team/public`, `/sectors/public`, `/catalog/public`, `/work/public`, `/projects-content/public`) honoured `?is_active=false` — anyone could read hidden records, and inactive items were being **shown on the public site** | `publicOnlyActive` middleware forces `is_active=true` |
| 2 | High | Registration and forgot-password were **unlimited**: the limiter skipped successful requests, so unlimited accounts and unlimited reset emails to any victim | Per-IP signup limit, per-IP and per-email reset limits |
| 3 | High | Any logged-in user could send `priority:"HIGH"` and force unbudgeted Claude calls | Client priority clamped unless admin / super-admin |
| 4 | High | AI chat history keyed only by a client-chosen `sessionId` — cross-user read/poison | Session namespaced per authenticated user |
| 5 | Medium | Menu links allowed `/\evil.com` (open redirect); other link fields accepted `javascript:` (stored XSS) | Shared `safeUrl` guard on menus, sectors, case studies |
| 6 | Medium | Menu reorder/create trusted client ids: could move another menu's items; 3-level depth limit bypassable | Ownership checks + depth computed on the whole tree |
| 7 | Medium | Concurrent refresh requests could both mint valid tokens | Atomic claim; loser gets 401 (no family wipe, so multi-tab is safe) |
| 8 | Medium | AI provider `base_url` and image-op output URL fetched server-side with no guard (SSRF to redis/minio/cloud metadata) | SSRF guard, fail-closed |
| 9 | Medium | No timeouts on LLM clients (SDK default ≈10 min) | 120 s timeout, 2 retries |
| 10 | Low | Budget-exhausted note could inject lines into `MANUAL_TASKS.md` | Collapsed to one line |
| 11 | — | Deploy pipeline (see Issue 11 report): wrong image path, race with image build, `/health` unrouted, masked migrations, bootstrap not non-root-safe, malformed smoke workflow, dead "intentional break" CMD | All repo-side items fixed |
| 12 | — | Per-project website copy (Vision/Mission) was global | New `project_setting_values` table + project-aware reads/writes |

### 3.2 Still open — ranked, with what each needs

| # | Sev | Item | Why not fixed now | Next step |
|---|---|---|---|---|
| A | High | **Chroma knowledge base has no tenant filter** — retrieved chunks go straight into the system prompt, so one client's documents can surface for another | Changing it alters retrieval for existing data (old chunks have no tenant tag) — your call | Tag chunks with `project_id`, filter on query, one-off backfill; **decision #3 in §8** |
| B | High | **ai-services has no per-user rate limit or role check**; embeds, Claude, brand inference don't record spend; the budget check isn't atomic | Needs a budget-policy decision (per user? per project? per plan?) | Per-user limiter + reserve-then-settle budget; tie to `credits` |
| C | High | **Dependency CVEs:** `proxy-addr` (critical, IP spoofing), `nodemailer` (high), `sharp` (high), `next` (moderate), tiptap/prosemirror (high, XSS in paste), `source-map-js` | Your rule: Dependabot owns lockfiles | Commit → `@dependabot rebase` → merge #334, #342, #341, #344, #343, #340, #339 in that order (§6 Stage 0). That clears `proxy-addr` (critical) and most others. **Not guaranteed to clear:** `nodemailer` (the fix is a major bump), and the tiptap/prosemirror highs that arrive through `@puckeditor/core` — re-run `npm audit` / `pnpm audit` after merging and handle leftovers as separate PRs |
| D | Medium | Project-membership checks missing on credits / brand-kit / collateral routes | Latent: the app allows only one project today | Add `requireProject` before enabling multi-project |
| E | Medium | Page-builder `POST` schema drops `project_id` | Behaviour change for API clients | Add `project_id` + `requireProject('body')` |
| F | Medium | Sector/work create & delete are multi-step with no transaction | Needs careful refactor | Wrap in `prisma.$transaction` |
| G | Low | List endpoints unpaginated; no audit log on faq/team/sectors/catalog/work/menus; `settings` admin check reads JWT roles | Convention gaps | Pagination util + `writeActivityAsync` |
| H | Low | PII scrubber misses Aadhaar/PAN/+91; RAG context not delimited against prompt injection | — | Add patterns; wrap context in tags |
| I | Info | Local site-preview 500s on macOS (`Unknown system error -35`, Docker bind-mount) | Environment issue | Move `frontend/projects` to a named volume |

### 3.3 Not bugs (investigated and dropped)
`updatePage` having no `deleted_at` filter is **intentional** — the website driver resurrects soft-deleted pages through it.

---

## 4. How this grows the business — "super power" plan

**Positioning (from your own F9 charter):** *Operational AI Systems for Indian SMEs.* KDL OS is the product engine behind it. The strongest pitch is concrete and demonstrable in ten minutes:

> **"Upload your logo. Get your brand system, website, visiting cards and letterheads — approved and live today."**

### 4.1 Five growth levers (in order of return on effort)

1. **Vertical packs — repeat what you already did once.** Construction is complete (Subhadra). Your target list is NGOs, CRM/sales teams, construction, property management. Each pack = block library + seed content + content modules (the construction pack proves the pattern: sectors, catalog, work, team, FAQ, case studies). **A new vertical is now mostly content + 10–15 blocks, not engineering.** Start with *property management* (reuses sectors/catalog/work directly) and *NGO* (donations, impact stories, volunteers).
2. **WhatsApp-first, India-first.** WhatsApp + SMS drivers already exist. Add: lead capture forms → WhatsApp notify the owner, click-to-chat blocks, WhatsApp order/enquiry templates, UPI/Razorpay links. In Indian SMEs this beats email by an order of magnitude.
3. **Turn `credits` into revenue.** The metering ledger exists. Add plans (free / pro / agency), Razorpay + GST invoices, usage caps per project, and an "AI actions" meter. This converts a cost centre (LLM spend) into margin and supports the 10% → 45% SaaS mix in your transformation plan.
4. **Agency / reseller mode.** F9 is itself a services company with clients. Let F9 (and partners) run many client projects under one account: white-label domain + logo, client-approval links (the approval token stage already exists), per-client billing. Every agency becomes a sales channel.
5. **Measure and prove value.** Built-in analytics (visits, form leads, WhatsApp clicks), Core Web Vitals (a `/api/vitals` stub exists), SEO/GEO score per page (you already own SEO skills). Reports that show "leads this month" are what make a ₹ subscription renew.

### 4.2 AI features that earn their cost (keep to your Two-Brain rule)
- **Content co-pilot in the page builder** (LOW risk → local MLX): rewrite a block's copy in the brand's tone (tone inference already exists).
- **Lead qualifier** (LOW → MLX, batch): classify and score incoming enquiries; notify on hot leads.
- **Document-to-site** (HIGH → Claude, human gate): upload a company profile PDF → draft pages + FAQs. Uses RAG already built.
- **Multilingual sites** (MEDIUM → Haiku/Gemini): Hindi/Telugu/Tamil variants of every page; huge for Indian SMEs.
- Guardrails: fix §3.2 A and B first — you cannot sell AI features to multiple clients while knowledge is shared and spend is unmetered.

### 4.3 Foundation work that unlocks everything
Multi-project is capped at one today. Real multi-tenancy (project membership everywhere, per-project settings — started this session) is the gate for agency mode, vertical packs and mobile apps per client. Do it deliberately in Stage 2.

---

## 5. Mobile modules — Android native & iOS native

**What already helps (verified):** access JWT + refresh token accepted via request **body** (not just cookie) with rotation and reuse detection; theme engine already compiles `android` (Material 3, 20 panes) and `ios` (HIG, 18 panes) tokens; chunked/resumable media upload API; public endpoints for menus, sectors, page-builder pages, theme tokens; envelope `successResponse/errorResponse`; CORS is not a blocker for native clients.

**What is missing (verified):** device/session tracking and logout-all; push (FCM/APNs) — only SSE exists; API versioning (`/api/v1`) and OpenAPI; ETag / delta sync; per-user rate limits (limiter is per-IP, 100/15 min — carrier-NAT users will be throttled); app config / min-version gate; `.well-known` deep-link files; native token export (JSON/CSS only); presigned direct uploads (chunks live on local disk — breaks with >1 backend instance); server-driven UI for page-builder content.

### 5.1 Module catalogue (each follows `docs/MODULE_GUIDE.md`: `module.json`, routes → controller → service, own Prisma schema, permissions, activity log, `<ModuleGuard>` admin page — so they appear in your Modules options and can be enabled per install)

| # | Module slug | Purpose | Key endpoints | New tables | Admin screens | Effort | Needs |
|---|---|---|---|---|---|---|---|
| M1 | `api-gateway` | Versioned, documented, cache-friendly API | `/api/v1/*` alias, `/api/v1/openapi.json`, ETag/`If-None-Match` middleware, `?updated_since=` on public lists, per-user rate-limit keys | — | API docs, key/limit settings | M | — |
| M2 | `mobile-auth` | Devices, sessions, step-up | `GET/DELETE /auth/sessions`, `POST /auth/logout-all`, device header on login/refresh, `POST /auth/step-up` (biometric/PIN re-auth) | `device_sessions` (device_id, platform, name, app_version, last_seen, ip, token family) | "My devices", admin session viewer/revoke | M | M1 |
| M3 | `mobile-config` | Remote config, feature flags, version gate | `GET /app/config?platform=&version=` → `{minVersion, latestVersion, forceUpdate, maintenance, flags, endpoints}` | `app_releases`, `feature_flags` | Release channels, force-update toggle, flags per platform/segment | S | M1 |
| M4 | `push` | Push notifications (FCM + APNs) | `POST/DELETE /notifications/devices`, topic subscribe, `PUSH` channel in notifications queue, FCM HTTP v1 + APNs drivers | `device_tokens`, `push_topics`, `push_receipts` | Compose/send, audience (all / topic / user), delivery stats | M | M2 |
| M5 | `native-tokens` | Design system export for native devs | `GET /theme-engine/export?platform=android\|ios&format=xml\|compose\|swift\|json` with ETag + version | — | Export preview/download, version history | M–L | theme-engine |
| M6 | `mobile-media` | Mobile-friendly uploads & delivery | Presigned PUT (or tus) direct-to-storage; chunk store moved to object storage; responsive variants + blurhash; background-upload status | `upload_sessions` | Upload limits, variant presets | M | media |
| M7 | `deep-links` | Universal Links / App Links, share links | Serve `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`; link resolver `GET /l/:code` | `deep_links` | Link manager, per-app IDs/fingerprints | S | M3 |
| M8 | `server-driven-ui` | Render page-builder pages natively | `GET /api/v1/screens/:slug` → block JSON with a **block-type → native component registry** and fallbacks for unknown blocks | `screen_blocks` mapping | Block ↔ native component mapping, preview per platform | **L** | M1, M5 |
| M9 | `mobile-sync` | Offline-first reads/writes | Delta sync (`updated_since` + tombstones), idempotency keys, conflict policy, batch endpoint | `sync_tombstones` | Sync health | M | M1 |
| M10 | `app-analytics` | Product & crash telemetry (privacy-aware) | `POST /events` batch, crash report ingest, consent flag | `app_events` (partitioned) | Funnels, retention, crash list | M | M2 |
| M11 | `in-app-billing` _(optional)_ | Subscriptions & purchases | Play Billing / StoreKit receipt validation, entitlements, link to `credits` | `entitlements`, `purchase_receipts` | Plans, entitlement debugging | L | credits |
| M12 | `store-ops` | Release & store management | Store metadata, release notes, staged-rollout tracking, review-reply inbox | `store_listings` | Listing editor per locale, rollout dashboard | S–M | M3 |

### 5.2 Why this order of modules
M1 → M2 → M3 are the **spine**: every native app on day one needs a versioned API, device-aware login, and a force-update/config endpoint. M4 (push) is the single feature that most changes retention. M5/M6 remove daily friction for native developers and users. M8 (server-driven UI) is the "super power": the same page builder your clients already use edits the **mobile app screens live, without an app-store release** — but it is the largest item, so it comes after the spine is proven.

### 5.3 Native-side deliverables (not backend modules, but part of the plan)
- **Android (Kotlin, Compose, Material 3):** generated tokens module, Retrofit/Ktor client from OpenAPI, Hilt, encrypted token storage (Keystore), WorkManager for background upload/sync, FCM, App Links.
- **iOS (Swift, SwiftUI):** generated tokens package, URLSession client from OpenAPI, Keychain, BackgroundTasks, APNs, Universal Links, StoreKit 2.
- **Shared contract:** OpenAPI + a tiny "screen JSON" schema = one source of truth for both apps.
- Per-client branding: the template engine already produces a brand kit; M5 turns it into per-client **white-label app themes** (a second product line: "your brand app").

---

## 6. Staged delivery plan (top to bottom)

Estimates use AI-compressed effort for your 4-engineer team (no ML or mobile specialists), assuming review/approval time is the bottleneck, not typing.

### Stage 0 — Stabilise & ship what is done _(this week)_
- [ ] Review this session's working tree; split into PRs per your merge rules (one concern each): tests · autosave · mobile nav · sector SEO · setting-copy migration · security hardening · deploy pipeline.
- [ ] `@dependabot rebase` on the 7 PRs; merge in order #334 → #342 → #341 → #344 → #343 → #340 → #339 (clears the critical/high CVEs).
- [ ] Rebuild Docker images; hand-test autosave, mobile drawer, `/sectors/<slug>` view-source, per-project settings URL.
- [ ] Provision staging (checklist in `MANUAL_TASKS.md`), run "CD Staging".
- [ ] Re-run `npm audit --omit=dev` (backend, ai-services) and `pnpm audit --prod` (frontend); open follow-up PRs for anything left (likely nodemailer major, Puck's tiptap/prosemirror).
- **Exit:** CI green on master, staging URL live, **zero critical** CVEs and a written plan for any remaining high.

### Stage 1 — Close remaining risks _(1–2 weeks)_
- [ ] Decide §8 #3 and fix Chroma tenant isolation (A).
- [ ] Per-user limits + budget accounting + role check in ai-services (B).
- [ ] Pagination + audit logs + transactions (E–G); `requireProject` on credits/brand-kit/collateral (D).
- **Exit:** safe to put two clients on one instance.

### Stage 2 — API spine for mobile _(2–3 weeks)_
- [ ] **M1 `api-gateway`**: ~~`/api/v1`~~ (done 2026-11-06, alias + `X-API-Version`), ~~OpenAPI from Zod~~ (done 2026-11-06, no dependency: in-house generator, `GET /api/v1/openapi.json`), ~~ETag~~ (already served by Express; verified 304) and ~~`?updated_since=`~~ on the 7 public lists (done 2026-11-06), per-user rate limiting (ai-services done; backend limiter is still per IP).
- [ ] **M2 `mobile-auth`**: `device_sessions`, sessions list, logout-all, step-up.
- [ ] **M3 `mobile-config`**: min-version / force-update / maintenance / flags.
- [ ] Real multi-project: membership everywhere (builds on Stage 1 D).
- **Exit:** a throwaway native "hello" app can log in, list its devices, and be force-updated remotely.

### Stage 3 — Engagement & media _(3–4 weeks)_
- [ ] **M4 `push`** (FCM + APNs, `PUSH` channel, topics, admin composer).
- [ ] **M6 `mobile-media`** (presigned uploads, object-storage chunks, variants/blurhash).
- [ ] **M7 `deep-links`** (`.well-known` files, link resolver).
- [ ] **M5 `native-tokens`** (Android XML + Compose, iOS Swift via Style Dictionary).
- **Exit:** a notification opens the right screen in both apps; photo upload survives app backgrounding.

### Stage 4 — First native apps _(4–6 weeks, runs partly in parallel with Stage 3)_
- [ ] 2-week client-technology spike (native vs Flutter — §8 #1) on one real flow: login → list → detail → push.
- [ ] Build the "Business App" shell for the construction pack: sectors, catalog, work, FAQ, team, enquiry form (WhatsApp/lead capture), push.
- [ ] Beta via TestFlight and Play internal testing with Subhadra.
- **Exit:** one client app in both stores' beta tracks.

### Stage 5 — The super-power: server-driven UI _(4–6 weeks)_
- [ ] **M8 `server-driven-ui`**: block registry, native renderers for the 10 most-used blocks, graceful fallback for the rest.
- [ ] **M9 `mobile-sync`** for offline reads.
- [ ] **M10 `app-analytics`** and **M12 `store-ops`**.
- **Exit:** a content editor changes a mobile screen in the page builder and it updates in the app within minutes — no store release.

### Stage 6 — Monetise & scale _(ongoing)_
- [ ] Plans + Razorpay/GST on `credits`; **M11 `in-app-billing`** if you sell inside the app.
- [ ] Agency/reseller mode, white-label app themes, second and third vertical packs.
- [ ] Multilingual sites/apps, AI co-pilot, lead qualifier (guard-railed per §4.2).
- **Exit:** first paying pilots (your plan: 3 paying AI pilot clients by Q3) on a metered plan.

### Dependency map
```
M1 api-gateway ──► M2 mobile-auth ──► M4 push
      │                  └────────► M10 app-analytics
      ├──► M3 mobile-config ──► M7 deep-links ──► M12 store-ops
      ├──► M9 mobile-sync
      └──► M8 server-driven-ui ◄── M5 native-tokens ◄── theme-engine
M6 mobile-media ◄── media            M11 in-app-billing ◄── credits
```

---

## 7. Risks and how they are contained

| Risk | Likelihood | Mitigation |
|---|---|---|
| No mobile specialists on the team | High | Backend modules first (your strength); spike before committing; contract-first via OpenAPI; consider one contract mobile dev for Stage 4 |
| Server-driven UI scope balloons | High | Ship only 10 blocks natively; unknown blocks degrade to a "view on web" card |
| Services stability (your non-negotiable) | Medium | Each stage ends with an exit gate; mobile work never blocks client delivery; feature-flag everything through M3 |
| LLM cost overrun when AI features reach clients | Medium | Stage 1 B before any client-facing AI; credits metering |
| Apple/Google review friction | Medium | Enrol both developer accounts at Stage 2; use TestFlight/internal tracks early |
| Multi-tenant data leak | High until Stage 1 | Chroma isolation + `requireProject` before a second client |

### Success measures
Stage 0: critical CVEs = 0, no unplanned highs · Stage 2: `/app/config` p95 < 150 ms · Stage 3: push delivery > 95% · Stage 4: beta crash-free sessions > 99% · Stage 6: 3 paying pilots, AI cost per client < 30% of subscription.

---

## 8. Decisions only you can make

1. **Client technology:** native Kotlin + Swift (best platform fit, 2 codebases) vs Flutter (your stated stack, 1 codebase, weaker native tokens fit). _Recommendation:_ build M1–M4 first (platform-agnostic), then decide after the Stage 4 spike. With 4 engineers and no mobile specialist, Flutter is the lower-risk default **unless** you need deep platform features or Material/HIG fidelity on day one.
2. **Mobile product shape:** one generic "KDL Business App" that loads any client's brand and content (one store listing, fast), or a **white-label app per client** (own store listing, premium price, more release work). The modules support both; this decides pricing and ops.
3. **AI knowledge isolation:** per-project (recommended) vs per-account; and whether to backfill or re-ingest existing documents.
4. **AI budget policy:** per user, per project, or per plan — needed to finish §3.2 B and design the credits plans.
5. **Which vertical next:** property management (fastest reuse) vs NGO (new blocks, mission-fit) — drives Stage 6 order.
6. **Staging provider and domain** (`staging.kdl.f9tech.com`?) — only you can create the VPS, DNS and GitHub secrets.
7. **Optional modules:** is in-app billing (M11) in scope this year?

---

_This document is a plan, not a commitment: stage durations are estimates, and Stages 4–6 should be re-planned after the Stage 4 spike._
