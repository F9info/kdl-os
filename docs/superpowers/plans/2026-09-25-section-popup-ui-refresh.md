# Section Picker Popup UI Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both Page Builder popups (`SectionPickerPopup`, `InsertBlockModal`) a large centered title, a 2-column card grid whose preview images/text shrink proportionally with card width, a checkmark on whichever design is already live on the page (pinned to the front of its variant group), and a consistent full-width "Create new" footer button.

**Architecture:** All changes live in one existing file, `frontend/src/app/admin/page-builder/insert-block-modal.tsx` — no new files except one test file for a new pure helper function. `BlockCard` gains one prop (`isCurrent`) and a scale-aware preview height; a new exported helper `withCurrentSelection` computes that flag plus a per-variant-group reorder over the existing `cards` array both popups already build; the two popup components apply the helper and restyle their header/grid/footer JSX.

**Tech Stack:** React/Next.js, TypeScript, Tailwind CSS, `@puckeditor/core`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-section-popup-ui-refresh-design.md`

---

## Task 1: `withCurrentSelection` helper (pure logic, TDD)

**Files:**
- Modify: `frontend/src/app/admin/page-builder/insert-block-modal.tsx` (add exported type + function, near the top helpers, after `carryOverBrandProps` and before `insertBlockComponent`, around line 53)
- Test: `frontend/tests/regression/insert-block-modal.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/regression/insert-block-modal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { withCurrentSelection, type BlockCardEntry } from '@/app/admin/page-builder/insert-block-modal'

function entry(key: string, variant: string | null, index: number, total: number): BlockCardEntry {
  return { key, variant, index, total }
}

