# Media DAM — KDL Starter Kit
# Module 6 Design Document (Enterprise Digital Asset Management, 4 phases)

**Author:** Claude (Cowork) — approved by Prasanna (web@f9tech.com)
**Date:** 2026-07-08
**Status:** FINAL v1.0 — Implementation-ready. Supersedes MEDIA_PRO_ARCH.md (built 2026-07) — this builds ON TOP of it; nothing is rebuilt.
**Mode:** 24/7 unattended — Auto-Approval Protocol applies (`.agents/USER_MANAGEMENT_ARCH.md`).
**Goal:** no KDL project ever needs another media package. Assign each PHASE as a separate Paperclip task, in order A → B → C → D. Each phase ends fully shippable.

---

## Read Scope (TOKEN RULE — read ONLY your phase + step sections)

| Working on | Read |
|---|---|
| Phase A step N | Phase A intro + that step's row + referenced schema blocks |
| Phase B step N | Phase B intro + that step's row + Sharing/Workflow schema |
| Phase C step N | Phase C intro + that step's row + Processing Rules |
| Phase D step N | Phase D intro + that step's row + AI Rules |
| Review/E2E steps | whole relevant phase + Known Risks |

Base facts (all phases): media module already has folders, sharp variants worker (`media` queue), trash/restore/purge, usage guard, bulk delete/move, settings-driven MIME whitelist, MeiliSearch + ChromaDB + BullMQ + ai-services already in the stack.

---

## Already built (do NOT rebuild — extend)

Folders/tree/move/rename • multi-file upload • image variants (thumb/small/medium/large webp) • metadata (title/alt/caption/width/height) • MediaType enum • soft delete + trash + purge • usage tracking + 409 guard • bulk delete/move • MediaPicker component • presigned URLs on read.

---

# PHASE A — DAM Foundations (search, metadata, organization, ingest, security)

### Schema additions (`core.prisma` extensions + new models)

```prisma
model MediaTag        { id, name @unique, created_at; media MediaTagPivot[] }
model MediaTagPivot   { media_id, tag_id  @@id([media_id, tag_id]) }
model MediaMetaField  { id, slug @unique, label, field_type (TEXT|NUMBER|DATE|SELECT), options Json?, is_system }  // admin-defined custom fields: project, client, campaign, copyright, license...
model MediaMetaValue  { media_id, field_id, value String  @@id([media_id, field_id]) }
model MediaCollection { id, name, created_by, is_smart Boolean, rules Json?  }   // smart = saved search rules, evaluated live
model MediaCollectionItem { collection_id, media_id @@id([collection_id, media_id]) }
model MediaFavorite   { user_id, media_id, created_at @@id([user_id, media_id]) }
```

Media additions: `exif Json?`, `checksum String?` (sha256 — dedupe detection), `scanned_at DateTime?`, `scan_result String?` (CLEAN|INFECTED|SKIPPED), `last_used_at DateTime?`.

### Steps

