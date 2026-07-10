# KDL Starter Kit — Task Package: Media DAM Fixes & Enhancements

**Owner:** PaperclipAI (engineer)
**Source of truth:** `MEDIA_DAM_QA_FINDINGS_paperclipai.md` (repo root) — full repro steps + console errors.
**Env:** `http://localhost:3001` · login `admin@kdl.com / Admin@123` · MinIO on :9002.
**Areas:** `frontend/src/app/admin/media/` · `backend/src/modules/media/`

## Working agreement (per CLAUDE.md — non-negotiable)
- **Maker ≠ Grader** — the agent that writes a fix does not sign off its own gate; verify via exit codes / a second pass, never self-assessment.
- Reproduce the bug **before** fixing; verify the exact **Gate** **after**.
- Conventions: Zod validation; `successResponse`/`errorResponse`; singleton Prisma from `config/database.js`; all file I/O via `storage.service.js`; slow work via BullMQ (worker must be **instantiated** in `index.js`, not just exported); RBAC via `requirePermission`; no raw `fetch` on frontend (use `lib/axios.ts`); `writeActivityAsync` for mutations.
- Do **not** regress the "Confirmed working" list in the findings doc.
- On completion write `tasks/engineer_output.md` + update `.agents/HANDOFF.md` and `STATUS.md`.

**Priority order:** P0 → P1 → P2. Ship P0 first for review before starting P2.

---

## P0 — Critical (do first)

### KDL-MEDIA-01 — Image editor must actually apply edits
**Problem:** `POST /api/media/:id/edit` returns 202 ("Edit job started") but crop/resize/rotate never modify the file (dimensions/thumbnail/size unchanged after job + reload).
**Do:**
- Trace the edit job: confirm the edit worker is **instantiated** in `index.js`, consumes the queue, applies ops (sharp) to the stored object via `storage.service.js`, regenerates variants, and updates the `Media` row (size, width, height, `variants`).
- Surface job outcome: on failure write a record/log (never fail silently); on success the client refreshes the file.
**Files (expect):** `backend/src/modules/media/image-ops.service.js`, `processing.service.js`, `processing.queue.js`, `media.worker.js`, `backend/src/index.js`, frontend edit modal component.
**Gate:** Upload a 1200×800 image → crop to 600×800 → Save → after job + reload the file is **600×800** with a cropped thumbnail and changed byte size. Repeat for Resize (e.g. 400×300) and Rotate 90 (→ 800×1200). Add/extend a worker test that asserts the output row is updated. `vitest` exit 0.

### KDL-MEDIA-02 — "Cloud" toolbar button crashes the whole Library page
**Problem:** Clicking **Cloud** throws `TypeError: …map is not a function` (in `app/admin/media/page-*.js`) and white-screens the route; no error boundary.
**Do:** Guard the cloud connections/providers `.map()` with a default `[]` + loading/empty state (the standalone Cloud Imports page already works — reuse its data shape). Add an **error boundary** around the media route so one fault can't blank the page.
**Files (expect):** media Library page + cloud modal component; a new `error.tsx` boundary under `app/admin/media/`.
**Gate:** Click **Cloud** → the import picker opens, no white screen, **no** console exception. Force the data to `undefined`/`{}` in a test/mock → component still renders empty state.

---

## P1 — High

### KDL-MEDIA-03 — File preview / lightbox
**Problem:** Clicking a file only selects it; double-click does nothing; no way to view the actual file except a tiny side-panel thumbnail.
**Do:** Add a preview/lightbox opened by click (or an explicit preview action) showing the real file — full image for images; suitable viewers for video/audio/pdf/other — with filename + basic info.
**Gate:** Click an image → full preview opens showing the image; a video/pdf shows an appropriate viewer; close returns to grid.

