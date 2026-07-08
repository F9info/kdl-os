# 3rd-Party Integration System — KDL Starter Kit
# Module 4 Design Document (Email / SMS / WhatsApp transport layer)

**Author:** Claude (Cowork) — approved by Prasanna (web@f9tech.com)
**Date:** 2026-07-07
**Status:** FINAL v1.0 — Implementation-ready.
**Mode:** 24/7 unattended — Auto-Approval Protocol applies (`.agents/USER_MANAGEMENT_ARCH.md`).
**Type:** New plugin module, slug `integrations` (non-core: installable/disableable).
**Depends on:** Module Plugin System (done). Independent of MEDIA_PRO. NOTIFICATIONS_ARCH consumes this — build integrations FIRST.

---

## Read Scope (TOKEN RULE — read ONLY your step's sections)

| Step | Sections |
|---|---|
| 1 | Prisma Schema, Credential Encryption |
| 2 | Driver Contract + the 4 drivers |
| 3 | Dispatch Service + Queue, API Endpoints |
| 4 | Webhooks + Logs, API Endpoints |
| 5 | Core email service migration |
| 6 | Frontend |
| 7 (review) | Whole doc |
| 8 (E2E) | Implementation Order Step 8 row |
| 9 (docs) | Overview + endpoint table |

---

## Overview

One transport layer for all outbound messaging: **EMAIL, SMS, WHATSAPP**. Admins configure providers with credentials in the UI, set a default (+ optional fallback) per channel, test-send, and audit every message in a delivery log with provider status callbacks. Other modules never talk to providers — they call `dispatchMessage()` or emit a queue job; this module owns credentials, rate limits, retries, failover, and logging.

Scaffold with `npm run module:create -- --slug=integrations --name="Integrations"` and follow the New Module Checklist (CLAUDE.md).

**Drivers shipped (India-first defaults, all pluggable):**

| Channel | Drivers |
|---|---|
| EMAIL | `smtp` (nodemailer — reuses existing SMTP envs as import defaults), `ses` stub optional — smtp only in v1 |
| SMS | `msg91`, `twilio` |
| WHATSAPP | `meta-cloud` (WhatsApp Business Cloud API), `gupshup` |

---

## Prisma Schema

**File:** `backend/prisma/schema/integrations.prisma`

```prisma
enum IntegrationChannel { EMAIL SMS WHATSAPP }
enum MessageStatus { QUEUED SENT DELIVERED READ FAILED }

model IntegrationProvider {
  id          String  @id @default(cuid())
  channel     IntegrationChannel
  driver      String            // "smtp" | "msg91" | "twilio" | "meta-cloud" | "gupshup"
  name        String            // display: "MSG91 Production"
  credentials String            // AES-256-GCM encrypted JSON blob — NEVER plaintext
  config      Json?             // non-secret driver config (sender id, from address, waba number)
  is_active   Boolean @default(false)
  is_default  Boolean @default(false)   // one default per channel (enforce in service)
  is_fallback Boolean @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  logs IntegrationLog[]

  @@index([channel, is_active])
  @@map("integration_providers")
}

model IntegrationLog {
  id           String   @id @default(cuid())
  provider_id  String?
  channel      IntegrationChannel
  recipient    String            // masked at write time: p***@x.com / 98*****210
  subject      String?
  body_preview String?           // first 120 chars, PII-scrubbed
  status       MessageStatus @default(QUEUED)
  provider_ref String?           // provider message id (webhook correlation)
  error        String?
  source       String?           // "notifications", "auth.password-reset", "test"
  attempts     Int      @default(0)
  sent_at      DateTime?
  delivered_at DateTime?
  created_at   DateTime @default(now())

  provider IntegrationProvider? @relation(fields: [provider_id], references: [id], onDelete: SetNull)

  @@index([channel, status])
  @@index([provider_ref])
  @@index([created_at])
  @@map("integration_logs")
}
```

## Credential Encryption

- `backend/src/modules/integrations/shared/crypto.js`: AES-256-GCM, key from new env `APP_ENCRYPTION_KEY` (32-byte hex; manifest `env: ["APP_ENCRYPTION_KEY"]` — install fails without it). Format: `iv:tag:ciphertext` base64.
- Credentials are write-only through the API: GET responses return `credentials_set: true` + non-secret `config` only — never decrypt for responses. Decrypt only inside driver send path.
- Activity logs / integration logs must never contain credentials (PII scrubber already redacts key names; also never pass the blob to writeActivity properties).

---

## Driver Contract

`backend/src/modules/integrations/drivers/<driver>.js` exports:

```js
export default {
  channel: 'SMS',
  driver: 'msg91',
  credentialsSchema,           // Zod — validates on provider create/update
  configSchema,                // Zod — non-secret config
  async send({ credentials, config, to, subject, body, meta }) -> { provider_ref } | throw,
  parseWebhook(req) -> { provider_ref, status } | null,   // delivery callback mapping
}
```

Registry `drivers/index.js` maps `driver` string → module. Adding a provider later = one new driver file, zero service changes.

WhatsApp v1 scope: template + plain-text session messages to a number. No inbound conversation handling (future module).

---

## Dispatch Service + Queue