| # | Task | Gate |
|---|---|---|
| A1 | Schema + migration + expanded MIME whitelist defaults (images incl. svg/heic/avif, video mp4/mov/mkv/webm/avi, audio mp3/wav/aac/ogg/flac, docs pdf/office/txt/csv, design psd/ai, archives zip). SVG sanitized on upload (strip scripts). EXIF extraction (sharp metadata + exifr) into `exif`; GPS/camera parsed | prisma clean; vitest: svg sanitize, exif parse |
| A2 | Tags + custom meta fields + values: admin CRUD `/api/media/meta-fields` (`media:edit`), tag/untag + bulk-tag endpoints, PATCH media accepts tags[] + meta{} | vitest CRUD + bulk |
| A3 | **Search engine:** index media into MeiliSearch (`media` index: name, title, alt, caption, tags, meta values, folder path, type, owner, dates, size, exif camera/gps, later ocr_text/transcript fields). Reindex on every mutation (queue job). `GET /api/media/search?q=&filters=` with facets (type, tag, folder, owner, date, size range). Uses scoped MEILI search key | vitest: index doc shape; curl: faceted search |
| A4 | Collections + smart collections (rules = saved filter json evaluated at read), favorites, recents (`last_used_at` touched on picker-select/download) — endpoints + MediaPicker tabs (All / Recent / Favorites / Collections) | vitest rules eval; tsc |
| A5 | File ops: copy/duplicate (new object + row, checksum dedupe warning), archive flag, folder upload (webkitdirectory), **chunked+resumable upload** (tus-node-server or chunk endpoints: init/part/complete, 50MB+ files), ZIP import (unpack server-side into folder, each entry re-validated vs whitelist), URL import (fetch server-side, size cap, MIME re-check) | vitest: chunk assembly, zip entry validation, url import caps |
| A6 | **Virus scan:** clamav docker service (docker-compose, dev profile optional) + `media-scan` queue: every upload scanned async; INFECTED → quarantine (soft-delete + flag + notify admins via notify() if notifications enabled, dynamic import try/catch); `media.require_scan` app_setting (default false in dev, true in prod) blocks serving unscanned files when on | vitest: EICAR fixture → quarantine path (mock clamd) |
| A7 | **Storage drivers:** refactor storage.service.js to driver interface (put/get/delete/presign/stat). Drivers: `minio` (current), `s3` (aws-sdk v3), `r2` (s3 driver + custom endpoint). Active driver via env `STORAGE_DRIVER`. Local = minio (already local) | vitest: driver contract tests (mocked SDKs); existing suite green |
| A8 | Frontend: search bar with facet filters, tag chips + tag manager, custom-field editor in detail drawer, collections/favorites/recents views, chunked upload UI with progress+resume, drag-drop folder upload, clipboard paste upload | tsc; RTL: search facets, resume flow |
| A9 | Review → E2E (upload 60MB chunked+resume, zip import, tag+meta search hit, smart collection, quarantine flow) → docs | PASS + Playwright exit 0 |

---

# PHASE B — Delivery, Sharing, Workflow, Versioning

### Schema additions

```prisma
model MediaShare { id, media_id?, folder_id?, token @unique, password_hash?, expires_at?, max_downloads Int?, download_count Int @default(0), created_by, revoked Boolean }
model MediaVersion { id, media_id, version Int, path, size, checksum, created_by, note?, created_at  @@unique([media_id, version]) }
enum MediaWorkflowStatus { DRAFT REVIEW APPROVED PUBLISHED REJECTED EXPIRED ARCHIVED }
model MediaComment { id, media_id, user_id, body, created_at }
```

Media additions: `workflow_status MediaWorkflowStatus @default(PUBLISHED)` (default published = zero friction for non-workflow projects; `media.workflow_enabled` app_setting turns gating on), `published_at`, `expires_at DateTime?` (auto-EXPIRED by daily job → excluded from picker/serving).

### Steps

