# Admin Panel UI Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every confirmed button/CSS consistency defect found by a full audit of `/admin`, using only components/patterns that already exist in the codebase.

**Architecture:** No new design tokens. Task 1 fixes one real CSS bug (a cascade-layer border-width regression affecting every `outline`-variant Button in the app). Tasks 2-7 convert specific ad-hoc elements to the shared `Button` component, matching variant/size to already-established sibling patterns (e.g. Roles page's row-action icons).

**Tech Stack:** Next.js 15 App Router, TypeScript, TailwindCSS, shadcn/ui `Button`.

---

## Audit summary (context for every task below)

A full audit of every `/admin` screen (via 4 parallel research passes + my own targeted reads) found the codebase's admin UI is **far more consistent than raw `<button>` grep counts suggested** — most raw-looking elements are legitimate custom widgets (tab strips, filter chips, selectable cards, thumbnail-overlay icons) that correctly should NOT become `<Button>`. Confirmed real findings, addressed as Tasks 1-7 below:

1. **`th-components.css`**: `.th-btn-outline`'s border-width computes to `0px` everywhere in the app (confirmed via `getComputedStyle` on the live Notifications page) — a cascade-layer bug. Tailwind's preflight ships an unlayered `*, ::before, ::after { border-width: 0 }` reset; this file already documents and fixes the identical issue for `.th-card`/`.th-table-row`/`.th-alert`/`.th-popup`/`.th-input` via unlayered override rules at the bottom of the file — `.th-btn-outline` was simply missed. This is why "Mark all read"/"Unread only" (Notifications) and "Replace Credentials"/"Test Connection" (Settings → Storage) all look like bare text with zero button chrome, despite already being real `<Button variant="outline">` elements in the source.
2. **Media toolbar**: 7 near-identical ad-hoc `<button>` elements (Folder/Cloud/Capture in `media/page.tsx`, `FolderUploadButton` in `DamExtensions.tsx`, Webcam/Screen/Voice in `CaptureWidgets.tsx`) share one exact className string that duplicates `Button variant="outline" size="sm"` — plus the neighboring `UploadZone` drop-zone has no fixed height, causing the uneven toolbar row height originally reported.
3. Two dialog close buttons (`CloudImportDialog.tsx`, `CaptureDialog.tsx`) have **zero styling at all** — no hover state, no color.
4. Theme Engine's footer Reset/Save buttons are ad-hoc, and `BrandingFileControl`'s Choose-file/Remove buttons are ad-hoc.
5. `WorkflowBadge.tsx`'s dropdown-trigger button and `media/ai/page.tsx`'s edit/delete icon buttons both already use `<Button>` but hack around a missing compact-icon size with two *different* one-off overrides (`h-6 w-6` vs `h-7 w-7`) for the same role — standardize on one value, not a new component API.
6. `page-builder/page.tsx`'s row actions (View/Edit/Delete) are ad-hoc `<a>`/`<button>` elements, where the Roles/Permissions/Projects pages already establish the exact `<Button variant="ghost" size="icon">` pattern for this role — including using the shared `ConfirmDialog` instead of native `confirm()` for the delete action, matching Roles' own delete flow exactly.

**Explicitly NOT converting (audited, confirmed correct as-is — do not "fix" these):**
- Tab/nav selectors: Theme Engine's platform tabs (Web App/TV/Android/iOS), Active Theme tabs, sidebar pane-nav, device/mode sub-tabs; `media/ai/page.tsx`'s feature tab strip; `CaptureDialog.tsx`'s Webcam/Screen/Voice tabs; `users/page.tsx`, `integrations/page.tsx`, `notifications/templates/page.tsx` tab strips.
- Filter chips/pills (`modules/page.tsx`), segmented control (`media/page.tsx` Mine/Shared/All), sortable table-column headers (`settings/categories`, `settings/types`).
- Selection tiles/cards (`WebsiteStage.tsx`, `MediaThumbnailCard`, `MediaPicker.tsx`), folder-tree rows, thumbnail hover-overlay icons (Restore/Purge/Preview/Details/Share on media grid items) — these are custom widget affordances, not page-action buttons; forcing `size="icon"` (40×40px) onto a 20-28px thumbnail overlay would make them look worse, not more consistent.
- Accordion/disclosure headers (`ImageEditorDialog.tsx`'s `Section`, Theme Engine's section-collapse).
- Input-embedded widgets (`ShareDialog.tsx`'s password eye-toggle).
- `page-builder/site/page.tsx`'s "Save and Next" button — ad-hoc, but consistent with its own sibling pattern (other buttons living inside Puck's `headerActions` slot, e.g. `insert-block-modal.tsx`'s `InsertBlockButton`, are *also* ad-hoc rather than `<Button>` — converting only this one would create a new inconsistency within Puck headers specifically, which are out of this pass's scope per the design spec).
- The various compact-icon-button gaps not listed in Task 6 (media thumbnail overlays, `FieldControl.tsx`'s remove-badge, dialog close-icons in `CloudImportDialog.tsx`'s back-arrow, `ImageEditorDialog.tsx`'s inline remove-✕) — these are real gaps (no existing Button `size` fits a ~24px control) but are not *inconsistent with themselves* today, so left alone per the design spec's "don't guess, don't force a bad fit" risk note.

---

### Task 1: Fix `.th-btn-outline`'s zero-width border

**Files:**
- Modify: `frontend/src/app/th-components.css`

- [ ] **Step 1: Add the missing unlayered border-width rule**

Add this immediately after the existing `.th-input { border: solid ...; border-width: ...; }` block (inside the "Button/input padding — UNLAYERED" comment section, which is the natural home for this — it's the exact same bug class):

```diff
 .th-input {
   border: solid var(--forms_full_border_colors_border_color, hsl(var(--input)));
   border-width: calc(var(--forms_full_border_settings_border_width, 1) * 1px);
 }
+
+/* .th-btn-outline's border-width was missed when the border-geometry rules
+   above were unlayered (KDL-213 follow-up) — Tailwind preflight's unlayered
+   `border-width: 0` reset silently zeroed it, even though the LAYERED rule
+   in the th-components block above already sets a full `border` shorthand.
+   Only border-width needs unlayering here: color/style from that layered
+   rule already render correctly once width is non-zero. */
+.th-btn-outline {
+  border-width: 1px;
+}
```

- [ ] **Step 2: Verify the fix in the browser**

Rebuild and restart the frontend container:
```bash
docker compose build frontend && docker compose up -d frontend
```

Then confirm via Playwright (adjust the login credentials/URL only if they've changed from `admin@kdl.com` / `Admin@123456` at `http://localhost:3101`):
```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(viewport={"width": 1600, "height": 1000}).new_page()
    page.goto("http://localhost:3101/login")
    page.wait_for_timeout(1000)
    page.locator('input[type="email"]').first.fill("admin@kdl.com")
    page.locator('input[type="password"]').first.fill("Admin@123456")
    page.locator('button[type="submit"]').first.click()
    page.wait_for_timeout(1500)
    page.goto("http://localhost:3101/admin/notifications")
    page.wait_for_timeout(1200)
    btn = page.get_by_role("button", name="Mark all read").first
    style = btn.evaluate("e => getComputedStyle(e).borderWidth")
    print("border-width:", style)  # expect "1px", was "0px"
    page.screenshot(path="/tmp/task1_verify.png")
    browser.close()
```
Expected: `border-width: 1px` (was `0px`), and the screenshot shows a visible border around both buttons.

- [ ] **Step 3: Spot-check the second confirmed-affected page**

Same script pattern, `page.goto("http://localhost:3101/admin/settings/storage")`, check the "Test Connection" button (or "Replace Credentials" if a credential row exists) — same `border-width: 1px` expectation.

- [ ] **Step 4: Regression check — run the existing test suites**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
cd frontend && npx vitest run
```
Expect: typecheck/lint clean; vitest all passing except the pre-existing, unrelated `tests/rtl/regression/template-engine-website-stage.test.tsx` (3 failing tests, confirmed failing before this entire feature's changes too — not something this task touches).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/th-components.css
git commit -m "fix(admin-ui): unlayer .th-btn-outline border-width (was computing to 0px)

Tailwind preflight's unlayered border-width:0 reset was silently zeroing
every outline-variant Button's border everywhere in the app (Notifications'
Mark-all-read/Unread-only, Settings->Storage's Replace-Credentials/Test-
Connection, etc.) despite the layered .th-btn-outline rule already setting
a full border shorthand. th-components.css already documented and fixed
this exact bug class for cards/tables/alerts/popups/inputs — buttons were
simply missed. One 3-line unlayered override fixes every instance at once."
```

---

### Task 2: Media toolbar — convert 7 ad-hoc buttons to the shared `Button`

**Files:**
- Modify: `frontend/src/app/admin/media/page.tsx`
- Modify: `frontend/src/components/media/DamExtensions.tsx`
- Modify: `frontend/src/components/media/CaptureWidgets.tsx`

All three files already `import { Button } from '@/components/ui/button'` — no new imports needed.

- [ ] **Step 1: `frontend/src/app/admin/media/page.tsx` — convert Folder/Cloud/Capture buttons**

```diff
                 {can('media:folders') && (
-                  <button
-                    type="button"
+                  <Button
+                    type="button"
+                    variant="outline"
+                    size="sm"
                     onClick={() => setCreateFolderOpen(true)}
-                    className="flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors"
+                    className="gap-1"
                     title="New folder"
                   >
                     <Folder className="h-4 w-4" /> Folder
-                  </button>
+                  </Button>
                 )}
                 {/* D8: cloud import + capture entry points */}
                 {can('media:cloud-import') && (
-                  <button
-                    type="button"
+                  <Button
+                    type="button"
+                    variant="outline"
+                    size="sm"
                     onClick={() => setCloudImportOpen(true)}
-                    className="flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors"
+                    className="gap-1"
                     title="Import from cloud"
                   >
                     <Cloud className="h-4 w-4" /> Cloud
-                  </button>
+                  </Button>
                 )}
                 {can('media:capture') && (
                   <>
-                    <button
-                      type="button"
+                    <Button
+                      type="button"
+                      variant="outline"
+                      size="sm"
                       onClick={() => setCaptureOpen(true)}
-                      className="flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors"
+                      className="gap-1"
                       title="Capture media"
                     >
                       <Camera className="h-4 w-4" /> Capture
-                    </button>
+                    </Button>
                     <WebcamCaptureButton
```

- [ ] **Step 2: Same file — align `UploadZone` to the toolbar's row height**

```diff
     <div
       className={cn(
-        'border-2 border-dashed rounded-lg px-4 py-2 text-center transition-colors cursor-pointer flex items-center gap-2',
+        'h-9 border-2 border-dashed rounded-lg px-3 text-center transition-colors cursor-pointer flex items-center gap-2',
         drag ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50',
         disabled && 'opacity-50 cursor-not-allowed'
       )}
```
(This is the `UploadZone` function's root `<div>`, `frontend/src/app/admin/media/page.tsx` — the JSX that renders `<Upload ... /><p>Upload</p>`.)

- [ ] **Step 3: `frontend/src/components/media/DamExtensions.tsx` — convert `FolderUploadButton`**

```diff
   return (
     <>
-      <button
+      <Button
         type="button"
+        variant="outline"
+        size="sm"
         disabled={disabled}
         onClick={() => inputRef.current?.click()}
         className={cn(
-          'flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors',
+          'gap-1',
           disabled && 'opacity-50 cursor-not-allowed'
         )}
         title="Upload folder"
       >
         <FolderIcon className="h-4 w-4" /> Upload Folder
-      </button>
+      </Button>
```
Note: `disabled` is now passed to `Button` both as the explicit prop AND still referenced inside `cn()` for the `opacity-50` class — `Button`'s own `disabled:opacity-50` CVA class already handles this, so the `disabled && 'opacity-50 cursor-not-allowed'` conditional in `cn()` is now redundant. Remove it:
```diff
-        className={cn(
-          'gap-1',
-          disabled && 'opacity-50 cursor-not-allowed'
-        )}
+        className="gap-1"
```

- [ ] **Step 4: `frontend/src/components/media/CaptureWidgets.tsx` — convert Webcam/Screen/Voice buttons**

Apply the identical transform to all three (`WebcamCaptureButton`, `ScreenCaptureButton`, `VoiceRecorderButton` — each has the exact same button markup, only the icon/label/title differ):

```diff
-      <button
+      <Button
         type="button"
+        variant="outline"
+        size="sm"
         disabled={disabled}
         onClick={openModal}
-        className={cn(
-          'flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors',
-          disabled && 'opacity-50 cursor-not-allowed'
-        )}
+        className="gap-1"
         title="Record from webcam"
       >
         <Video className="h-4 w-4" /> Webcam
-      </button>
+      </Button>
```
(Repeat for Screen — `title="Record screen"`, `<Monitor .../> Screen` — and Voice — `title="Record voice"`, `<Mic .../> Voice`. `cn` may become an unused import in this file after all three conversions — check with `grep -n "cn(" frontend/src/components/media/CaptureWidgets.tsx`; if no other usage remains, remove the `import { cn } from '@/lib/utils'` line.)

- [ ] **Step 5: Typecheck, lint, rebuild, verify**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
docker compose build frontend && docker compose up -d frontend
```
Playwright: log in, go to `/admin/media`, screenshot the toolbar. Confirm all 7 buttons (Folder, Cloud, Capture, Upload Folder, Webcam, Screen, Voice) plus the Upload drop-zone now share the same `h-9` row height and consistent icon/text gap. Click "New folder" to confirm the button still opens the create-folder modal (behavior unchanged).

- [ ] **Step 6: Run the frontend test suite**

```bash
cd frontend && npx vitest run
```
Expect the same baseline as Task 1 (all passing except the pre-existing unrelated `template-engine-website-stage.test.tsx` failures). Check specifically for any existing media test files (`grep -rl "FolderUploadButton\|WebcamCaptureButton\|Upload Folder" frontend/tests`) and confirm none of them query by the removed ad-hoc className.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/admin/media/page.tsx frontend/src/components/media/DamExtensions.tsx frontend/src/components/media/CaptureWidgets.tsx
git commit -m "fix(admin-ui): convert media toolbar's 7 duplicated ad-hoc buttons to shared Button

Folder/Cloud/Capture (media/page.tsx), FolderUploadButton
(DamExtensions.tsx), and Webcam/Screen/Voice (CaptureWidgets.tsx) all
duplicated one exact className string equivalent to
Button variant=\"outline\" size=\"sm\" — using the shared component means
future spacing/radius/hover changes reach all 7 at once instead of
needing 7 separate edits. Also fixed UploadZone's missing fixed height,
which caused the uneven toolbar row originally reported."
```

---

### Task 3: Fix two zero-styled dialog close buttons

**Files:**
- Modify: `frontend/src/components/media/CloudImportDialog.tsx`
- Modify: `frontend/src/components/media/capture/CaptureDialog.tsx`

Both dialogs render their own custom overlay (not the shared `Modal`/Radix `Dialog`, which already has a styled close button) — so this fixes the missing hover/color state directly rather than converting to shared `Button` (a `size="icon"` 40×40px box would visually mismatch these dialogs' compact inline header row; matches the established custom-panel-close idiom already used elsewhere in this codebase).

- [ ] **Step 1: `frontend/src/components/media/CloudImportDialog.tsx`**

```diff
-          <button type="button" title="Close" onClick={onClose}>
+          <button
+            type="button"
+            title="Close"
+            onClick={onClose}
+            className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
+          >
             <X className="h-4 w-4" />
           </button>
```

- [ ] **Step 2: `frontend/src/components/media/capture/CaptureDialog.tsx`**

Identical fix:
```diff
-          <button type="button" title="Close" onClick={onClose}>
+          <button
+            type="button"
+            title="Close"
+            onClick={onClose}
+            className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
+          >
             <X className="h-4 w-4" />
           </button>
```

- [ ] **Step 3: Typecheck, lint, rebuild, verify**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
docker compose build frontend && docker compose up -d frontend
```
Playwright: open Media Library, click "Cloud" to open `CloudImportDialog`, hover the close X, confirm it now visibly dims/brightens on hover (previously no visual change at all). Click it, confirm the dialog still closes. Repeat for "Capture" → `CaptureDialog`.

- [ ] **Step 4: Run the frontend test suite**

```bash
cd frontend && npx vitest run
```
Same baseline as Task 1.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/media/CloudImportDialog.tsx frontend/src/components/media/capture/CaptureDialog.tsx
git commit -m "fix(admin-ui): add missing hover/focus styling to two dialog close buttons

Both CloudImportDialog and CaptureDialog's close-X had zero className —
no hover color, no focus ring, unlike every other icon-only control in
the app. Matches the existing custom-panel-close idiom (hover color
change, no border) rather than forcing the shared Button component,
which would visually mismatch these dialogs' compact inline header row."
```

---

### Task 4: Theme Engine footer — convert Reset/Save to shared `Button`

**Files:**
- Modify: `frontend/src/app/admin/theme-engine/page.tsx`

`data-testid="btn-reset"`/`data-testid="btn-save"` are load-bearing — both `frontend/tests/rtl/regression/theme-engine.test.tsx` and `frontend/e2e/theme-engine.spec.ts` query by these exact testids and (for the RTL test) cast the result to `HTMLButtonElement` and read `.disabled`. `Button`'s underlying element is a real `<button>` (when `asChild` is unset, the default here), so both must be preserved verbatim and both continue to work identically.

- [ ] **Step 1: Add the `Button` import**

```diff
 import { Search, Save, RotateCcw, Lock } from 'lucide-react'
 import api from '@/lib/axios'
 import { toast } from '@/hooks/use-toast'
 import { cn } from '@/lib/utils'
+import { Button } from '@/components/ui/button'
 import { ModuleGuard } from '@/components/shared/ModuleGuard'
```

- [ ] **Step 2: Convert the footer buttons**

```diff
             <div className="flex gap-2">
-              <button
+              <Button
                 data-testid="btn-reset"
+                variant="outline"
+                size="sm"
                 onClick={() => resetMutation.mutate({ paneId: activePane, platform })}
                 disabled={isResetting || !activePane}
-                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
+                className="gap-1.5"
               >
                 <RotateCcw className="h-3.5 w-3.5" />
                 Reset
-              </button>
-              <button
+              </Button>
+              <Button
                 data-testid="btn-save"
+                size="sm"
                 onClick={handleSave}
                 disabled={isSaving || !activePane || (!activePaneIsDirty && !activeThemeIsDirty)}
-                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
+                className="gap-1.5"
               >
                 <Save className="h-3.5 w-3.5" />
                 {isSaving ? 'Saving…' : 'Save'}
-              </button>
+              </Button>
             </div>
```

- [ ] **Step 3: Typecheck, lint, rebuild, verify**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
docker compose build frontend && docker compose up -d frontend
```
Playwright: open `/admin/theme-engine`, select a pane, change a field, confirm Save becomes enabled and clicking it still saves (toast/dirty-indicator behavior unchanged), confirm Reset still resets the dirty field.

- [ ] **Step 4: Run BOTH the RTL suite and the e2e spec for this file specifically**

```bash
cd frontend && npx vitest run tests/rtl/regression/theme-engine.test.tsx
cd frontend && npx playwright test e2e/theme-engine.spec.ts
```
(The e2e run needs the backend+Postgres+Redis containers up, per this repo's standard e2e prerequisites — see `docs/CI_LOCAL_VERIFICATION.md` if any environment setup is needed.) Expect both fully green — these are the two suites this specific change could plausibly break.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/theme-engine/page.tsx
git commit -m "fix(admin-ui): convert Theme Engine footer Reset/Save to shared Button

Preserves data-testid=\"btn-reset\"/\"btn-save\" verbatim — both the RTL
regression test and the e2e spec query by these testids and (RTL) read
.disabled off the cast HTMLButtonElement, which Button's real <button>
output satisfies identically."
```

---

### Task 5: Theme Engine — `BrandingFileControl`'s Choose-file/Remove buttons

**Files:**
- Modify: `frontend/src/app/admin/theme-engine/controls/BrandingFileControl.tsx`

This codebase already has precedent for a leading-icon-or-thumbnail + text pattern inside `<Button>` (`frontend/src/app/admin/media/page.tsx`'s `DetailDrawer` "Share / copy link" button wraps a conditional `<Badge>` + text as children) — this conversion follows that same shape.

- [ ] **Step 1: Add the `Button` import**

```diff
 import { useState } from 'react'
 import { Upload, X } from 'lucide-react'
+import { Button } from '@/components/ui/button'
 import { MediaPicker } from '@/components/shared/MediaPicker'
```

- [ ] **Step 2: Convert both buttons**

```diff
     <span className="inline-flex items-center gap-2">
-      <button
+      <Button
         type="button"
+        variant="outline"
+        size="sm"
         onClick={() => setOpen(true)}
-        className={cn(
-          'inline-flex items-center gap-2 rounded border border-border bg-muted px-2 py-1.5 text-sm transition-colors hover:border-primary'
-        )}
+        className="gap-2"
         title="Choose file"
       >
         {hasValue && looksLikeImage(value) ? (
           // eslint-disable-next-line @next/next/no-img-element
           <img src={value} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
         ) : (
           <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-border/50 text-muted-foreground">
             <Upload className="h-3.5 w-3.5" />
           </span>
         )}
         <span className={cn('max-w-[200px] truncate', !hasValue && 'text-muted-foreground')}>
           {hasValue ? fileName(value) : 'Choose file…'}
         </span>
-      </button>
+      </Button>
 
       {hasValue && (
-        <button
+        <Button
           type="button"
+          variant="ghost"
+          size="sm"
           onClick={() => onChange('')}
-          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
+          className="gap-1 text-muted-foreground hover:text-destructive"
           title="Remove file"
         >
           <X className="h-3 w-3" />
           Remove
-        </button>
+        </Button>
       )}
```
`cn` is still used for the truncate-span's conditional class — keep that import.

- [ ] **Step 3: Typecheck, lint, rebuild, verify**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
docker compose build frontend && docker compose up -d frontend
```
Playwright: open `/admin/theme-engine`, navigate to a pane with a file/branding field (e.g. a logo field), confirm "Choose file…" still opens the MediaPicker on click and shows the thumbnail-or-icon + filename correctly, confirm "Remove" (once a value is set) still clears it.

- [ ] **Step 4: Run the frontend test suite**

```bash
cd frontend && npx vitest run
```
Same baseline as Task 1. Also check `grep -rl "BrandingFileControl\|Choose file" frontend/tests` for any test that might query the old className directly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/theme-engine/controls/BrandingFileControl.tsx
git commit -m "fix(admin-ui): convert BrandingFileControl's Choose-file/Remove to shared Button"
```

---

### Task 6: Standardize the duplicated compact-icon-button override

**Files:**
- Modify: `frontend/src/components/media/WorkflowBadge.tsx`

Both this file and `media/ai/page.tsx` already use `<Button variant="ghost" size="icon">` for a compact icon-only control, but with two different one-off size overrides for the same visual role (`h-6 w-6` here vs `h-7 w-7` in `media/ai/page.tsx:304,313`) — standardize on `h-7 w-7`, the value already used in two places, rather than adding a new Button `size` to the shared component's public API (a bigger, riskier change than this pass's approved scope).

- [ ] **Step 1: Update the className**

```diff
           <Button
             size="sm"
             variant="ghost"
-            className="h-6 w-6 p-0"
+            className="h-7 w-7 p-0"
             onClick={() => setDropdownOpen((v) => !v)}
             title="Workflow actions"
           >
             <ChevronDown className="h-3.5 w-3.5" />
           </Button>
```

- [ ] **Step 2: Typecheck, lint, rebuild, verify**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
docker compose build frontend && docker compose up -d frontend
```
Playwright: find a media item with `WorkflowBadge` rendered (check where this component is used — `grep -rl "WorkflowBadge" frontend/src/app frontend/src/components` — likely a media list/detail view with a workflow-status column), confirm the dropdown trigger still opens/closes on click and is now visually the same size as the edit/delete icon buttons on `/admin/media/ai`.

- [ ] **Step 3: Run the frontend test suite**

```bash
cd frontend && npx vitest run tests/rtl/regression/WorkflowBadge.test.tsx
```
(Confirm this exact path exists via `find frontend/tests -iname "*WorkflowBadge*"` first — if the test asserts an exact className, update its expectation to match; if it only asserts behavior/role, no test change needed.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/media/WorkflowBadge.tsx
git commit -m "fix(admin-ui): standardize WorkflowBadge's icon-button size to match media/ai's identical pattern

Both files hacked around the same missing-compact-Button-size gap with
two different one-off overrides (h-6 w-6 vs h-7 w-7) for the same
icon-only-control role. Standardized on h-7 w-7, the value already used
in 2 of the 3 occurrences, rather than adding a new Button size variant."
```

---

### Task 7: `page-builder/page.tsx` — row actions to match the Roles/Permissions pattern

**Files:**
- Modify: `frontend/src/app/admin/page-builder/page.tsx`

Matches the exact `<Button variant="ghost" size="icon">` + `ConfirmDialog` pattern already established by `frontend/src/app/admin/roles/page.tsx` (and Permissions/Projects) for row-level edit/delete actions. `Button` is already imported in this file.

- [ ] **Step 1: Add imports**

```diff
 import { useState } from 'react'
 import { useRouter } from 'next/navigation'
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
 import { Plus, Pencil, ExternalLink, Trash2, LayoutTemplate } from 'lucide-react'
 import { ModuleGuard } from '@/components/shared/ModuleGuard'
+import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
 import { Input } from '@/components/ui/input'
 import { Button } from '@/components/ui/button'
```

- [ ] **Step 2: Add delete-confirmation state (mirrors Roles' `deleteId` pattern)**

```diff
 export default function PageBuilderList() {
   const router = useRouter()
   const qc = useQueryClient()
   const [title, setTitle] = useState('')
+  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
```

- [ ] **Step 3: Update `deleteMutation` to clear `deleteTarget` on success/settle**

```diff
   const deleteMutation = useMutation({
     mutationFn: deletePage,
-    onSuccess: () => void qc.invalidateQueries({ queryKey: ['page-builder-pages'] }),
-    onError: () =>
-      toast({ title: 'Error', description: 'Could not delete page.', variant: 'destructive' }),
+    onSuccess: () => {
+      void qc.invalidateQueries({ queryKey: ['page-builder-pages'] })
+      setDeleteTarget(null)
+    },
+    onError: () => {
+      toast({ title: 'Error', description: 'Could not delete page.', variant: 'destructive' })
+      setDeleteTarget(null)
+    },
   })
```

- [ ] **Step 4: Convert the row actions**

```diff
                 <div className="flex items-center gap-1 shrink-0">
-                  <a
-                    href={`/p/${p.slug}`}
-                    target="_blank"
-                    rel="noreferrer"
-                    title="View"
-                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
-                  >
-                    <ExternalLink size={17} />
-                  </a>
-                  <button
-                    onClick={() => router.push(`/admin/page-builder/${p.id}`)}
-                    title="Edit"
-                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
-                  >
-                    <Pencil size={17} />
-                  </button>
-                  <button
-                    onClick={() => {
-                      if (confirm(`Delete "${p.title}"?`)) {
-                        deleteMutation.mutate(p.id)
-                      }
-                    }}
-                    title="Delete"
-                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
-                  >
-                    <Trash2 size={17} />
-                  </button>
+                  <Button variant="ghost" size="icon" asChild aria-label={`View ${p.title}`}>
+                    <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer" title="View">
+                      <ExternalLink className="h-4 w-4" />
+                    </a>
+                  </Button>
+                  <Button
+                    variant="ghost"
+                    size="icon"
+                    onClick={() => router.push(`/admin/page-builder/${p.id}`)}
+                    aria-label={`Edit ${p.title}`}
+                  >
+                    <Pencil className="h-4 w-4" />
+                  </Button>
+                  <Button
+                    variant="ghost"
+                    size="icon"
+                    className="text-destructive hover:text-destructive"
+                    onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
+                    aria-label={`Delete ${p.title}`}
+                  >
+                    <Trash2 className="h-4 w-4" />
+                  </Button>
                 </div>
```

- [ ] **Step 5: Mount `ConfirmDialog` (after the closing `</ul>`, before the outer `</div>`)**

```diff
           </ul>
         )}
+
+        <ConfirmDialog
+          open={deleteTarget !== null}
+          onClose={() => setDeleteTarget(null)}
+          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
+          title="Delete page?"
+          description={deleteTarget ? `This will permanently delete "${deleteTarget.title}".` : ''}
+          isLoading={deleteMutation.isPending}
+        />
       </div>
     </ModuleGuard>
   )
 }
```
(Confirm `ConfirmDialog`'s exact prop names against `frontend/src/components/shared/ConfirmDialog.tsx` before applying — match whatever `roles/page.tsx` actually passes, e.g. re-check `title`/`description`/`isLoading` spelling there if this diff's prop names don't compile.)

- [ ] **Step 6: Typecheck, lint, rebuild, verify**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && pnpm lint
docker compose build frontend && docker compose up -d frontend
```
Playwright: open `/admin/page-builder`, confirm View/Edit/Delete icons render with the same ghost-icon-button hover style as Roles' table, confirm View still opens the public page in a new tab, Edit still navigates to the Puck editor, and Delete now opens a `ConfirmDialog` (not a native browser `confirm()`) — confirm clicking "Delete" in the dialog actually removes the page and closes the dialog.

- [ ] **Step 7: Run the frontend test suite**

```bash
cd frontend && npx vitest run
```
Same baseline as Task 1. Check `grep -rl "page-builder" frontend/tests/rtl frontend/tests/regression` for any existing test of this specific list page.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/admin/page-builder/page.tsx
git commit -m "fix(admin-ui): page-builder list row actions match the Roles/Permissions pattern

View/Edit/Delete were ad-hoc <a>/<button> elements with manual hover
classes, and Delete used a native confirm() where every other list page
in the app (Roles, Permissions, Projects) uses the shared ConfirmDialog.
Converted to the exact <Button variant=\"ghost\" size=\"icon\"> + ConfirmDialog
pattern those pages already establish."
```

---

## Final steps (after all 7 tasks)

- [ ] Dispatch a final code-reviewer subagent across the full range of commits from this plan (Task 1's commit through Task 7's commit) for a whole-pass sanity check — same two-stage (spec-compliance, then code-quality) review this repo's `subagent-driven-development` workflow uses per task, plus one final holistic pass.
- [ ] Re-run the full backend + frontend test suites one more time after all 7 tasks land, to catch any cross-task interaction.
- [ ] Report back to the user with before/after screenshots of the Notifications page (Task 1, the original complaint) and the Media toolbar (Task 2, the other original complaint).