- `service.js` exports **`dispatchMessage({ channel, to, subject?, body, source, meta? })`** — the ONLY public send API for other modules (also re-exported via BullMQ queue `integrations.queue.js` for async callers).
- Flow: create IntegrationLog (QUEUED, masked recipient) → enqueue BullMQ job → worker: resolve active default provider for channel → decrypt → `driver.send()` → update log SENT + provider_ref. Throw → retry 3x exponential backoff → still failing and a fallback provider exists → try fallback once → else FAILED + error.
- Rate limit per provider: BullMQ limiter (configurable via `config.rate_per_minute`, default 60).
- Module DISABLED → `dispatchMessage` throws `IntegrationsDisabledError`; queued jobs park (worker pauses via moduleGate-style status check). Callers (notifications) must catch and degrade.
- Worker instantiated in index.js + closed on shutdown (email-worker pattern; no module-level counters).

## API Endpoints (all `moduleGate('integrations')` + `authenticate` + `requirePermission('integrations', ...)`; manifest registers `integrations` permission module)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/integrations/providers` | integrations:view | credentials never returned |
| POST | `/api/integrations/providers` | integrations:add | validate against driver credentialsSchema, encrypt, store |
| PATCH | `/api/integrations/providers/:id` | integrations:edit | partial credential update re-encrypts whole blob; default/fallback toggles enforce one-per-channel |
| DELETE | `/api/integrations/providers/:id` | integrations:delete | 409 if is_default with queued jobs |
| POST | `/api/integrations/providers/:id/test` | integrations:edit | send test message to given recipient; returns log id |
| GET | `/api/integrations/logs` | integrations:view | filters: channel, status, source, date range; paginated |
| POST | `/api/integrations/webhooks/:driver` | PUBLIC (no auth) | delivery callbacks; verify driver signature (Meta: X-Hub-Signature-256; MSG91/Twilio per docs); map via parseWebhook → update log status. Unverifiable → 401, log attempt |

Every provider mutation → writeActivity (never include credential values).

## Core email service migration (Step 5)

`shared/services/email.service.js` becomes a thin router: integrations module ENABLED → `dispatchMessage({channel:'EMAIL', source:'core'})`; else → existing direct SMTP (unchanged fallback). Password reset and system emails therefore gain logging/failover automatically without a hard core→plugin dependency (dynamic import + try/catch — core must boot with integrations absent).

---

## Frontend

`app/admin/integrations/` (wrapped in `ModuleGuard slug="integrations"`; nav via manifest):

- **Providers page:** channel tabs (Email/SMS/WhatsApp) → provider cards (driver, name, active/default/fallback badges) → add/edit dialog with driver select; credential fields rendered from a static per-driver field map; saved credentials shown as `••••` with "replace" action; Test Send dialog (recipient + message → result + link to log).
- **Logs page:** DataTable — time, channel, recipient (masked), source, status badge (QUEUED/SENT/DELIVERED/READ/FAILED), error tooltip, provider; filters + pagination.
- Types → `types/integrations.types.ts`.

---

## Implementation Order

| Step | Task | Agent | Gate |
|---|---|---|---|
| 1 | Scaffold module + schema + crypto.js | Backend Architect → Coder | prisma validate + migrate clean; crypto round-trip unit tests |
| 2 | Driver contract + smtp/msg91/twilio/meta-cloud/gupshup drivers (send + parseWebhook, all provider HTTP mocked in tests) | Backend Coder | vitest: each driver maps request/response correctly against recorded fixtures |
| 3 | Dispatch service + queue/worker + provider CRUD endpoints | Backend Coder | vitest: default/fallback resolution, retry→fallback→FAILED path, one-default-per-channel 409, disabled-module park |
| 4 | Webhooks + logs endpoints + signature verification | Backend Coder | vitest: signature reject 401, status transitions |
| 5 | Core email.service router migration | Backend Coder | full existing test suite green (password reset E2E path included) |
| 6 | Frontend providers + logs pages | Frontend Coder | tsc exit 0; RTL: credential fields never render saved values |
| 7 | Code review (Maker ≠ Grader) | Code Reviewer | PASS, zero CRITICAL/HIGH |
| 8 | E2E: install+enable module → add SMTP provider (mailhog container) → test-send → log SENT → disable module → password reset email still works via fallback | Code Reviewer runs, Gate Verifier verifies | Playwright exit 0 (add mailhog to docker-compose for E2E only) |
| 9 | Docs: API_REFERENCE, ENV_REFERENCE (APP_ENCRYPTION_KEY), SETUP webhook URLs | Documentation | docs match code |

---

## Known Risks

- **Credentials are the crown jewels:** any log line, activity entry, or API response containing a decrypted value is a CRITICAL review finding. Reviewer must grep the send path for logging of the credentials object.
- Webhook endpoints are public: signature verification is mandatory per driver; unverifiable drivers (if any) must use a per-provider webhook secret in the URL.
- Provider APIs change: drivers tested against recorded fixtures, not live calls — E2E uses mailhog (email) only; SMS/WhatsApp live tests are manual via Test Send after real credentials are configured.
- `APP_ENCRYPTION_KEY` rotation is out of scope v1 — document that changing it orphans stored credentials (re-enter via UI).
- Never send real messages from CI — worker must refuse to process jobs when `NODE_ENV=test` unless driver is mocked/mailhog.