| # | Task | Gate |
|---|---|---|
| B1 | Schema + migration + **extended permission actions** for media module: register additional actions `download`, `share`, `approve` (permissions.action is free string — seed idempotently; matrix UI already renders per-module actions dynamically — verify, else extend) | prisma clean; matrix shows 8 actions |
| B2 | **Transform API:** `GET /api/media/:id/t?w=&h=&fit=&q=&format=(webp|avif|jpg|png)&blur=&gray=` — sharp on the fly, result cached to `cache` bucket (key = id+params hash) + `Cache-Control: public, max-age=31536000, immutable`; signed variant for private files. This endpoint is CDN-ready: any CDN (Cloudflare) in front caches by URL | vitest: param validation, cache hit path; curl: webp/avif bytes |
| B3 | Responsive helper: `GET /api/media/:id` returns `srcset` block (transform URLs at 400/800/1200/1600) — frontend `<MediaImage>` component (lazy loading, webp/avif source set) replaces raw img usage in admin | tsc; RTL |
| B4 | **Sharing:** create/revoke share links (media or folder): public, password (bcrypt), expiry, download limit; public resolver route `GET /share/:token` (no auth, rate-limited, counts downloads, 410 on expiry/limit/revoked); QR (server-generated png), embed snippet; email/WhatsApp share = share URL handed to integrations dispatch if enabled (dynamic import) | vitest: all guard combos (password/expiry/limit/revoked) |
| B5 | **Versioning:** re-upload onto media id → new MediaVersion row (old object kept), list/compare (side-by-side URLs)/restore version; comments on media; storage accounting per version | vitest: version chain, restore |
| B6 | **Workflow:** status transitions (DRAFT→REVIEW→APPROVED/REJECTED→PUBLISHED→EXPIRED/ARCHIVED) with `media:approve` for approve/reject, `media:publish` for publish; unpublished files excluded from picker + share + transform for non-privileged users when workflow_enabled; daily expiry job | vitest: transition matrix + gating |
| B7 | Frontend: share dialog (link options + QR + embed), version history panel, comments thread, workflow badges + approve/reject buttons, transform playground in detail drawer | tsc; RTL |
| B8 | Review → E2E (share link with password+expiry honored logged-out; version restore; REVIEW file invisible to viewer role until APPROVED; transform URL serves webp) → docs | PASS + Playwright exit 0 |

---

# PHASE C — Processing Studio (image / video / audio / pdf ops)

**Processing Rules (all steps):** every op = BullMQ job on `media-processing` queue (concurrency 2, per-job timeout); destructive edits ALWAYS write a new MediaVersion (originals never lost); ffmpeg via `fluent-ffmpeg` + ffmpeg in backend Docker image (adds ~80MB — accepted); job status endpoint `GET /api/media/jobs/:id` + SSE-less polling; failures → version untouched + user notified.

| # | Task | Gate |
|---|---|---|
| C1 | Docker: ffmpeg + qpdf + tesseract in backend image; `media-processing` queue/worker skeleton + jobs endpoint | image builds; worker lifecycle tests |
| C2 | **Image ops** (sharp): crop/resize/rotate/flip, brightness/contrast/saturation, grayscale/blur/filters, text overlay + watermark (text or media-id logo, position/opacity), compress. `POST /api/media/:id/edit {ops:[...]}` → new version | vitest: op pipeline vs fixture hashes |
| C3 | **PDF ops:** merge (ids[] → new media), split (page ranges), compress (qpdf), password protect/remove, watermark, page-count/preview thumbnails (first page png via pdftoppm) | vitest per op |
| C4 | **Video:** thumbnail sprite + poster (ffmpeg), preview clip (first 5s webm), trim, compress/transcode presets (1080p/720p/480p mp4), watermark overlay, multi-resolution export; optional HLS renditions behind `media.hls_enabled` setting | vitest: ffmpeg arg builders (exec mocked); E2E smoke with tiny fixture |
| C5 | **Audio:** waveform json (peaks) + png, trim, normalize (loudnorm), format convert | vitest arg builders |
| C6 | Conversions matrix endpoint: image↔image (webp/avif/png/jpg), doc→pdf EXCLUDED v1 (LibreOffice too heavy — log as future), video→mp4/webm, audio→mp3/wav | vitest |
| C7 | Frontend **Editor:** image editor dialog (live preview via transform API params → save = edit job), pdf tools panel, video trim UI (range slider on preview), audio waveform player (wavesurfer) | tsc; RTL |
| C8 | Review → E2E (edit image → new version; merge 2 pdfs; trim video fixture; waveform renders) → docs | PASS + Playwright exit 0 |

---

# PHASE D — AI Layer (tagging, search, transcription, enhancement, imports)

