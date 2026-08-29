'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePuck } from '@puckeditor/core'
import type { AppState, Config } from '@puckeditor/core'
import { Plus, Search, X } from 'lucide-react'
import { blockVariants } from './puck.config'
import { BlockComposer } from './packs/composer/BlockComposer'
import {
  listCustomBlocks,
  getDefaultProjectId,
  type CustomBlockRecord,
} from './packs/composer/custom-blocks-store'
import { renderComposedBlock } from './packs/composer/render-composed-block'

/**
 * Inserts `componentType` (optionally pinned to one of its `blockVariants`
 * designs) at the end of the root zone. Two dispatches because Puck's
 * `insert` action only ever applies a component's defaultProps; passing the
 * id we generate into a same-id `replace` right after is the supported way
 * to seed non-default props (here: `variant`) atomically. The insert is
 * `recordHistory: false` so the pair undoes as one step.
 */
export function insertBlockComponent(
  dispatch: (action: Parameters<ReturnType<typeof usePuck>['dispatch']>[0]) => void,
  config: Config,
  content: AppState['data']['content'],
  componentType: string,
  variant: string | null
) {
  const comp = (config.components as Record<string, { defaultProps?: object }>)[componentType]
  if (!comp) return
  const id = `${componentType}-${crypto.randomUUID()}`
  const destinationZone = 'root:default-zone'
  const destinationIndex = content?.length ?? 0
  dispatch({
    type: 'insert',
    componentType,
    destinationIndex,
    destinationZone,
    id,
    recordHistory: false,
  })
  dispatch({
    type: 'replace',
    destinationIndex,
    destinationZone,
    data: {
      type: componentType,
      props: { ...(comp.defaultProps ?? {}), ...(variant ? { variant } : {}), id },
    },
  })
}

/**
 * Odoo-style "Insert a block" picker: category sidebar + a grid of real,
 * scaled-down renders of each block (using the block's own defaultProps —
 * already dummy/placeholder content, e.g. `https://placehold.co/900x800`).
 * Clicking a card inserts that exact block (with that variant, if the block
 * has more than one design) at the end of the page — no drag required.
 *
 * Insert is two dispatches because Puck's `insert` action only ever applies
 * a component's defaultProps; passing the id we generate into a same-id
 * `replace` right after is the supported way to seed non-default props
 * (here: `variant`) atomically. The insert is `recordHistory: false` so the
 * pair undoes as one step.
 */
/** Placeholder for a `type: 'slot'` field's content when previewing outside
 *  Puck's own render pipeline — Puck normally swaps a slot's raw `[]` for a
 *  renderable component before calling `.render()`; skipping that step and
 *  rendering `<rawArray />` is a React "invalid element type" crash. */
function SlotPlaceholder() {
  return (
    <div className="grid h-16 place-items-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
      Content
    </div>
  )
}

type PuckComponentConfig = {
  label?: string
  defaultProps?: Record<string, unknown>
  fields?: Record<string, { type?: string }>
  render?: (p: object) => React.ReactNode
}

function previewProps(comp: PuckComponentConfig, variant: string | null) {
  const props: Record<string, unknown> = {
    ...(comp.defaultProps ?? {}),
    ...(variant ? { variant } : {}),
  }
  for (const [key, field] of Object.entries(comp.fields ?? {})) {
    if (field?.type === 'slot') props[key] = SlotPlaceholder
  }
  return props
}

// Short, bar-shaped components (sticky headers, top bars) render to only a
// sliver of the default 210px preview box — leaving most of the card (and,
// on hover, the dark "Insert" gradient overlay, which is sized to the whole
// card) as dead empty space. Give these a shorter preview box instead.
const COMPACT_PREVIEW_HEIGHT: Record<string, number> = {
  ConstructionHeader: 110,
  ConstructionTopBar: 110,
}
const DEFAULT_PREVIEW_HEIGHT = 320

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
  const { config } = usePuck()
  const comp = (config.components as Record<string, PuckComponentConfig>)[componentKey]
  if (!comp?.render) return null
  const props = previewProps(comp, variant)
  const previewHeight = COMPACT_PREVIEW_HEIGHT[componentKey] ?? DEFAULT_PREVIEW_HEIGHT

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onInsert(componentKey, variant)}
      onKeyDown={(e) => e.key === 'Enter' && onInsert(componentKey, variant)}
      className="group relative self-start cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <span className="absolute right-2.5 top-2.5 z-[2] rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white">
        {comp.label ?? componentKey}
        {total > 1 ? ` · ${index + 1}` : ''}
      </span>
      <div
        style={{ height: previewHeight }}
        className="overflow-hidden bg-white pointer-events-none"
      >
        <div style={{ width: 1200, transform: 'scale(0.55)', transformOrigin: 'top left' }}>
          {comp.render(props)}
        </div>
      </div>
      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-slate-900/55 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
        <span className="rounded-lg bg-white px-4.5 py-2 text-[13px] font-extrabold text-blue-600 shadow-lg">
          Insert →
        </span>
      </div>
    </div>
  )
}

