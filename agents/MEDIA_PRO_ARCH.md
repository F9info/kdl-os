# Media Pro — KDL Starter Kit
# Module 3 Design Document (Upgrade of core `media` module)

**Author:** Claude (Cowork) — approved by Prasanna (web@f9tech.com)
**Date:** 2026-07-07
**Status:** FINAL v1.0 — Implementation-ready.
**Mode:** 24/7 unattended — Auto-Approval Protocol applies (`.agents/USER_MANAGEMENT_ARCH.md`).
**Type:** UPGRADE of the existing core `media` module in place (it stays `is_core`). Not a new plugin.
**Depends on:** nothing new. Can run in parallel with INTEGRATIONS_ARCH / NOTIFICATIONS_ARCH (no shared files beyond `core.prisma` — coordinate migrations via merge queue).

---

## Read Scope (TOKEN RULE — read ONLY your step's sections)

| Step | Sections |
|---|---|
| 1 | Prisma Schema Changes |
| 2 | Backend: Folders + Move/Rename, Rules |
| 3 | Backend: Variants Pipeline, Rules |
| 4 | Backend: Bulk Ops + Usage Tracking + Settings, Rules |
| 5 | Frontend |
| 6 (review) | Whole doc |
| 7 (E2E) | Implementation Order Step 7 row |
| 8 (docs) | Overview + endpoint tables |

---

## Overview

Current media module: 3 endpoints (upload/list/delete), flat storage, no processing. Target: full media manager — folder tree, move/rename, bulk operations, automatic image variants (thumbnails/resizes via BullMQ + sharp), searchable metadata, usage tracking with in-use delete protection, and a reusable **MediaPicker** component every other module uses for file selection. Storage remains MinIO via `storage.service.js` (unchanged rule); DB stores paths only, presigned URLs generated on read (existing rule).

Existing endpoints/behavior remain backward-compatible (same paths, response shapes extended, never changed).

---

## Prisma Schema Changes

**File:** `backend/prisma/schema/core.prisma` — extend Media, add:

```prisma
model MediaFolder {
  id         String   @id @default(cuid())
  name       String
  parent_id  String?
  created_by String?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  parent   MediaFolder?  @relation("FolderTree", fields: [parent_id], references: [id], onDelete: Cascade)
  children MediaFolder[] @relation("FolderTree")
  media    Media[]

  @@unique([parent_id, name])   // no duplicate names within a folder
  @@index([parent_id])
  @@map("media_folders")
}

model MediaUsage {
  id         String   @id @default(cuid())
  media_id   String
  entity     String            // "user.avatar", "blog_post.cover" — <module>.<field>
  entity_id  String
  created_at DateTime @default(now())

  media Media @relation(fields: [media_id], references: [id], onDelete: Cascade)

  @@unique([media_id, entity, entity_id])
  @@index([media_id])
  @@index([entity, entity_id])
  @@map("media_usages")
}
```

**Media model additions:** `folder_id String?` (+relation, index), `title String?`, `alt_text String?`, `caption String?`, `width Int?`, `height Int?`, `duration Int?` (video/audio seconds), `variants Json?` (`{thumb: path, small: path, medium: path, large: path}`), `type MediaType` enum (`IMAGE VIDEO AUDIO DOCUMENT OTHER` — derived from MIME on upload), `deleted_at DateTime?` (soft delete → trash).

---

## Backend

Module folder stays `backend/src/modules/media/`. All routes behind `authenticate` + `requirePermission('media', <action>)` (module already registered).

### Folders + Move/Rename (Step 2)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/media/folders` | media:view | full tree (id, name, parent_id, counts) |
| POST | `/api/media/folders` | media:add | 409 duplicate name in parent |
| PATCH | `/api/media/folders/:id` | media:edit | rename / move (change parent_id; reject moving into own descendant) |
| DELETE | `/api/media/folders/:id` | media:delete | 409 unless empty OR `?cascade=true` (cascade soft-deletes contained media, activity-logged) |
| POST | `/api/media/move` | media:edit | `{media_ids[], folder_id|null}` bulk move |
| PATCH | `/api/media/:id` | media:edit | title/alt_text/caption/original_name |

### Variants Pipeline (Step 3)

- Add `sharp` dependency. New queue `media.queue.js` + `media.worker.js` (BullMQ, follow email worker lifecycle pattern — instantiate in index.js, close on shutdown).
- On IMAGE upload: enqueue variant job → worker generates thumb 150px / small 400px / medium 800px / large 1600px (fit inside, webp, quality 80), uploads via `storage.service.js`, updates `variants` + `width`/`height`. Non-image types skip.
- Job failure: log + `variants: null` — original always usable; retry 3x with backoff.
- `GET /api/media` and `GET /api/media/:id` return presigned URLs for original + each variant.