**AI Rules (all steps):** ALL AI calls route through ai-services brain-router (budget-capped) or an external **ai-provider driver** (mirror integrations driver pattern: Zod credentials, encrypted via shared crypto util — coordinate: crypto.js lives in `backend/src/shared/utils/crypto.js`, move it there from integrations module if it was built inside it). Every AI feature is optional: driver unconfigured → feature hidden in UI, endpoints 501. AI results are suggestions stored like human input (tags/captions/meta) — always editable.

| # | Task | Gate |
|---|---|---|
| D1 | ai-provider driver framework + settings UI (per-feature provider select + credentials, encrypted); drivers v1: `openrouter-vision` (captioning/tagging via ai-services), `replicate` (bg-removal/upscale/enhance/object-removal), `whisper-local` optional / `openai-whisper-api` (speech-to-text) | vitest: driver contract, 501 when unset |
| D2 | **Auto-tagging + captions:** on-upload opt-in (`media.ai_autotag` setting) + manual "Analyze" — vision model → tags, title, description, alt, SEO keywords → stored as suggestions (flagged `source: ai`), MeiliSearch reindex | vitest with mocked driver; suggestion accept/reject endpoints |
| D3 | **OCR:** tesseract job for images/pdfs → `ocr_text` column → Meili index → searchable; pdf text layer extraction for born-digital pdfs | vitest fixture: search hits OCR content |
| D4 | **Speech-to-text:** audio/video → transcript (segments json + text) → stored + indexed + shown as captions panel; SRT/VTT export; optional translation via brain-router | vitest mocked; transcript search E2E |
| D5 | **Natural-language search:** embed media docs (caption+tags+ocr+transcript) into ChromaDB (`media_semantic`) via ai-services embed; `GET /api/media/search?mode=semantic&q=` → hybrid: semantic top-50 ∩ Meili filters. Frontend: search mode toggle | vitest: hybrid merger; E2E: NL query finds fixture |
| D6 | **AI image ops:** background removal, upscale 2x/4x, enhance/restore, object removal (mask from editor) — via replicate driver → new version | vitest mocked driver |
| D7 | **Recognition (OPTIONAL, default OFF):** labels/logos/landmarks/products via vision driver → tags. Face recognition explicitly EXCLUDED v1 (DPDP privacy — revisit with consent design). QR/barcode decode (zxing lib, local) | vitest |
| D8 | **Cloud imports:** Google Drive / Dropbox / OneDrive (OAuth per user, tokens encrypted; file browser → import selected), S3 bucket import (credentials → list → import), FTP import. Webcam/screen-capture/voice-recorder = frontend MediaRecorder/getDisplayMedia → normal upload (no backend work) | vitest: importer contract mocked; RTL: capture widgets |
| D9 | Review → E2E (analyze image → tags appear → NL search finds it; transcript search; bg-removal mocked driver → new version; clipboard + webcam upload) → docs | PASS + Playwright exit 0 |

---

## Explicitly OUT of v1 (log to DECISIONS.md, revisit on demand)

Face recognition (privacy) • doc→pdf conversion (LibreOffice weight) • rar/7z extraction (licensing/complexity — zip only) • fig/sketch preview (proprietary formats — stored fine) • adaptive streaming default-on (HLS behind setting) • per-file storage encryption at rest (MinIO SSE covers it — document) • merge images op.

## Known Risks

- **Scope is the risk.** Phases are firewalls: never let a Phase D idea leak into a Phase A session. Orchestrator assigns ONE phase per parent task.
- ffmpeg/tesseract/clamav grow the backend image (~200MB total) — acceptable; keep them in runner stage only.
- AI cost control: every AI job checks ai-services budget-tracker first; bulk "analyze all" endpoint requires `media:edit` + explicit confirmation param + rate cap.
- Transform API is a hot path — param whitelist strictly (no arbitrary sharp options), cache bucket lifecycle rule 90 days.
- Public share + transform endpoints are unauthenticated surfaces: rate-limit both, signed URLs for private, no folder traversal (ids only).
- MeiliSearch reindex storms on bulk ops — debounce/batch index jobs.
