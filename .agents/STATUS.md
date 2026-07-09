# Media DAM — Build Status

Last updated: 2026-07-09 (KDL-120 Phase B — Delivery, Sharing, Workflow, Versioning)

## KDL-118 Implementation Order

| Phase | Issue | Assignee | Status | Gate Evidence |
|---|---|---|---|---|
| A — DAM Foundations | KDL-119 | Backend Architect | ✅ PASS | A1–A9 complete; adversarial review (3 fixes: SVG entity-XSS, tag/meta reindex, url-import SSRF IP-pin); 80/80 frontend RTL, tsc 0; backend 500/502 (2 pre-existing D5 failures); **Playwright A9 exit 0 — 5/5** (60MB chunked+resume, zip import, tag+meta search, smart collection, EICAR→quarantine vs live clamd) |
| B — Delivery, Sharing, Workflow, Versioning | KDL-120 | Backend Coder | ✅ PASS | B1–B8 complete; 2 bugs fixed (transform.service.js used non-existent storage API → rewrote to use minio client directly; workflow_status @default(PUBLISHED) → DRAFT + migration); 51/51 Phase B backend vitest; 97/97 frontend RTL (incl. 17 new B7 tests: MediaImage, WorkflowBadge, CommentsThread, ShareDialog, VersionHistoryPanel); tsc exit 0; **Playwright B8 exit 0 — 4/4** (share+password+expiry honored unauthenticated, version restore, REVIEW invisible until APPROVED, transform→webp+immutable cache-control) |
| C — Processing Studio | KDL-121 | Backend Coder | ✅ PASS | C1–C8 complete; 411 vitest pass; tsc exit 0; Playwright 4/4 (image-edit→version, pdf-merge→new media, video-trim→version, audio-waveform→peaks) |
| D — AI Layer | KDL-122 | AI Services | 🔨 In progress (D1–D4 done, D5–D9 pending) | 453/453 backend vitest pass (D1 driver, D2 analyze/suggestion, D3 OCR, D4 transcribe suites); 1 pre-existing unrelated failure (auth.controller.test.js — missing DATABASE_URL in test env, not caused by Phase D); frontend tsc exit 0; migrations applied |

### Phase D progress (KDL-122)

- **D1 — done.** `ai-provider` driver framework: `AiProvider` model (per-feature, encrypted credentials via shared `crypto.js`), driver registry (`openrouter-vision`, `replicate`, `whisper-local`, `openai-whisper-api`), `requireFeature(feature)` middleware → 501 when unconfigured, settings UI at `/admin/media/ai` (dynamic per-driver credential/config fields from `GET /media/ai/drivers`), sidebar nav entry under new "Media" group.
- **D2 — done.** Auto-tagging + captions: `POST /media/:id/analyze` (gated by `requireFeature('vision')`, async via the existing `processing.queue.js` job pattern) calls the vision driver, parses tags/title/description/alt/seo_keywords, stores as `MediaSuggestion` rows (`source: "ai"`, status `PENDING`). `GET /media/:id/suggestions`, `POST /media/suggestions/:id/accept|reject`. Accept applies the value onto `Media` (tags via existing `tagMedia`, title/caption/alt_text fields) and reindexes Meili; reject just flips status. On-upload opt-in via `media.ai_autotag` `AppSetting`, toggle exposed in the AI settings page (only firing the job when the setting is on AND a vision provider is active).
- **D3 — done.** OCR: `ocr_text` column on `Media`, `ocr.service.js` job (`ocr` case in processing queue) — images via tesseract CLI; PDFs try `pdftotext` text layer first (born-digital), fall back to `pdftoppm` rasterize + tesseract per page (capped at 20 pages) for scanned PDFs. `POST /media/:id/ocr` (422 for unsupported mime). `ocr_text` added to the Meili doc (`searchableAttributes` already declared it in Phase A). Local-only (tesseract/poppler in Docker runner image, per C1) — no AI provider needed, no 501 gating. Gate: 7 vitest incl. fixture asserting doc exposes `ocr_text` + index declares it searchable.
- **D4 — done.** Speech-to-text: `transcript` (segments json) + `transcript_text` + `transcript_lang` on `Media`; `ai-transcribe` processing job sends the original audio/video file to the active `speech_to_text` provider (whisper drivers accept container formats directly — no ffmpeg pre-extract). `POST /media/:id/transcribe` (501 via `requireFeature`), `GET /media/:id/transcript?format=json|srt|vtt` (download headers for subtitles). Flat text indexed under Meili's pre-declared `transcript` attribute. Frontend: captions panel + AI-suggestions panel in the media DetailDrawer, both hidden unless `/media/ai/status` reports the feature configured. Translation via brain-router deferred — no ai-services/brain-router module exists in this codebase yet (affects D5 embed too; see note below).
- **D5–D9 — not started.** Semantic search (ChromaDB), AI image ops (replicate), recognition/QR, cloud imports, final E2E review. See `.agents/MEDIA_DAM_ARCH.md` Phase D table for scope per step.
- **⚠ D5 dependency note:** the arch doc routes embeddings through "ai-services embed" and translation through "brain-router", but no such module exists in the repo (checked `backend/src/modules/` — nothing matches ai-services/brain-router). D5 will need either (a) a minimal embed driver added to the ai-provider framework (consistent with D1 pattern), or (b) an external ai-services service stood up. Leaning (a) unless the board says otherwise.

