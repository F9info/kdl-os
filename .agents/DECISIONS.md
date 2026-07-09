# Architecture Decisions

## MEDIA-001 — doc→pdf conversion excluded in v1 (2026-07-08)

**Decision:** `doc→pdf` (Word/Excel/LibreOffice → PDF) is excluded from Phase C conversions matrix.

**Reason:** LibreOffice headless adds ~500MB to the Docker image and introduces significant complexity (sandboxing, font management, conversion reliability). The backend image already grows ~200MB from ffmpeg+qpdf+tesseract — adding LibreOffice would push it to ~700MB+, violating the image-size budget accepted in the arch doc.

**Outcome:** `POST /api/media/:id/convert` returns 422 for unsupported conversion pairs. The conversions matrix documents this as "doc→pdf EXCLUDED v1". Re-evaluate when/if a dedicated conversion microservice is warranted.

**Log:** Recorded as required by MEDIA_DAM_ARCH.md Phase C step C6.

## MEDIA-002 — Face recognition excluded in v1 (2026-07-08)

**Decision:** Phase D7 recognition ships labels/logos/landmarks/products + QR/barcode only. Face recognition is excluded from v1.

**Reason:** DPDP (India Digital Personal Data Protection Act) treats biometric/facial data as sensitive personal data requiring explicit consent design, retention policy, and deletion workflows — none of which exist in v1. Revisit with a consent-first design if demanded.

**Log:** Required by KDL-122 issue scope ("Face recognition EXCLUDED v1 (DPDP privacy)").

## MEDIA-003 — rar/7z extraction excluded in v1 (2026-07-08)

**Decision:** Archive ingestion supports zip only (`POST /api/media/import/zip`). rar and 7z are excluded from v1.

**Reason:** rar decompression requires non-free unrar licensing; 7z adds a native dependency (p7zip) to the backend image for a marginal use case. Zip covers the dominant workflow.

**Log:** Required by KDL-122 issue scope ("rar/7z extraction — log to DECISIONS.md").

## MEDIA-004 — D5 embeddings via a minimal `openai-embeddings` ai-provider driver, not "ai-services"/"brain-router" (2026-07-09)

**Decision:** Phase D5 natural-language search embeds media docs via a new `openai-embeddings` driver added to the existing `ai-provider` framework (feature `embeddings`, method `embed`), not through an "ai-services" embed call or a "brain-router" translation layer as literally worded in `MEDIA_DAM_ARCH.md`'s D5/D4 rows.

**Reason:** No `ai-services` or `brain-router` module exists anywhere in this codebase (`backend/src/modules/` has no match for either name) — the arch doc's wording assumed infrastructure that was never built. D1–D4 already established a working, tested pattern for per-feature AI providers (`AiFeature` enum + `AiProvider` model + driver registry keyed by feature/method + `requireFeature()` 501 gate). Extending that same pattern with a 5th feature (`embeddings`) and 5th driver (`openai-embeddings`, hitting any OpenAI-compatible `/embeddings` endpoint via configurable `base_url` — so OpenRouter or a self-hosted endpoint work too) reuses proven code instead of introducing a new, unbuilt subsystem for one feature.

**Outcome:** `AiFeature` enum gained `EMBEDDINGS` (migration `20260709054618_add_embeddings_ai_feature`). `openai-embeddings` driver lives at `backend/src/modules/media/ai/drivers/openai-embeddings.js`, registered in `drivers/index.js`. `media-semantic.service.js` embeds `caption+tags+ocr_text+transcript_text` into a `media_semantic` Chroma collection via `runEmbedJob` (the `ai-embed` processing-job case), enqueued by `enqueueEmbed()` alongside every Meili reindex call site. `GET /api/media/search?mode=semantic&q=` resolves the active `embeddings` provider (501 if none, same shape as `requireFeature()`), then hybrid-merges Chroma top-50 with Meili-filtered hits via `mergeHybrid()`, preserving semantic rank order. Frontend search bar gained a "Semantic" toggle, shown only once `GET /media/ai/status` reports `embeddings.configured`. Translation-via-brain-router (mentioned in the D4 row) remains out of scope — no such layer exists; revisit only if a dedicated NLP-ops module is built.

**Log:** Resolves the "⚠ D5 dependency note" carried in `.agents/STATUS.md` since D4. Required by KDL-122 D5.