### KDL-MEDIA-04 — Interactive crop tool + live preview in editor
**Problem:** Crop is numeric-only (no drag box); editor preview is static (doesn't reflect queued ops).
**Do:** Add a draggable crop selection over the image and a **live preview** that updates on every option change (crop/resize/rotate/flip/adjustments). On Save, the output matches the preview (depends on KDL-MEDIA-01).
**Gate:** In the editor, drag a crop box → preview updates live to show the crop; Save → stored file matches the preview.

### KDL-MEDIA-05 — Search box must filter
**Problem:** Typing in "Search media…" filters nothing and fires no request.
**Do:** Wire the box (debounced) to filter results — via a `q`/`search` param on `GET /api/media` or client-side — mirroring the working type/tag dropdown filters.
**Gate:** Type a matching term → grid narrows to matches; type a non-matching term → empty state; clearing restores results.

### KDL-MEDIA-06 — Restore from Trash
**Problem:** No "Restore" action anywhere for trashed files; only destructive "Purge all" + per-file "Delete".
**Do:** Add **Restore** (clear `deleted_at`, e.g. `PATCH /api/media/:id/restore`) and **Delete permanently** (single-file purge) for trashed items; hide Edit/Share/metadata-edit while trashed. `writeActivityAsync` on restore/purge.
**Gate:** Delete a file → Trash → **Restore** → file reappears in All files and is gone from Trash. Backend test covers restore + ownership. `vitest` exit 0.

### KDL-MEDIA-11 — Per-user & shared media (access scoping) *(feature)*
**Problem:** `listMedia(userId, query)` never filters by `user_id` → every user sees everyone's files; no private/shared concept.
**Do:**
- **Schema:** add `visibility` enum `PRIVATE | SHARED` (default `PRIVATE`) to `Media` (or `is_shared` bool). Migrate existing rows deliberately (document choice). `npx prisma migrate dev` clean; `prisma validate` exit 0.
- **Backend:** scope `listMedia` to `WHERE (user_id = :current OR visibility='SHARED')`; Super Admin bypass; add `scope` param `mine|shared|all` (`all` admin-only). Enforce owner-or-admin on edit/delete/share of PRIVATE files.
- **Frontend:** **My Media / Shared / All(admin)** tabs wired to `scope`; a Private⇄Shared toggle in the detail panel; show current visibility.
**Gate:** As a normal user, only own + shared files are listed; toggling a file to Shared makes it visible to a second user; a normal user cannot mutate another user's private file (403); Super Admin sees all. Distinct from the public `/share/:token` link feature (leave that intact). Tests cover the scope query + ownership. `vitest` exit 0.

---

## P2 — Low / polish

### KDL-MEDIA-07 — "Folder" toolbar button is a dead no-op
**Do:** Make the toolbar **Folder** button open the same "New folder" dialog as the Folders-panel ＋ icon (or remove it).
**Gate:** Click toolbar **Folder** → New folder dialog opens → create → folder appears.

### KDL-MEDIA-08 — "Recents" tab always empty
**Do:** Populate Recents from recently uploaded/accessed media, or remove the tab if out of scope (document decision).
**Gate:** Upload/open a file → it appears under **Recents**.

### KDL-MEDIA-09 — Dashboard "Media Files" stat shows "—"
**Do:** Wire the stat to a real count (e.g. `GET /api/media/stats` or list `count`).
**Gate:** Dashboard shows the actual media file count.

### KDL-MEDIA-10 — Favorite star has no visual feedback
**Do:** Reflect favorited state on the star (filled) after toggle; make star **and** "Favorite" label clickable.
**Gate:** Toggle favorite → star fills immediately and persists on reopen; file shows in Favorites.

---

## Out of scope (noted, not assigned here)
- `GET /api/settings/media.ai_autotag` → 404 (missing setting key).
- `GET /api/notifications/stream` (SSE) → 429 (rate-limited) — not part of the media module.

## Definition of done (whole package)
- Every Gate above passes (verified by a second/grader pass, not the maker).
- No regressions to the "Confirmed working" list.
- `tasks/engineer_output.md`, `.agents/HANDOFF.md`, `STATUS.md` updated.