### Bulk Ops, Search, Usage, Trash, Settings (Step 4)

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/api/media/upload` | media:add | EXTEND: accept `folder_id`, multi-file (`upload.array('files', 20)`), per-file result array |
| GET | `/api/media` | media:view | EXTEND filters: `folder_id`, `type`, `search` (name/title/alt), `date_from/to`, sort; excludes trashed |
| POST | `/api/media/bulk-delete` | media:delete | `{media_ids[]}` → soft delete; per-file 409 if used (see below) |
| GET | `/api/media/trash` | media:delete | trashed list |
| POST | `/api/media/trash/restore` | media:delete | `{media_ids[]}` |
| DELETE | `/api/media/trash/purge` | media:delete | permanent: delete MinIO objects (original + variants) + rows. Destructive — activity-logged with file list |
| GET | `/api/media/:id/usage` | media:view | where this file is used |

- **Usage tracking:** export `registerMediaUsage(media_id, entity, entity_id)` / `releaseMediaUsage(...)` from media service — other modules call these in their services (e.g. user avatar). Delete/bulk-delete of a media row with usages → 409 listing the usages (matches role-delete guard pattern).
- **Settings (app_settings keys):** `media.max_file_size_mb` (default 10), `media.allowed_mime_types` (extend whitelist: images, pdf, video mp4/webm, audio mp3/wav, doc/docx/xls/xlsx/csv, zip). `upload.js` middleware reads these (cached 60s) instead of hardcoded list. Executables always rejected regardless of settings.
- **Metadata on upload:** derive `type` from MIME; for images set width/height (sharp metadata, sync — cheap).

### Rules

- Every mutation → `writeActivity` (module `media`). Purge logs the full file list.
- MIME sniff: validate magic bytes match declared MIME for images (sharp will throw on fake images — catch → 422).
- All storage ops via `storage.service.js` — extend it with `deleteFile(path)` and `deleteFiles(paths[])` if missing; never raw MinIO client in module code.
- Folder tree depth cap: 6 levels (422 beyond). Cycle check on move.
- Zod `{body,query,params}` wrapper convention throughout.

---

## Frontend

Rebuild `app/admin/media/page.tsx` as a full manager (existing page is basic):

- Two-pane: folder tree sidebar (create/rename/delete/drag-move) + grid/list toggle of files with thumbnails (variant `thumb`), type filter chips, search box (debounced), date filter, sort.
- Multi-select (checkbox + shift-click) → bulk toolbar: move (folder dialog), delete. Trash view with restore/purge (purge behind ConfirmDialog with file count).
- File detail drawer: preview, metadata form (title/alt/caption), variant links, usage list, delete.
- Upload: drag-drop zone + button, multi-file, per-file progress, into current folder.
- **`MediaPicker` shared component** (`components/shared/MediaPicker.tsx`): dialog version of the manager (browse/search/upload/select), props `{multiple?, typeFilter?, onSelect(media[])}` — THE way all future modules pick files. Replace user avatar file input with it as the proof-of-use.
- Permission-gate buttons via `can('media:<action>')` (colon format — post-M6).

Types → `types/media.types.ts` (new file, not models.types.ts — parallel-dev rule).

---

## Implementation Order

| Step | Task | Agent | Gate |
|---|---|---|---|
| 1 | Schema changes + migration | Backend Architect → Coder | prisma validate + migrate clean |
| 2 | Folders + move/rename + metadata PATCH | Backend Coder | vitest: tree ops, cycle guard, 409s |
| 3 | sharp + media queue/worker + variants | Backend Coder | vitest: job enqueued on image upload; worker unit test with fixture image; fake-image 422 |
| 4 | Bulk ops, search filters, usage tracking, trash, settings-driven upload middleware | Backend Coder | vitest: usage 409, purge deletes objects (mock storage), settings cache |
| 5 | Frontend manager + MediaPicker + avatar integration | Frontend Coder | tsc exit 0; RTL tests for MediaPicker |
| 6 | Code review (Maker ≠ Grader) | Code Reviewer | PASS, zero CRITICAL/HIGH |
| 7 | E2E: upload image → variant urls present → create folder → move file → bulk delete → restore → usage guard 409 (avatar in use) | Code Reviewer runs, Gate Verifier verifies | Playwright exit 0 (rebuild docker images first) |
| 8 | Docs: API_REFERENCE media section, CLAUDE.md schema note | Documentation | docs match code |

---

## Known Risks

- **sharp in Docker:** needs platform-correct binary — add to backend Dockerfile deps stage; verify image build in Step 7 (E2E runs on rebuilt images, which catches it).
- Variant worker + upload race: list responses must tolerate `variants: null` (still processing) — frontend shows original as fallback.
- Purge is the only hard-delete in the system so far — keep it behind `media:delete` + ConfirmDialog + activity log with file list; never cascade from folder delete (folder cascade soft-deletes only).
- Existing avatar flow must keep working mid-upgrade — Step 5 gate includes the old auth/profile E2E scenarios.