export function InsertBlockModal({
  onClose,
  initialCategory,
  projectId,
}: {
  onClose: () => void
  initialCategory?: string
  projectId?: string
}) {
  const { appState, config, dispatch } = usePuck()

  const categories = useMemo(
    () =>
      Object.entries(config.categories ?? {}).filter(
        ([, cat]) => (cat.components?.length ?? 0) > 0
      ),
    [config.categories]
  )
  const [activeCat, setActiveCat] = useState(initialCategory ?? categories[0]?.[0] ?? '')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const [customBlocks, setCustomBlocks] = useState<CustomBlockRecord[]>([])
  const [composerOpen, setComposerOpen] = useState<{ editing?: CustomBlockRecord } | null>(null)
  // Save target for a block created with no project context (legacy Page
  // Builder) — resolved on demand rather than eagerly, since most opens of
  // this modal never touch "Create new".
  const [createProjectId, setCreateProjectId] = useState<string | null>(null)

  async function openComposer() {
    if (projectId) {
      setComposerOpen({})
      return
    }
    const id = createProjectId ?? (await getDefaultProjectId())
    setCreateProjectId(id)
    setComposerOpen({})
  }

  useEffect(() => {
    if (!activeCat || q) {
      setCustomBlocks([])
      return
    }
    let cancelled = false
    // projectId undefined (legacy Page Builder, no project context) lists
    // custom blocks across every project.
    listCustomBlocks(projectId, activeCat).then((items) => {
      if (!cancelled) setCustomBlocks(items)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, activeCat, q])

  const componentKeys = q
    ? categories
        .flatMap(([, cat]) => cat.components ?? [])
        .filter((key) => {
          const label = (config.components as Record<string, { label?: string }>)[key]?.label ?? key
          return String(label).toLowerCase().includes(q)
        })
    : (categories.find(([key]) => key === activeCat)?.[1].components ?? [])

  const cards = componentKeys.flatMap((key) => {
    const variants = blockVariants[key] ?? [null]
    return variants.map((variant, index) => ({ key, variant, index, total: variants.length }))
  })

  function insertBlock(componentKey: string, variant: string | null) {
    insertBlockComponent(dispatch, config, appState.data.content, componentKey, variant)
    onClose()
  }

  function insertCustomBlock(block: CustomBlockRecord) {
    const id = `CustomComposedBlock-${crypto.randomUUID()}`
    const destinationZone = 'root:default-zone'
    const destinationIndex = appState.data.content?.length ?? 0
    dispatch({
      type: 'insert',
      componentType: 'CustomComposedBlock',
      destinationIndex,
      destinationZone,
      id,
      recordHistory: false,
    })
    dispatch({
      type: 'replace',
      destinationIndex,
      destinationZone,
      data: { type: 'CustomComposedBlock', props: { config: block.config, id } },
    })
    onClose()
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[2000] grid place-items-center bg-slate-900/50 p-7"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="flex h-[min(82vh,780px)] w-[min(1120px,95vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3.5 border-b border-slate-200 px-4.5 py-3.5">
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
            className="text-slate-500 hover:text-slate-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[210px] flex-none overflow-auto border-r border-slate-200 bg-white">
            {categories.map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setActiveCat(key)}
                className={`block w-full border-l-[3px] px-4 py-3 text-left text-[13px] ${
                  key === activeCat && !q
                    ? 'border-l-blue-600 bg-blue-50 font-extrabold'
                    : 'border-l-transparent font-semibold text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat.title ?? key}
              </button>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4.5 overflow-auto bg-slate-50 p-4.5">
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
      {composerOpen ? (
        <BlockComposer
          projectId={projectId ?? createProjectId ?? ''}
          categoryKey={activeCat}
          editing={composerOpen.editing}
          onClose={() => setComposerOpen(null)}
          onSaved={() => {
            setComposerOpen(null)
            listCustomBlocks(projectId, activeCat).then(setCustomBlocks)
          }}
        />
      ) : null}
    </div>
  )
}

/** Header-bar trigger; mount inside Puck's `overrides.headerActions`. */
export function InsertBlockButton({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        <Plus size={15} /> Insert block
      </button>
      {open ? <InsertBlockModal onClose={() => setOpen(false)} projectId={projectId} /> : null}
    </>
  )
}
