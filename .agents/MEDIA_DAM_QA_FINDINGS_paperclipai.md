# Media DAM — QA Findings & Fix Handoff (for PaperclipAI)

**Tested:** 2026-07-10 · **Env:** `http://localhost:3001` · **User:** admin@kdl.com (Super Admin)
**Scope:** Full Media module — Library, Collections, Favorites, Recents, Trash, AI Providers, Cloud Imports, file preview, image editor, per-user/shared access scoping.
**Method:** Manual browser QA with network + console inspection.

The Media DAM has a solid foundation — upload, variant generation, metadata, sharing, folders, collections, tags, filters, soft-delete and presigned URLs all work. But several core DAM features are broken or missing, listed below by severity. Each has repro steps and the expected behaviour.

---

## HANDOFF PROMPT (paste this to PaperclipAI)

> You built the Media DAM for the KDL Starter Kit (`frontend/src/app/admin/media/` + `backend/src/modules/media/`). A QA pass found the defects below, plus one required feature (per-user vs shared media). Fix/implement all of them. For each: reproduce it first, make the change, then verify the exact "Expected" behaviour in the browser at `http://localhost:3001` logged in as `admin@kdl.com / Admin@123`. Do not regress anything under "Confirmed working". Follow `CLAUDE.md` conventions (Zod validation, `successResponse`/`errorResponse`, singleton Prisma client, `storage.service.js` for all file I/O, BullMQ for slow jobs, RBAC via `requirePermission`, no raw `fetch` on the frontend). The most important items are the **image editor actually applying edits**, a **file preview/lightbox**, and **per-user / shared media scoping**. Report back with a per-item status and the files you changed.

---

## Defects