describe('withCurrentSelection', () => {
  it('flags the card matching an existing block of the same type+variant as isCurrent', () => {
    const cards = [
      entry('ConstructionHero', '1', 0, 2),
      entry('ConstructionHero', '2', 1, 2),
    ]
    const content = [{ type: 'ConstructionHero', props: { id: 'x', variant: '2' } }]
    const result = withCurrentSelection(cards, content)
    expect(result.find((c) => c.variant === '2')?.isCurrent).toBe(true)
    expect(result.find((c) => c.variant === '1')?.isCurrent).toBe(false)
  })

  it('pins the matching card to the front of its own variant group, leaving other groups untouched', () => {
    const cards = [
      entry('ConstructionHero', '1', 0, 2),
      entry('ConstructionHero', '2', 1, 2),
      entry('ConstructionAboutSplit', null, 0, 1),
    ]
    const content = [{ type: 'ConstructionHero', props: { id: 'x', variant: '2' } }]
    const result = withCurrentSelection(cards, content)
    expect(result.map((c) => `${c.key}:${c.variant}`)).toEqual([
      'ConstructionHero:2',
      'ConstructionHero:1',
      'ConstructionAboutSplit:null',
    ])
  })

  it('matches a null-variant component on type alone', () => {
    const cards = [entry('ConstructionAboutSplit', null, 0, 1)]
    const content = [{ type: 'ConstructionAboutSplit', props: { id: 'y' } }]
    const result = withCurrentSelection(cards, content)
    expect(result[0].isCurrent).toBe(true)
  })

  it('leaves order and flags unchanged when nothing on the page matches', () => {
    const cards = [
      entry('ConstructionHero', '1', 0, 2),
      entry('ConstructionHero', '2', 1, 2),
    ]
    const content = [{ type: 'SomeOtherBlock', props: { id: 'z' } }]
    const result = withCurrentSelection(cards, content)
    expect(result.every((c) => !c.isCurrent)).toBe(true)
    expect(result.map((c) => c.variant)).toEqual(['1', '2'])
  })

  it('handles empty/undefined content without throwing', () => {
    const cards = [entry('ConstructionHero', '1', 0, 1)]
    expect(withCurrentSelection(cards, [])).toEqual([{ ...cards[0], isCurrent: false }])
    expect(withCurrentSelection(cards, undefined)).toEqual([{ ...cards[0], isCurrent: false }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run tests/regression/insert-block-modal.test.ts`
Expected: FAIL — `withCurrentSelection` is not exported from `insert-block-modal.tsx` (module has no such export).

- [ ] **Step 3: Add the helper**

In `frontend/src/app/admin/page-builder/insert-block-modal.tsx`, find this existing block (around line 43-53):

```tsx
function carryOverBrandProps(content: AppState['data']['content'], componentType: string) {
  const fields = BRAND_CARRIER_FIELDS[componentType]
  if (!fields) return {}
  const existing = (content ?? []).find((block) => block.type === componentType)
  if (!existing?.props) return {}
  const carried: Record<string, unknown> = {}
  for (const field of fields) {
    if (existing.props[field] !== undefined) carried[field] = existing.props[field]
  }
  return carried
}
```

Add directly after it:

```tsx
export type BlockCardEntry = {
  key: string
  variant: string | null
  index: number
  total: number
}

type MinimalContentBlock = { type: string; props?: Record<string, unknown> }

const cardIdentity = (key: string, variant: string | null) => `${key}::${variant ?? 'null'}`

/**
 * Annotates each card with whether a block of that exact type+variant
 * already exists in the page's current content, and pins any such card to
 * the front of its own variant group (cards are already grouped by `key`,
 * since both popups build `cards` via `componentKeys.flatMap(key => ...)` —
 * this only reorders *within* each existing group, never across groups).
 */
export function withCurrentSelection<T extends BlockCardEntry>(
  cards: T[],
  content: MinimalContentBlock[] | null | undefined
): (T & { isCurrent: boolean })[] {
  const present = new Set(
    (content ?? []).map((block) => cardIdentity(block.type, (block.props?.variant as string | undefined) ?? null))
  )
  const annotated = cards.map((card) => ({
    ...card,
    isCurrent: present.has(cardIdentity(card.key, card.variant)),
  }))

  const groupOrder: string[] = []
  const groups = new Map<string, typeof annotated>()
  for (const card of annotated) {
    if (!groups.has(card.key)) {
      groups.set(card.key, [])
      groupOrder.push(card.key)
    }
    groups.get(card.key)!.push(card)
  }

  return groupOrder.flatMap((key) => {
    const group = groups.get(key)!
    return [...group.filter((c) => c.isCurrent), ...group.filter((c) => !c.isCurrent)]
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run tests/regression/insert-block-modal.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/page-builder/insert-block-modal.tsx frontend/tests/regression/insert-block-modal.test.ts
git commit -m "feat(page-builder): add withCurrentSelection helper for popup card ordering

Pure function: flags a block-picker card as isCurrent when a block of
that exact type+variant already exists on the page, and pins matching
cards to the front of their own variant group. No UI wiring yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `BlockCard` — checkmark badge + scale-aware preview height

**Files:**
- Modify: `frontend/src/app/admin/page-builder/insert-block-modal.tsx:7,158-226`

- [ ] **Step 1: Add the `Check` icon import**

Find:
```tsx
import { Plus, Search, X } from 'lucide-react'
```
Replace with:
```tsx
import { Check, Plus, Search, X } from 'lucide-react'
```

- [ ] **Step 2: Add the `isCurrent` prop and render the checkmark badge**

Find the `BlockCard` function signature and its opening lines:

```tsx
function BlockCard({
  componentKey,
  variant,
  index,
  total,
  onInsert,
}: {
  componentKey: string
  variant: string | null
  index: number
  total: number
  onInsert: (componentKey: string, variant: string | null) => void
}) {
```

Replace with:

```tsx
function BlockCard({
  componentKey,
  variant,
  index,
  total,
  isCurrent,
  onInsert,
}: {
  componentKey: string
  variant: string | null
  index: number
  total: number
  isCurrent: boolean
  onInsert: (componentKey: string, variant: string | null) => void
}) {
```

- [ ] **Step 3: Fix the preview height to scale with the card's measured width**

Find:
```tsx
  if (!comp?.render) return null
  const props = previewProps(comp, variant)
  const previewHeight = COMPACT_PREVIEW_HEIGHT[componentKey] ?? DEFAULT_PREVIEW_HEIGHT
```

Replace with:
```tsx
  if (!comp?.render) return null
  const props = previewProps(comp, variant)
  // Scale the container height by the same factor the rendered content is
  // zoomed by, so a narrower (e.g. 2-up) card shrinks its image/text
  // proportionally instead of leaving dead space below a now-smaller render
  // inside an unchanged fixed-height box.
  const previewHeight = Math.round(
    (COMPACT_PREVIEW_HEIGHT[componentKey] ?? DEFAULT_PREVIEW_HEIGHT) * scale
  )
```

- [ ] **Step 4: Render the checkmark badge and tighten the name badge**

Find:
```tsx
      <span className="absolute right-2.5 top-2.5 z-[2] rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white">
        {comp.label ?? componentKey}
        {total > 1 ? ` · ${index + 1}` : ''}
      </span>
```

Replace with:
```tsx
      <span className="absolute right-2.5 top-2.5 z-[2] rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
        {comp.label ?? componentKey}
        {total > 1 ? ` · ${index + 1}` : ''}
      </span>
      {isCurrent ? (
        <span className="absolute left-2.5 top-2.5 z-[2] flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
          <Check size={12} /> Current
        </span>
      ) : null}
```

- [ ] **Step 5: Verify with a type-check (no automated render test — see plan's Testing note)**

Run: `cd frontend && npx tsc --noEmit`
Expected: FAILS right now with two errors — `BlockCard` is called from `InsertBlockModal` and `SectionPickerPopup` without the new required `isCurrent` prop. This is expected at this point in the plan; Tasks 3 and 4 fix both call sites. Confirm the errors are exactly those two missing-prop errors (file:line for each `<BlockCard ... />` call) and nothing else — if there's a different/unrelated error, stop and investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/page-builder/insert-block-modal.tsx
git commit -m "feat(page-builder): BlockCard renders a checkmark for the live design, scales preview height with card width

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `SectionPickerPopup` — centered title, 2-column grid, wire up `isCurrent`

**Files:**
- Modify: `frontend/src/app/admin/page-builder/insert-block-modal.tsx:466-469,508-533`

- [ ] **Step 1: Wire `cards` through `withCurrentSelection`**

Find (inside `SectionPickerPopup`):
```tsx
  const cards = componentKeys.flatMap((key) => {
    const variants = blockVariants[key] ?? [null]
    return variants.map((variant, index) => ({ key, variant, index, total: variants.length }))
  })
```

Replace with:
```tsx
  const cards = withCurrentSelection(
    componentKeys.flatMap((key) => {
      const variants = blockVariants[key] ?? [null]
      return variants.map((variant, index) => ({ key, variant, index, total: variants.length }))
    }),
    appState.data.content
  )
```

- [ ] **Step 2: Centered, large title with an absolutely-positioned close button**

Find:
```tsx
        <div className="flex items-center gap-3.5 border-b border-slate-200 px-4.5 py-3.5">
          <b className="text-base">{cat?.title ?? categoryKey}</b>
          <span className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
```

Replace with:
```tsx
        <div className="relative border-b border-slate-200 px-5 py-4">
          <h2 className="text-center text-xl font-extrabold sm:text-2xl">
            {cat?.title ?? categoryKey}
          </h2>
          <button
            onClick={onClose}
            className="absolute right-3.5 top-3.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
```

- [ ] **Step 3: 2-column grid and pass `isCurrent` into `BlockCard`**

Find:
```tsx
        <div className="grid auto-rows-min grid-cols-1 gap-3.5 overflow-auto p-4.5">
          {cards.length === 0 ? (
            <div className="p-5 text-sm text-slate-400">No designs yet.</div>
          ) : (
            cards.map(({ key, variant, index, total }) => (
              <BlockCard
                key={`${key}-${variant ?? 'default'}`}
                componentKey={key}
                variant={variant}
                index={index}
                total={total}
                onInsert={insertBlock}
              />
            ))
          )}
        </div>
```

Replace with:
```tsx
        <div className="grid auto-rows-min grid-cols-2 gap-3.5 overflow-auto p-4.5">
          {cards.length === 0 ? (
            <div className="p-5 text-sm text-slate-400">No designs yet.</div>
          ) : (
            cards.map(({ key, variant, index, total, isCurrent }) => (
              <BlockCard
                key={`${key}-${variant ?? 'default'}`}
                componentKey={key}
                variant={variant}
                index={index}
                total={total}
                isCurrent={isCurrent}
                onInsert={insertBlock}
              />
            ))
          )}
        </div>
```

(The footer `"+ Create new"` button below this grid is already a full-width block — no change needed for `SectionPickerPopup`.)

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: the two errors from Task 2 Step 5 are now down to one (the remaining `<BlockCard>` call inside `InsertBlockModal`, fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/page-builder/insert-block-modal.tsx
git commit -m "feat(page-builder): SectionPickerPopup gets a centered title, 2-up grid, and current-design checkmark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `InsertBlockModal` — centered title, separate search row, 2-column grid, footer "Create new", wire up `isCurrent`

**Files:**
- Modify: `frontend/src/app/admin/page-builder/insert-block-modal.tsx:291-294,341-444`

- [ ] **Step 1: Wire `cards` through `withCurrentSelection`**

Find (inside `InsertBlockModal`):
```tsx
  const cards = componentKeys.flatMap((key) => {
    const variants = blockVariants[key] ?? [null]
    return variants.map((variant, index) => ({ key, variant, index, total: variants.length }))
  })
```

Replace with:
```tsx
  const cards = withCurrentSelection(
    componentKeys.flatMap((key) => {
      const variants = blockVariants[key] ?? [null]
      return variants.map((variant, index) => ({ key, variant, index, total: variants.length }))
    }),
    appState.data.content
  )
```

- [ ] **Step 2: Split the header into a centered-title row and its own search row**

Find:
```tsx
        <div className="flex items-center gap-3.5 border-b border-slate-200 px-5 py-3.5">
          <b className="text-base">Insert a block</b>
          <div className="relative max-w-[300px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a block…"
              className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <span className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
```

Replace with:
```tsx
        <div className="relative border-b border-slate-200 px-5 py-4">
          <h2 className="text-center text-xl font-extrabold sm:text-2xl">Insert a block</h2>
          <button
            onClick={onClose}
            className="absolute right-3.5 top-3.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="relative max-w-[300px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a block…"
              className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm"
            />
          </div>
        </div>
```

- [ ] **Step 3: 2-column grid, pass `isCurrent`, drop the inline "Create new" cell**

Find:
```tsx
          <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-auto bg-slate-50 p-5">
            {cards.length === 0 ? (
              <div className="p-5 text-sm text-slate-400">No blocks match.</div>
            ) : (
              cards.map(({ key, variant, index, total }) => (
                <BlockCard
                  key={`${key}-${variant ?? 'default'}`}
                  componentKey={key}
                  variant={variant}
                  index={index}
                  total={total}
                  onInsert={insertBlock}
                />
              ))
            )}
            {!q
              ? customBlocks.map((block) => (
                  <div
                    key={block.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => insertCustomBlock(block)}
                    onKeyDown={(e) => e.key === 'Enter' && insertCustomBlock(block)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <span className="absolute right-2.5 top-2.5 z-[2] rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-extrabold text-white">
                      {block.name}
                    </span>
                    <div className="h-[320px] overflow-hidden bg-white pointer-events-none">
                      <div
                        style={{
                          width: 1200,
                          transform: 'scale(0.55)',
                          transformOrigin: 'top left',
                        }}
                      >
                        {renderComposedBlock(block.config)}
                      </div>
                    </div>
                  </div>
                ))
              : null}
            {!q ? (
              <button
                onClick={openComposer}
                className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50"
              >
                <Plus size={22} />
                <span className="text-sm font-bold">Create new</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
```

Replace with:
```tsx
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-4 overflow-auto bg-slate-50 p-5">
            {cards.length === 0 ? (
              <div className="p-5 text-sm text-slate-400">No blocks match.</div>
            ) : (
              cards.map(({ key, variant, index, total, isCurrent }) => (
                <BlockCard
                  key={`${key}-${variant ?? 'default'}`}
                  componentKey={key}
                  variant={variant}
                  index={index}
                  total={total}
                  isCurrent={isCurrent}
                  onInsert={insertBlock}
                />
              ))
            )}
            {!q
              ? customBlocks.map((block) => (
                  <div
                    key={block.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => insertCustomBlock(block)}
                    onKeyDown={(e) => e.key === 'Enter' && insertCustomBlock(block)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <span className="absolute right-2.5 top-2.5 z-[2] rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-extrabold text-white">
                      {block.name}
                    </span>
                    <div className="h-[320px] overflow-hidden bg-white pointer-events-none">
                      <div
                        style={{
                          width: 1200,
                          transform: 'scale(0.55)',
                          transformOrigin: 'top left',
                        }}
                      >
                        {renderComposedBlock(block.config)}
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
        {!q ? (
          <div className="border-t border-slate-200 p-4.5">
            <button
              onClick={openComposer}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700"
            >
              + Create new
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

Note: `Plus` is still used elsewhere in this file (`InsertBlockButton`'s trigger button at the bottom of the file) — do not remove its import.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero errors (the last missing-`isCurrent`-prop error from Task 2 Step 5 is now fixed).

- [ ] **Step 5: Lint**

Run: `cd frontend && npx next lint --file src/app/admin/page-builder/insert-block-modal.tsx`
Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 6: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, including the 5 new `insert-block-modal.test.ts` tests, no regressions elsewhere. If `pnpm test`'s wrapper script fails on an unrelated pnpm build-script preflight (`ERR_PNPM_IGNORED_BUILDS`), use `npx vitest run` directly instead — that's an environment quirk, not a real failure.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/admin/page-builder/insert-block-modal.tsx
git commit -m "feat(page-builder): InsertBlockModal gets a centered title, separate search row, 2-up grid, footer 'Create new', and current-design checkmark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** §1 header (large/centered title, absolute close) ✓ both popups (Task 3 Step 2, Task 4 Step 2). §2 grid (2 columns, scale-aware height, tightened name badge) ✓ (Task 2 Steps 3-4, Task 3 Step 3, Task 4 Step 3). §3 "Create new" as footer button, after the grid, in both popups ✓ (`SectionPickerPopup` already correct/untouched; `InsertBlockModal` moved in Task 4 Step 3). §4 tickmark + per-group reorder ✓ (Task 1's `withCurrentSelection`, wired in Task 3 Step 1 / Task 4 Step 1, rendered in Task 2 Step 4).

**Placeholder scan:** no TBD/TODO; every step has complete, runnable code; Task 2 Step 5 intentionally documents an *expected* interim type-error state (not a placeholder — it's a real, verifiable assertion about the codebase mid-plan, resolved by name in Tasks 3-4).

**Type/signature consistency:** `BlockCardEntry` (Task 1) → consumed by `withCurrentSelection<T extends BlockCardEntry>` (Task 1) → both call sites destructure the exact same `{ key, variant, index, total, isCurrent }` shape (Task 3 Step 3, Task 4 Step 3) → `BlockCard`'s prop list (Task 2 Step 2) takes exactly `componentKey, variant, index, total, isCurrent, onInsert` — no naming drift (`componentKey` vs `key` is the one intentional rename, already present in the original code: `cards` entries use `key`, `BlockCard` receives it as `componentKey`, unchanged by this plan).

**Testing gap acknowledged:** Task 1's pure helper is fully unit-tested. `BlockCard`/`SectionPickerPopup`/`InsertBlockModal` themselves have no automated render test in this plan — there is no existing RTL test file for this component to extend (confirmed: no `*.test.tsx` under `frontend/tests/rtl/` references `insert-block-modal`), and this environment has no running dev server/browser for manual visual QA. Task 4 Step 6 runs the full suite to catch any incidental regression elsewhere; final visual confirmation (2-up grid without dead space, checkmark on the live design, centered titles) needs a real browser pass by a human before merge.