### Phase D notes / follow-ups

- `Media` has no dedicated `description`/`seo_keywords` columns — D2 maps DESCRIPTION suggestions onto the existing `caption` field and SEO_KEYWORDS onto the existing tag system (merged via `tagMedia`), rather than adding new columns. Revisit if a dedicated SEO metadata surface is needed later.
- D2 v1 only supports `IMAGE` media type for `/analyze` (422 otherwise) — video/audio captioning arrives with D4 speech-to-text.

### Gate Rule

Each phase assignee must record review PASS + E2E exit 0 in this table before the next phase starts.

---

# User Management RBAC — Build Status

Last updated: 2026-07-06 (Step 7 review — Code Reviewer)

## KDLOS-10 Implementation Order

| Step | Issue | Status | Gate Evidence |
|---|---|---|---|
| 1 | KDL-32 — Prisma schema + migrations + seeder | ✅ Complete | `prisma validate` + `prisma migrate dev` exit 0; seeder idempotent |
| 2 | KDL-34 — permission-resolver + activity-logger + requirePermission middleware | ✅ Complete | `npm test` 57 passing |
| 3 | KDL-35 — Roles + Permissions + Activity Log endpoints | ✅ Complete | `npm test` 69 passing; new files wired in `index.js` |
| 4 | KDL-36 — Users module extension (multi-role, status, soft delete, reset-password, overrides, JWT roles) | ✅ Complete | `npm test` 87 passing; `node --check` + `prisma validate` exit 0; spec fixes applied 2026-07-06 |
| 5 | KDL-37 — Replace `requireRole` call sites | ✅ Complete | `npm test` 87 passing; `node --check` + `npx prisma validate` exit 0 |
| 6 | KDL-38 — Frontend RBAC UI (PermissionMatrix, pages, usePermissions) | ✅ Complete | `tsc --noEmit` + `pnpm build` exit 0 (but see Step 7 H1: `pnpm test` red) |
| 7 | KDL-39 — Code Review | ✅ PASS (verified) | Reviewer full gate set all exit 0; Gate Verifier (KDL-67, Backend Architect) confirmed: 5/5 commands exit 0 + verdict consistency. Zero open CRITICAL/HIGH. Step 8 unblocked |
| 8 | Documentation updates | ⏳ Not started | — |
| 9 | Automated E2E gate | ⏳ Not started | — |
| 10 | KDL-40 — Drop `users.role` enum + remove `requireRole` | ⏳ Not started | — |

## Current Blockers

None. (H1 resolved via KDL-63, H1b via KDL-65; reviewer re-verified full gate set 2026-07-06; Gate Verifier KDL-67 confirmed PASS — see `.agents/REVIEW.md`.)

## Step 7 review — MEDIUM/LOW findings (logged, non-blocking)

- M1 — bcrypt hashing duplicated in `backend/src/modules/users/service.js:117,180` (local copy instead of importing `hashPassword` from auth service; rounds match at 12).
- M2 — permission cache invalidation lives in controllers, not the service layer (arch watch item wanted a single service-layer choke point; all current endpoints do invalidate correctly).
- M3 — `jwt.verify` calls missing `{ algorithms: ['HS256'] }` (`middleware/auth.js:13,34`, `modules/auth/service.js:33`) — CLAUDE.md hardening rule.
- L1 — `invalidatePermissionCache()` clears all `perm:user:*` keys on any mutation (correct superset, coarse).
- L2 — seeder ships 3 modules beyond the arch doc's 6 (`types`, `categories`, `setting-fields`) — matches real app modules; document in Step 8.
- L3 — users `resetPassword` needlessly invalidates the permission cache.

## Notes

- New Step 3 files live in `backend/src/modules/user-management/{roles,permissions,activity}/`.
- Prisma model `RbacRole` is mapped to the `roles` table because the legacy `Role` enum still occupies the identifier.
- Permission cache invalidation is implemented in the controllers (users/roles/permissions) via `invalidatePermissionCache` — NOT the service layer (see M2; earlier note here claiming service-layer centralization was inaccurate).
- All mutation endpoints write activity log entries via `writeActivityAsync` with PII scrubbing.