## MEDIA-005 — D6 object-removal mask is a pre-uploaded image URL; no in-browser mask editor in v1 (2026-07-09)

**Decision:** `POST /api/media/:id/ai-image-op` (op `object-removal`) takes `mask` as a URL string pointing to an already-uploaded mask image, not raw mask pixel data or a canvas payload. The frontend AI Image Edits panel ships only the three ops that need no mask (`bg-removal`, `upscale`, `enhance`) in v1; no mask-drawing canvas was built.

**Reason:** The arch doc's "object removal (mask from editor)" implies a paint/lasso tool in the Phase C image editor to produce the mask. Building that UI (canvas painting, brush size, undo, export-to-PNG-with-alpha) is a substantial frontend feature on its own and wasn't warranted to unblock the backend contract. The backend accepts a mask URL so the feature is fully usable today via any client that can produce and upload a mask image (e.g. a future editor tool, or an external mask asset) — `runImageOpJob` already 422s if `object-removal` is requested without a `mask`.

**Outcome:** Backend: `POST /:id/ai-image-op` gated by `requireFeature('image_ops')` (501 when no `replicate` provider configured), enqueues the `ai-image-op` processing job → `runImageOpJob` → new `MediaVersion` via the same version-creation path as Phase C edits. Gate: `backend/tests/media/ai-image-ops.test.js` (8 vitest, mocked `replicate` driver — unconfigured→501, non-image→422, missing-mask→422, success→new version, download-failure→error). Frontend: `AiImageOpsPanel` in the media detail drawer offers Remove background / Upscale 2x / Enhance, shown only when `/media/ai/status` reports `image_ops.configured`; object-removal is not exposed in the UI pending a mask-drawing tool.

**Log:** Required by KDL-122 D6.

## MEDIA-006 — D8 cloud imports: no target-folder picker; per-user connections; no OAuth app registered in this env (2026-07-09)

**Decision:** `backend/src/modules/media/import/` adds a 5-driver registry (`google-drive`, `dropbox`, `onedrive` — OAuth; `s3`, `ftp` — manual credentials) behind the existing `media_import_connections` table (already applied via migration `20260709063848`, unmodeled until now — see D7's STATUS.md migration note). Connections are scoped to `user_id` (no shared/admin-wide connections in v1). The file-browser UI has no "choose target KDL folder" step — imported files always land at Media root. OAuth apps for Drive/Dropbox/OneDrive are NOT registered anywhere (no client id/secret in `.env`/`.env.example` beyond commented placeholders) — the three OAuth providers report `configured: false` and stay hidden in the UI in every environment until an admin sets real app credentials, exactly like an unconfigured AI provider (`isAppConfigured()` mirrors `requireFeature()`'s 501/hidden contract).

**Reason:** Per-user scoping matches the issue text ("OAuth per user") and avoids building a connection-sharing/permission model nobody asked for. A target-folder picker is a UI nicety, not a contract requirement ("file browser → import selected") — cut to keep D8 focused on the driver contract (list/download) that D9's gate actually exercises. No real OAuth app was registered because this is a sandboxed dev/CI environment with no way to receive a provider's redirect callback from outside Docker; the redirect_uri is built from `APP_PUBLIC_URL` so a real deployment only needs to set that + the three client id/secret pairs to light the feature up — no code changes required.

**Outcome:** `POST /media/import/connections` (manual s3/ftp), `GET /media/import/oauth/:provider/start` (501 until configured) + a dedicated *unauthenticated* callback route (`import/public-routes.js`, mounted in `index.js` before the authenticated media router — the provider's redirect carries no Bearer token, so the caller's identity travels in a signed, 10-minute-TTL `state` param instead), `GET /media/import/connections/:id/files`, `POST /media/import/connections/:id/import` (downloads via the driver, lands each file through the existing `uploadMedia` pipeline — same validation/variants/scan/reindex/embed hooks as a normal upload). Frontend: `/admin/media/import` page (connection list, manual-connection form, OAuth "Connect" buttons, file-browser modal with folder drill-down + multi-select). `WebcamCaptureButton`/`ScreenCaptureButton`/`VoiceRecorderButton` (`CaptureWidgets.tsx`) cover the MediaRecorder/getDisplayMedia half of D8 — pure frontend, produce a `File`, upload through the exact same mutation as any other file. Gate: `backend/tests/media/cloud-import.test.js` (33 vitest — driver registry contract, fetch-mocked OAuth drivers, AWS-SDK-mocked S3, `basic-ftp`-mocked FTP, connection CRUD, 501-when-unconfigured, state tamper/expiry, import→uploadMedia); `frontend/tests/rtl/regression/CaptureWidgets.test.tsx` (6 RTL tests, mocked `MediaRecorder`/`getUserMedia`/`getDisplayMedia`).

