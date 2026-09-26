# Inner Banner Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-design "Inner Banner" block (`ConstructionInnerBanner`) to the page builder's Construction pack, whose `<h1>`/breadcrumb always mirror the current page's real title via a new Puck `metadata` wire-up.

**Architecture:** One new component entry inside the existing single-file Construction pack (`packs/construction/index.tsx`), following the exact same three-part pattern every other component there uses (a `ConstructionProps` type member, a `typedComponents` config entry with `label`/`fields`/`defaultProps`/`render`, and a `construction.variants` map entry). The dynamic title is Puck's `metadata` prop, threaded through from the two existing surfaces that already load `page.title` (the editor and the public renderer) into the component's `render(props)` via `props.puck.metadata`.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, `@puckeditor/core`, TailwindCSS. No new dependencies.

**No test-writing tasks in this plan** — every one of the ~70 existing components in `packs/construction/index.tsx` (and every component in `packs/general`, `packs/medical`) has zero unit-test coverage; this plan matches that existing convention exactly (see `docs/superpowers/specs/2026-09-26-inner-banner-design.md` → "Out of scope"). Verification instead uses this repo's real automated gates (`pnpm type-check`, `pnpm lint`, `pnpm build`) plus manual browser checks, since those are the checks this kind of file actually has.

---

## Reference anchors (verified by reading the file before writing this plan)

`frontend/src/app/admin/page-builder/packs/construction/index.tsx` is 11,992 lines. Exact anchors used below:

- `type ConstructionProps = {` starts at **line 269**.
- The `ConstructionHero` prop-type member is **lines 334–410** (closes right before `ConstructionServicesGrid: {` at line 411).
- `const typedComponents: Config<ConstructionProps>['components'] = {` starts at **line 1804**.
- The `ConstructionHero` component config (`label`/`fields`/`defaultProps`/`render`) is **lines 2839–4012** (closes right before the `// 2. Services grid` comment + `ConstructionServicesGrid: {` at line 4013/4014).
- `const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {` starts at **line 11837**.
- `export const construction: ComponentPack = {` with its `variants: {` map is at **lines 11982–11992**; the `variants` object currently contains only `ConstructionTopBar`, `ConstructionHeader`, `ConstructionHero`.
- Imports already present at the top of this file (line 5–6): `import { imageField } from '../image-field'` and `import { InlineEditableText } from '../inline-editable-text'` — **no new imports needed** in this file.
- Existing "hide" convention used by every other component (verified at lines 1956, 2450, 3396): `if (visible === false) return <></>`.

Other files:
- `frontend/src/app/admin/page-builder/puck.config.tsx` — `CATEGORY_ORDER` array, `'welcome'` is the 4th entry (line 57).
- `frontend/src/app/admin/template-engine/edit/[id]/page.tsx` — `<Puck config={editorConfig} data={editableData} ... />` at line 189, `page.title` already available (used at line 199 `headerTitle={page.title}`).
- `frontend/src/app/p/[slug]/page.tsx` — `<Render config={config} data={page.data} />` at line 39, `page` already loaded (has `.title`).

**Because every insertion point above is an exact line range already re-read in this plan, all edits in this plan use those line numbers directly — re-verify with `sed -n` before each edit in case the file has changed since this plan was written (concurrent work is possible on this branch — git status shows this exact file already modified).**

---

### Task 1: Add the `ConstructionInnerBanner` prop-type member

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx:410` (insert after)

- [ ] **Step 1: Re-confirm the anchor is still correct**

Run: `sed -n '405,412p' "frontend/src/app/admin/page-builder/packs/construction/index.tsx"`
Expected: line 410 is a lone `  }` closing the `ConstructionHero` member, line 411 is `  ConstructionServicesGrid: {`. If the line numbers have drifted, find the new line where `ConstructionHero`'s prop-type member closes (immediately before `ConstructionServicesGrid: {`) and use that instead of 410 below.

- [ ] **Step 2: Insert the new type member right after line 410**

Insert this text as a new block immediately after the `ConstructionHero` member's closing `  }` (i.e. between it and `  ConstructionServicesGrid: {`):

```ts
  ConstructionInnerBanner: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    backgroundImage: string
    imageAlt: string
    subtitle: string
  }
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && pnpm type-check`
Expected: same errors as before this change (there will be errors from Tasks 2–3 not existing yet, referencing `ConstructionInnerBanner` — that's expected at this point; just confirm no NEW error mentions a typo in the block just inserted, e.g. no "Cannot find name" pointing at this exact type member).

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/admin/page-builder/packs/construction/index.tsx"
git commit -m "feat(page-builder): add ConstructionInnerBanner prop type"
```

---

### Task 2: Add the `ConstructionInnerBanner` component config (fields, defaultProps, all 4 designs)

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx:4012` (insert after)

- [ ] **Step 1: Re-confirm the anchor is still correct**

Run: `sed -n '4008,4016p' "frontend/src/app/admin/page-builder/packs/construction/index.tsx"`
Expected: line 4011 is `  },` (closing `ConstructionHero`'s config entry), line 4012 is blank, line 4013 is `  // 2. Services grid`, line 4014 is `  ConstructionServicesGrid: {`. If drifted, find the blank line between `ConstructionHero`'s closing `  },` and the `// 2. Services grid` comment and insert there instead.