### 1. 🔴 CRITICAL — Image editor accepts edits but never applies them (crop / resize / rotate all no-op)
- **Repro:** Open any image → **Edit image (crop, resize, rotate…)** → add an op (e.g. Crop Left 0, Top 0, Width 600, Height 800; or a Resize, or Rotate 90) → **Save**.
- **Result:** Toast says *"Edit job started: NNN"* and `POST /api/media/:id/edit` returns **202** — but the file is **never modified**. After the job and a full reload the file is still the original dimensions (e.g. **1200×800** after a 600×800 crop) with the original thumbnail and the same byte size. Tested crop **and** rotate — neither applies.
- **Expected:** After Save, the queued ops are actually applied to the stored file (via `storage.service.js`), the variants are regenerated, and the new dimensions/thumbnail/size are reflected in the UI once the job completes.
- **Fix hints:**
  - The `/edit` endpoint enqueues a job (202) but the worker either isn't running, is erroring silently, or isn't persisting the result. Check that the edit worker is **instantiated** in `index.js` (defining a Worker export isn't enough — mirror the email/media worker pattern), that it writes the output through `storage.service.js`, updates the `Media` row (dimensions/size/variants), and logs/records failures instead of failing silently.
  - There's no completion feedback in the UI — the client should poll or refresh the file after the job and surface job failure. Right now the user gets a "started" toast and nothing ever changes, which reads as "broken."

### 2. 🔴 CRITICAL — "Cloud" toolbar button crashes the entire Library page
- **Repro:** Media → Library → click the **Cloud** button in the top toolbar.
- **Result:** Whole page white-screens: *"Application error: a client-side exception has occurred."* Full reload needed to recover.
- **Console error:**
  ```
  TypeError: (intermediate value)(...).map is not a function
    at ej (…/app/admin/media/page-*.js)
  ```
- **Likely cause:** the Cloud modal calls `.map()` on cloud connections/providers before they load, or on a value that isn't an array. The standalone **Cloud Imports** page works fine (`GET /api/media/import/connections` + `/providers`, both 200 arrays), so the toolbar modal is reading a different/unshaped value.
- **Expected:** Cloud opens the import picker without crashing; guard `.map()` with a default `[]` + loading/empty state. Also wrap the media route in an **error boundary** so one component fault can't blank the whole page.

### 3. 🟠 HIGH — No file preview / lightbox
- **Repro:** In the Library grid, single-click a file, and double-click a file.
- **Result:** Single-click only **selects** it (checkbox + bulk bar). Double-click does **nothing**. The only way to see the file larger is the small thumbnail in the side detail panel, or opening a raw variant URL in a new tab. There is no proper preview experience.
- **Expected:** Clicking (or a dedicated preview/eye action) opens a **preview/lightbox** that shows the actual file — full image for images, and an appropriate viewer for video/audio/pdf/other types — with filename and basic info. This is a baseline DAM expectation and the user specifically asked for it.

### 4. 🟠 HIGH — No interactive crop tool + no live preview in the editor
- **Repro:** Open the **Edit image** modal and add ops.
- **Result:** (a) The crop UI is **numeric inputs only** (Left / Top / Width / Height) — there is no draggable/visual crop rectangle over the image. (b) The preview thumbnail on the left is **static** — it does **not** update as ops are queued, so you can't see what a crop/resize/rotate will do before saving.
- **Expected:** An interactive crop tool (drag a selection box on the image) plus a **live preview** that updates on every option change, so the user sees the result before applying. On Save the file is updated to match the preview (see Defect 1). The user explicitly wants: a crop tool, live preview on any change, and the file updated per the chosen options.

### 5. 🟠 HIGH — Search box does nothing
- **Repro:** Media → Library → type anything (e.g. `zzznomatch`) in **"Search media…"**.
- **Result:** Results aren't filtered and **no network request fires**. The input is dead.
- **Expected:** Typing filters the grid (debounced), client-side or via a `q`/`search` param on `GET /api/media`; a non-matching query shows an empty state.
- **Note:** The **type** and **tag** filter dropdowns both work — only free-text search is broken. Wire it the same way.

### 6. 🟠 HIGH — No way to restore a file from Trash
- **Repro:** Delete a file (→ Trash) → open **Trash** → select the file.
- **Result:** The panel shows the same actions as a live file (Edit / Share / Save metadata / "Delete file"). There is **no "Restore" action anywhere** (the word `restore` isn't in the DOM). Only **"Purge all"** (destructive) and a per-file "Delete file" exist.
- **Expected:** A trashed file offers **Restore** (clear `deleted_at`) and **Delete permanently** (single-file purge). Hide Edit/Share/metadata-edit for trashed items. Expose/confirm a restore endpoint (e.g. `PATCH /api/media/:id/restore`).

### 7. 🟡 MEDIUM — "Folder" toolbar button is a dead no-op
- **Repro:** Media → Library → click **Folder** in the top toolbar.
- **Result:** Nothing happens — no dialog, no request, no console output.
- **Working alternative:** the **＋ icon** in the "Folders" side-panel header opens the "New folder" dialog (`POST /api/media/folders` → 201).
- **Expected:** The toolbar "Folder" button opens the same dialog (or remove it if redundant).

### 8. 🟡 MEDIUM — "Recents" tab is always empty
- **Repro:** Upload and view a file, then open the **Recents** tab.
- **Result:** *"No recent files."* even right after uploading/opening.
- **Expected:** Recently uploaded/accessed files appear, or remove the tab if not implemented.

### 9. 🟢 LOW — Dashboard "Media Files" stat shows "—"
- **Result:** The **Media Files** stat card shows a dash instead of a count; no media-count request is made.
- **Expected:** Show the real count (e.g. `GET /api/media/stats` or a `count` on the media list).

### 10. 🟢 LOW (UX) — Favorite star gives no visual feedback
- **Repro:** Open a file → click the **★ Favorite** star.
- **Result:** Works functionally (`POST /api/media/:id/favorite` → 200; file appears in **Favorites**) but the star doesn't fill/change, and only the star glyph is clickable (not the "Favorite" label).
- **Expected:** The star reflects favorited state (filled) after toggling; star + label both clickable.

---

## Required feature (not implemented) — Per-user & shared media (access scoping)

### 11. 🟠 HIGH (FEATURE) — Media is global to all users; needs "My media" vs "Shared with everyone"
- **Current behaviour (verified in code):** every `Media` row stores an owner (`user_id`, set on upload in `service.js`), **but `listMedia(userId, query)` never filters by `user_id`** — the `where` clause only covers `deleted_at`, `is_archived`, `folder_id`, `type`, dates, etc. So **every user sees every other user's files**, and there is no concept of private vs shared media. There is no "mine / shared" filter in the Library UI.
- **Required behaviour:**
  - Each user has their **own private media** (visible only to the owner).
  - A file can be **shared with all users** (visible to everyone in the workspace).
  - **Super Admin** can still see everything (bypass, consistent with the RBAC model in `CLAUDE.md`).
- **Suggested implementation:**
  - **Schema:** add a visibility concept to `Media` — e.g. `visibility` enum `PRIVATE | SHARED` (default `PRIVATE`), or an `is_shared` boolean. Migrate existing rows sensibly (e.g. keep current data as `SHARED` so nothing "disappears", or as `PRIVATE` owned by the uploader — pick and document).
  - **Backend `listMedia`:** scope results to `WHERE (user_id = :currentUser OR visibility = 'SHARED')`, with Super Admin bypassing the scope to see all. Add a `scope` / `view` query param: `mine` (owner only), `shared` (shared with everyone), and `all` (admin only). Enforce ownership on mutations (only owner or admin can edit/delete/share a private file). Log visibility changes via `writeActivityAsync`.
  - **Frontend:** add a **filter or tabs** in the Library — e.g. **My Media / Shared / All (admin)** — wired to the `scope` param, plus a control in the file detail panel to toggle a file **Private ⇄ Shared with everyone**. Reflect the current visibility on the card/detail.
- **Note:** this is distinct from the existing per-file **share link** (`/share/:token`) feature, which is public-link sharing for external recipients. This request is about **in-app visibility between logged-in users**.

---

## Confirmed working (do not regress)

- **Login** and Media navigation.
- **Upload** → `POST /api/media/upload` (201); async **variant generation** produces `thumb`, `small`, `medium`, `large` webp (BullMQ media worker); thumbnails render the real image from MinIO presigned URLs (:9002).
- **File Details** panel: metadata (title/alt/caption) **Save** → 200; type/size/dimensions shown.
- **Share / copy link**: create public link → `POST /api/media/shares` (201); public `/share/:token` page loads with preview + working Download; password / expiry / max-downloads options present.
- **Folders**: create via panel ＋ icon → 201; nested tree renders.
- **Collections**: create → `POST /api/media/collections` (201).
- **Tags**: add tag → `POST /api/media/tag` (200).
- **Custom fields** (Client) with Save fields.
- **Type** and **Tag** filter dropdowns filter correctly.
- **Grid / List** view toggle.
- **Soft delete**: confirm dialog → `DELETE /api/media/:id` (200) → moves to Trash; Trash shows count.
- **Variant links** open the correct presigned MinIO webp.
- **AI Providers** page: 4 capability tabs (Vision, Image Ops, Speech-to-Text, Embeddings), graceful empty states, working "Add Provider" modal.
- **Cloud Imports** page: OAuth providers gated until credentials set; S3/FTP connection form present.

> ⚠️ Note: the **Edit image** modal *opens* and *queues* ops fine, but the edit is never applied (Defect 1) and has no interactive crop/live preview (Defect 4) — so treat image editing as **not working** end-to-end.

## Minor observations (not blocking)
- `GET /api/settings/media.ai_autotag` returns **404** on dashboard load (missing setting key).
- `GET /api/notifications/stream` (SSE) returns **429** (rate-limited) — outside the media module but noticed during testing.