**Log:** Required by KDL-122 D8.

## MEDIA-007 — D9 findings: fixed a real D5 bug, logged two pre-existing gaps outside Phase D scope (2026-07-09)

**Decision:** The D9 consolidated Playwright E2E gate (`frontend/e2e/media-ai.spec.ts`, run against an isolated docker-compose stack — see below) surfaced one real bug in Phase D code, fixed here, and two pre-existing gaps in Phase A/B code that are logged but explicitly NOT fixed as part of D9.

**Findings:**
1. **Fixed** — `backend/src/modules/media/ai/schema.js`'s `createAiProviderSchema` `featureEnum` was `['vision', 'image_ops', 'speech_to_text']` — D5 added the `embeddings` `AiFeature` (MEDIA-004) but never updated this enum, so `POST /media/ai/providers` 422'd for every embeddings provider ever since D5 landed. Undetected because D5's vitest suites only exercise `ai-provider.service.js`/`media-semantic.service.js` directly, bypassing controller-level Zod validation. Fixed by adding `'embeddings'`; locked in with a new `backend/tests/media/ai-schema.test.js`.
2. **Logged, not fixed** — `POST /media/upload`'s response returns the raw `uploadMedia()` Prisma record, whose `url` column is always `null` (per `service.js`'s own convention: URLs are generated on demand by `getFileUrl()`, never stored — see the "Never store MinIO presigned URLs" rule in `CLAUDE.md`). `GET /media/:id` correctly attaches a fresh presigned `url`; the upload response does not. This predates Phase D entirely (`controller.js`'s `uploadMedia` route handler has never enriched the response) and is unrelated to the AI layer — out of scope for a Phase D review. `frontend/e2e/media-pro.spec.ts` (KDL-87) asserts `media.url` truthy on upload and fails on a freshly-seeded stack; it wasn't touched here.
3. **Logged, not fixed** — a brand-new MeiliSearch instance needs `POST /media/search/reindex` (or any call to `configureMediaIndex()`) run once before its `media` index has an explicit `primaryKey`; without it, the first-ever `addDocuments` call lets Meili *infer* a primary key, which fails outright on the `Media` doc shape (`id` + `owner_id` both look like id fields) and — worse — if that failed attempt still auto-creates the index, every later add silently no-ops search for that install until someone deletes and recreates the index. This is a deploy/bootstrap gap in Phase A/B (`media-search.service.js`), not a Phase D regression; `media-ai.spec.ts`'s `beforeAll` now calls the reindex endpoint once as a workaround for its own isolated stack.

**Environment note:** D9's Playwright run required an environment call: this workspace's checkout (`origin` → `F9info/kdl-os`, tracking KDL-122) is a **different, diverged clone** of the same "KDL Starter Kit" template from another docker-compose stack found already running on the host (`kdl-starter-kit` project, `kdl` remote → `kalamdreamlabs/kdl-starter-kit`, HEAD tracking unrelated issues KDL-132/133, with its own uncommitted WIP). Rather than touch that foreign stack's containers, DB, or files, D9 stood up a fully isolated stack — `docker-compose.e2e.yml` (project name `kdl122e2e`, host ports offset to the 13000–19000 range, reuses the same `repo-backend`/`repo-frontend` images built for this checkout) — seeded it fresh, and pointed vision/whisper/replicate/embeddings at a small local stub HTTP server (`frontend/e2e/helpers/ai-stub-server.ts`, reachable from the backend container via `host.docker.internal`) since no real provider credentials exist here. Cloud-import (D8) was verified against the *real* MinIO instance in that same isolated stack (S3-compatible, no stub needed). `docker-compose.e2e.yml` is kept in the repo for future E2E runs; the isolated stack itself was torn down after the gate went green (twice, for idempotency).

**Log:** Required by KDL-122 D9 ("Review → E2E ... → docs").