- [ ] **Step 2: Insert the full component config**

Insert this block on its own (as a new sibling entry inside `typedComponents`), right after `ConstructionHero`'s closing `  },` and before the blank line / `// 2. Services grid` comment:

```tsx
  ConstructionInnerBanner: {
    label: 'Inner Banner',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Full-bleed photo', value: '1' },
          { label: 'Design 2 — Split card', value: '2' },
          { label: 'Design 3 — Compact centered strip', value: '3' },
          { label: 'Design 4 — Frosted glass over photo', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      backgroundImage: imageField('Background image'),
      imageAlt: { type: 'text' },
      subtitle: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      visible: true,
      backgroundImage:
        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&h=900&fit=crop&q=80&auto=format',
      imageAlt: 'Building engineering site',
      subtitle: 'Your one-stop solution for building engineering products & services — 30 years of trust, one accountable team.',
    },
    render: function ConstructionInnerBannerRender({
      id,
      puck,
      variant,
      visible,
      backgroundImage,
      imageAlt,
      subtitle,
    }) {
      if (visible === false) return <></>
      const title = ((puck?.metadata?.pageTitle as string | undefined) || 'Page Title')
      const isEditing = puck?.isEditing ?? false

      const breadcrumb = (
        <nav
          className="mb-3 flex items-center gap-2 text-[13px] text-white/80"
          aria-label="Breadcrumb"
        >
          <a href="/" className="hover:text-white">
            Home
          </a>
          <span>/</span>
          <span className="font-semibold text-white">{title}</span>
        </nav>
      )

      const subtitleNode = (
        <InlineEditableText
          id={id}
          path={['subtitle']}
          value={subtitle}
          as="p"
          isEditing={isEditing}
          multiline
        />
      )

      if (variant === '2') {
        return (
          <section className="grid overflow-hidden bg-slate-900 md:grid-cols-2">
            <div className="flex flex-col justify-center gap-3 px-8 py-16 md:px-14">
              {breadcrumb}
              <h1 className="text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
              <div className="max-w-md text-[15px] text-white/75">{subtitleNode}</div>
              <span className="mt-4 h-1 w-16 rounded bg-orange-500" />
            </div>
            <div className="relative min-h-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={backgroundImage}
                alt={imageAlt}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </section>
        )
      }

      if (variant === '3') {
        return (
          <section className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-14 text-center">
            <div className="mx-auto flex max-w-2xl flex-col items-center">
              <nav
                className="mb-3 flex items-center gap-2 text-[13px] text-white/80"
                aria-label="Breadcrumb"
              >
                <a href="/" className="hover:text-white">
                  Home
                </a>
                <span>/</span>
                <span className="font-semibold text-white">{title}</span>
              </nav>
              <h1 className="text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
              <div className="mt-2 max-w-lg text-[15px] text-white/75">{subtitleNode}</div>
            </div>
          </section>
        )
      }

      if (variant === '4') {
        return (
          <section className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backgroundImage} alt={imageAlt} className="h-[380px] w-full object-cover" />
            <div className="absolute bottom-6 left-6 max-w-md rounded-2xl border border-white/30 bg-white/15 p-6 backdrop-blur-md">
              {breadcrumb}
              <h1 className="text-2xl font-extrabold text-white md:text-3xl">{title}</h1>
              <div className="mt-2 text-[14px] text-white/85">{subtitleNode}</div>
            </div>
          </section>
        )
      }

      // Design 1 — pixel clone of the reference site's .page-banner
      // (after-delete-folder/about.html and every other inner page).
      return (
        <section className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt={imageAlt}
            style={{ objectPosition: 'center 72%' }}
            className="h-[380px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-8 md:px-14">
            {breadcrumb}
            <h1 className="text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
            <div className="mt-2 max-w-xl text-[15px] text-white/85">{subtitleNode}</div>
          </div>
        </section>
      )
    },
  },

```

- [ ] **Step 3: Type-check**

