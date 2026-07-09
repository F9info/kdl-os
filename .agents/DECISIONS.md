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