Run: `cd frontend && pnpm type-check`
Expected: no errors mentioning `ConstructionInnerBanner` (there may still be one error about the `construction.variants`/category registration from Task 3 not existing yet — expected, fix in Task 3).

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/admin/page-builder/packs/construction/index.tsx"
git commit -m "feat(page-builder): implement ConstructionInnerBanner's 4 designs"
```

---

### Task 3: Register the category and the variant list

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx:11837` area (typedCategories)
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx:11987` area (variants map)

- [ ] **Step 1: Re-confirm anchors**

Run: `sed -n '11837,11840p' "frontend/src/app/admin/page-builder/packs/construction/index.tsx"`
Expected: line 11837 is `const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {` and line 11838 opens the first category (`counters:`).

Run: `sed -n '11985,11993p' "frontend/src/app/admin/page-builder/packs/construction/index.tsx"`
Expected: shows the `variants: {` map with `ConstructionTopBar`, `ConstructionHeader`, `ConstructionHero` entries.

- [ ] **Step 2: Add the category**

Insert immediately after the `const typedCategories: ... = {` opening line (i.e. as the new first entry, before `counters:`):

```ts
  innerbanner: {
    title: 'Inner Banner',
    components: ['ConstructionInnerBanner'],
  },
```

- [ ] **Step 3: Add the variant list entry**

Inside `export const construction: ComponentPack`'s `variants: {` object, add a new line right after the existing `ConstructionHero: ['1', '2', '3', '4'],` line:

```ts
    ConstructionInnerBanner: ['1', '2', '3', '4'],
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && pnpm type-check`
Expected: exits 0 — no errors anywhere in `packs/construction/index.tsx`.

- [ ] **Step 5: Lint**

Run: `cd frontend && pnpm lint`
Expected: exits 0 (no new lint errors from this file). If the `<img>` tags trigger `@next/next/no-img-element` despite the disable comments, verify the comment is on the line immediately above each `<img>` (it is, in Step 2 of Task 2) — this exact suppression pattern is already used elsewhere in this same file for other components' `<img>` tags.

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/admin/page-builder/packs/construction/index.tsx"
git commit -m "feat(page-builder): register Inner Banner category and variants"
```

---

### Task 4: Wire Puck `metadata` in the template-engine editor

**Files:**
- Modify: `frontend/src/app/admin/template-engine/edit/[id]/page.tsx:189-201`

- [ ] **Step 1: Re-confirm anchor**

Run: `sed -n '189,201p' "frontend/src/app/admin/template-engine/edit/[id]/page.tsx"`
Expected: shows the `<Puck config={editorConfig} data={editableData} plugins={...} iframe={...} viewports={...} headerTitle={page.title} headerPath={...} onPublish={...} overrides={...}` call.

- [ ] **Step 2: Add the `metadata` prop**

Change:

```tsx
        <Puck
          config={editorConfig}
          data={editableData}
          plugins={[blocksPlugin()]}
```

to:

```tsx
        <Puck
          config={editorConfig}
          data={editableData}
          metadata={{ pageTitle: page.title }}
          plugins={[blocksPlugin()]}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && pnpm type-check`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/admin/template-engine/edit/[id]/page.tsx"
git commit -m "feat(page-builder): pass page title into Puck metadata in the editor"
```

---

### Task 5: Wire Puck `metadata` in the public page renderer

**Files:**
- Modify: `frontend/src/app/p/[slug]/page.tsx:39`

- [ ] **Step 1: Re-confirm anchor**

Run: `sed -n '36,40p' "frontend/src/app/p/[slug]/page.tsx"`
Expected: shows `return <Render config={config} data={page.data} />`.

- [ ] **Step 2: Add the `metadata` prop**

Change:

```tsx
  return <Render config={config} data={page.data} />
```

to:

```tsx
  return <Render config={config} data={page.data} metadata={{ pageTitle: page.title }} />
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && pnpm type-check`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/p/[slug]/page.tsx"
git commit -m "feat(page-builder): pass page title into Puck metadata on the public renderer"
```

---

### Task 6: Order the new category in the Section tab

**Files:**
- Modify: `frontend/src/app/admin/page-builder/puck.config.tsx:53-75` (`CATEGORY_ORDER`)

- [ ] **Step 1: Re-confirm anchor**

Run: `sed -n '53,76p' "frontend/src/app/admin/page-builder/puck.config.tsx"`
Expected: shows the `CATEGORY_ORDER` array, with `'top-bar'`, `'header'`, `'hero'`, `'welcome'`, `'taglinestrip'`, … in that order.

- [ ] **Step 2: Insert `'innerbanner'` right after `'welcome'`**

Change:

```ts
  'welcome',
  'taglinestrip',
```

to:

```ts
  'welcome',
  'innerbanner',
  'taglinestrip',
```

- [ ] **Step 3: Type-check + lint**

Run: `cd frontend && pnpm type-check && pnpm lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/admin/page-builder/puck.config.tsx"
git commit -m "feat(page-builder): order Inner Banner right after Welcome in the Section tab"
```

---

### Task 7: Full build + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `cd frontend && pnpm build`
Expected: build succeeds (exit 0). This is the strongest available automated gate for a Next.js/Puck config file with no unit-test harness — a broken component config or a bad JSX/type error in `packs/construction/index.tsx` fails this step.

- [ ] **Step 2: Manual check — block appears and inserts**

1. Open `http://localhost:3101/admin/template-engine/edit/<any-page-id>?projectId=<project-id>` (e.g. the About page from this conversation: `cmteeef0m000f01nqqic19v17` / `cmt15bmts000401s6fn5ydhzp`).
2. In the Section tab, confirm "Inner Banner" now appears in the list, positioned directly after "Welcome".
3. Click it, confirm the picker popup shows 4 preview cards (Design 1–4), each rendering visibly different layouts, and each card's `<h1>` shows "Page Title" (the modal preview has no `puck.metadata`, so it must show the fallback, not crash or show blank).
4. Insert Design 1. Confirm it renders full-bleed image + breadcrumb + `<h1>` reading the real page's title (e.g. "About Us" if inserted on the About page) + the default subtitle text.
5. Click the subtitle text directly on the canvas — confirm it's editable inline (per `InlineEditableText`), type a change, click away, confirm the change persists (re-open the Fields panel or reload and re-check).
6. In the Fields panel (Style tab or wherever `variant` renders as a field), switch through all 4 designs, confirm each one visually matches the code (split card / centered strip / frosted glass).

- [ ] **Step 3: Manual check — title really is dynamic per page**

1. Insert an Inner Banner block on a *second*, differently-titled page.
2. Confirm its `<h1>` shows that second page's own title, not the first page's — proving the value comes from `puck.metadata.pageTitle`, not something baked into the block's stored props.

- [ ] **Step 4: Manual check — public renderer**

1. Publish the page (the editor's Puck publish button — this repo's `onPublish={handlePublish}`).
2. Open `http://localhost:3101/p/<that-page-slug>`.
3. Confirm the Inner Banner renders there too, with the same dynamic title, matching the editor canvas exactly.

- [ ] **Step 5: If any manual check fails**

Do not proceed to Task 8. Re-open this plan's Task 2 (component render) or Tasks 4/5 (metadata wiring) depending on which check failed, fix, and re-run Step 1 (`pnpm build`) before re-checking.

---

### Task 8: Update project handoff docs

**Files:**
- Modify: `.agents/HANDOFF.md` (prepend entry)
- Modify: `STATUS.md` (prepend entry under `## Rolling changelog`)

- [ ] **Step 1: Prepend a HANDOFF.md entry**

Add to the very top of `.agents/HANDOFF.md` (keep the file's existing entries below it):

```markdown
## 2026-09-26 — Inner Banner block: 4 designs, dynamic page-title via new Puck `metadata` wiring

Added `ConstructionInnerBanner` (Section tab: "Inner Banner", placed right after "Welcome") —
Design 1 is a pixel clone of the reference site's `.page-banner` (about.html et al: full-bleed
photo, dark overlay, breadcrumb, `<h1>`, subtitle). Designs 2-4 are new alternates (split card /
compact centered strip / frosted-glass-over-photo) — the real site only has one inner-banner
design, so unlike Hero Slider there was no second/third/fourth reference to copy.

The `<h1>` and breadcrumb "current" label are never a per-block field — they always read
`puck.metadata.pageTitle`, the first use of Puck's `metadata` prop anywhere in this repo. Wired
into both `template-engine/edit/[id]/page.tsx` (`<Puck metadata={{ pageTitle: page.title }}>`)
and `p/[slug]/page.tsx` (`<Render metadata={{ pageTitle: page.title }}>`) — both already loaded
`page.title` for other purposes (`headerTitle`), just hadn't threaded it into block props before.

Insert-modal preview cards call `comp.render(props)` directly outside any `<Puck>`/`<Render>`
tree (see `insert-block-modal.tsx` `BlockCard`), so `props.puck` is `undefined` there — the
render function falls back to the literal string `'Page Title'` in that case.

Design spec: `docs/superpowers/specs/2026-09-26-inner-banner-design.md`.
Plan: `docs/superpowers/plans/2026-09-26-inner-banner.md`.
```

- [ ] **Step 2: Prepend a STATUS.md changelog entry**

Under the `## Rolling changelog` heading in `STATUS.md` (not at the very top of the file — that block is generated), add:

```markdown
- 2026-09-26 — Inner Banner block added (`ConstructionInnerBanner`, 4 designs, dynamic
  page-title via new Puck `metadata` prop). See `.agents/HANDOFF.md` same date.
```

- [ ] **Step 3: Commit**

```bash
git add .agents/HANDOFF.md STATUS.md
git commit -m "docs(page-builder): log Inner Banner block in handoff/status"
```
