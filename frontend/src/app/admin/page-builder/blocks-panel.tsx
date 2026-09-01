'use client'

import { useEffect, useRef, useState } from 'react'
import { usePuck } from '@puckeditor/core'
import {
  Plus,
  ArrowUpDown,
  Pencil,
  Settings,
  LayoutTemplate,
  Columns as ColumnsIcon,
  FileText,
  Image as ImageIcon,
  Users,
  Type,
  Mail,
  CalendarClock,
  Heading as HeadingIcon,
  RectangleHorizontal,
  Minus,
  Square,
  GripVertical,
  Trash2,
} from 'lucide-react'
import { SectionPickerPopup, insertBlockComponent } from './insert-block-modal'
import { BlockComposer } from './packs/composer/BlockComposer'
import type { ComposedBlockConfig } from './packs/composer/render-composed-block'

/** Odoo-style chrome colours, matched to the reference prototype. */
const OD = { bg: '#1c1e24', panel: '#181b21', tile: '#23262e', tileBd: '#2d313a', muted: '#8b93a1' }
const TAB_ACCENT = { section: '#22c55e', reorder: '#f59e0b', style: '#38bdf8', theme: '#c4e04a' }

const CATEGORY_ICON: [RegExp, typeof LayoutTemplate][] = [
  [/hero|intro|banner/i, LayoutTemplate],
  [/column|service|feature|department|stat/i, ColumnsIcon],
  [/content|about|detail/i, FileText],
  [/image|gallery|photo/i, ImageIcon],
  [/people|doctor|team|patient|testimonial/i, Users],
  [/text|article|faq/i, Type],
  [/contact|form/i, Mail],
  [/appointment|event|calendar/i, CalendarClock],
]
function categoryIcon(name: string) {
  return CATEGORY_ICON.find(([re]) => re.test(name))?.[1] ?? Square
}

/** The general pack's single-design atoms — inserted directly, no variant picker. */
const INNER_CONTENT: { key: string; icon: typeof Type }[] = [
  { key: 'Text', icon: Type },
  { key: 'Heading', icon: HeadingIcon },
  { key: 'Button', icon: RectangleHorizontal },
  { key: 'Image', icon: ImageIcon },
  { key: 'Spacer', icon: Minus },
]

function BlocksTab({ onOpenCategory }: { onOpenCategory: (categoryKey: string) => void }) {
  const { config, appState, dispatch, selectedItem } = usePuck()
  const categories = Object.entries(config.categories ?? {}).filter(
    ([, cat]) => (cat.components?.length ?? 0) > 0
  )
  // Reference behaviour: a category whose section is already on the page
  // shows "Already added" and can't be re-opened — Top Header/Header/Hero
  // Slider etc. are meant as one-per-page, matching editorBlocksPanel's
  // `used = usedTypes.has(cfg.key)` gate in templateEnginesections.html.
  const usedTypes = new Set((appState.data.content ?? []).map((b) => b.type))
  const selectedLabel = selectedItem
    ? ((config.components as Record<string, { label?: string }>)[selectedItem.type]?.label ??
      selectedItem.type)
    : null

  return (
    <div style={{ background: OD.panel, color: '#e5e7eb' }} className="rounded-b-xl p-2.5">
      <div
        className="mb-2 rounded-lg p-2 text-[10px]"
        style={
          selectedLabel
            ? { background: '#38bdf81a', border: '1px solid #38bdf855', color: '#bfe6fb' }
            : { color: '#7f8794' }
        }
      >
        {selectedLabel ? (
          <>
            New blocks insert just below <b>&ldquo;{selectedLabel}&rdquo;</b>.
          </>
        ) : (
          <>
            No block selected — new blocks add to the <b style={{ color: '#c7ccd3' }}>bottom</b>.
          </>
        )}
      </div>

      <div
        className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide"
        style={{ color: OD.muted }}
      >
        Add a section
      </div>
      <div className="flex flex-col gap-1.5">
        {categories.map(([key, cat]) => {
          const Icon = categoryIcon(cat.title ?? key)
          const label = cat.title ?? key
          const used = (cat.components ?? []).some((compKey) => usedTypes.has(compKey))
          return (
            <button
              key={key}
              onClick={() => !used && onOpenCategory(key)}
              disabled={used}
              title={label}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left disabled:cursor-default"
              style={{
                background: used ? '#1c1e24' : OD.tile,
                border: `1px solid ${OD.tileBd}`,
                color: '#c7ccd3',
                opacity: used ? 0.55 : 1,
              }}
            >
              <Icon size={16} color={TAB_ACCENT.section} strokeWidth={1.75} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-bold leading-tight text-white">
                  {label}
                </span>
                <span
                  className="block truncate text-[10px] leading-tight"
                  style={{ color: OD.muted }}
                >
                  {used ? 'Already added' : `Choose a ${label.toLowerCase()} design`}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div
        className="mb-1.5 mt-3 text-[9.5px] font-extrabold uppercase tracking-wide"
        style={{ color: OD.muted }}
      >
        Inner Content
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {INNER_CONTENT.filter(({ key }) => config.components[key]).map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => insertBlockComponent(dispatch, config, appState.data.content, key, null)}
            className="flex flex-col items-center gap-1 rounded-lg py-2.5 px-1"
            style={{ background: OD.tile, border: `1px solid ${OD.tileBd}`, color: '#c7ccd3' }}
          >
            <Icon size={15} color={TAB_ACCENT.section} strokeWidth={1.75} />
            <span className="text-center text-[10px] font-semibold leading-tight">
              {(config.components as Record<string, { label?: string }>)[key]?.label ?? key}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const ROOT_ZONE = 'root:default-zone'

/** Every top-level block on the page, in order, with drag/up/down/remove —
 *  a dedicated view of the same thing Section's own canvas already lets you
 *  drag-reorder, for when a page has many sections and scrolling the canvas
 *  to drag is slower than working from a flat list. */
function ReorderTab() {
  const { appState, config, dispatch } = usePuck()
  const content = appState.data.content ?? []
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  if (content.length === 0) {
    return (
      <div
        style={{ background: OD.panel, color: OD.muted }}
        className="rounded-b-xl p-8 text-center text-[12.5px] leading-relaxed"
      >
        No sections yet.
        <br />
        Add one from the Section tab first.
      </div>
    )
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= content.length || from === to) return
    dispatch({
      type: 'reorder',
      sourceIndex: from,
      destinationIndex: to,
      destinationZone: ROOT_ZONE,
    })
  }

  return (
    <div style={{ background: OD.panel, color: '#e5e7eb' }} className="rounded-b-xl p-2.5">
      <div
        className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide"
        style={{ color: OD.muted }}
      >
        Page order ({content.length})
      </div>
      <div className="flex flex-col gap-1.5">
        {content.map((block, i) => {
          const label =
            (config.components as Record<string, { label?: string }>)[block.type]?.label ??
            block.type
          return (
            <div
              key={`${block.type}-${i}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragFrom != null) move(dragFrom, i)
                setDragFrom(null)
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-2"
              style={{ background: OD.tile, border: `1px solid ${OD.tileBd}` }}
            >
              <span className="cursor-grab text-slate-500" title="Drag to reorder">
                <GripVertical size={14} />
              </span>
              <span
                className="grid h-5 w-6 shrink-0 place-items-center rounded text-[10px] font-extrabold"
                style={{ background: '#2a2e37', color: '#c7ccd3' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className="min-w-0 flex-1 text-[11px] font-bold leading-tight text-white"
                title={label}
              >
                {label}
              </span>
              {content.length > 1 ? (
                <button
                  onClick={() => dispatch({ type: 'remove', index: i, zone: ROOT_ZONE })}
                  className="rounded p-1 text-slate-400 hover:text-red-400"
                  aria-label="Remove"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ThemeTab() {
  return (
    <div
      style={{ background: OD.panel, color: '#e5e7eb' }}
      className="rounded-b-xl p-4 text-center text-[11px] leading-relaxed"
    >
      <Settings size={18} color={OD.muted} className="mx-auto mb-2" />
      <p style={{ color: OD.muted }}>
        Site-wide colours, typography and button styles live in Theme Engine.
      </p>
      <a
        href="/admin/theme-engine"
        className="mt-2 inline-block rounded-md px-2.5 py-1.5 text-[10.5px] font-semibold"
        style={{ background: TAB_ACCENT.theme, color: '#1a1c12' }}
      >
        Open Theme Engine →
      </a>
    </div>
  )
}

/**
 * Odoo-style Section / Reorder / Style / Theme tab chrome for Puck's
 * `overrides.fields` slot — matches the reference design's 4-tab editor
 * shell exactly (Section/Reorder/Style/Settings; "Theme" here since this
 * app's 4th tab is a real link out to Theme Engine, not the reference's
 * per-block settings panel, which needs a background/padding/shadow data
 * model this app's Puck components don't carry). Section tab is real
 * (category rows open the Insert-a-block modal pre-filtered; Inner Content
 * atoms insert directly). Reorder tab is a flat list of the page's own
 * top-level blocks, independent of Section's picker. Style tab shows
 * Puck's own field editor for the selected block.
 */
export function BlocksPanel({
  children,
  itemSelector,
  projectId,
}: {
  children: React.ReactNode
  /** Puck's `ItemSelector` isn't publicly exported — only truthiness matters here. */
  itemSelector?: unknown
  projectId?: string
}) {
  const [tab, setTab] = useState<'section' | 'reorder' | 'style' | 'theme'>('section')
  const [modalCategory, setModalCategory] = useState<string | null>(null)
  const hadSelection = useRef(false)
  const [editingInstance, setEditingInstance] = useState(false)
  const { selectedItem, dispatch, getSelectorForId } = usePuck()
  const isCustomBlock = selectedItem?.type === 'CustomComposedBlock'

  useEffect(() => {
    const nowSelected = !!itemSelector
    if (nowSelected && !hadSelection.current) setTab('style')
    hadSelection.current = nowSelected
  }, [itemSelector])

  const tabBtn = (key: typeof tab, label: string, Icon: typeof Plus) => (
    <button
      onClick={() => setTab(key)}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-bold"
      style={{
        color: tab === key ? '#fff' : OD.muted,
        borderBottom: `2px solid ${tab === key ? TAB_ACCENT[key] : 'transparent'}`,
      }}
    >
      <Icon size={12} color={tab === key ? TAB_ACCENT[key] : OD.muted} />
      {label}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex" style={{ background: OD.bg }}>
        {tabBtn('section', 'Section', Plus)}
        {tabBtn('reorder', 'Reorder', ArrowUpDown)}
        {tabBtn('style', 'Style', Pencil)}
        {tabBtn('theme', 'Theme', Settings)}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'section' && <BlocksTab onOpenCategory={setModalCategory} />}
        {tab === 'reorder' && <ReorderTab />}
        {tab === 'style' && isCustomBlock ? (
          <div className="bg-white p-4">
            <button
              onClick={() => setEditingInstance(true)}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Edit in Composer
            </button>
          </div>
        ) : null}
        {tab === 'style' && !isCustomBlock && <div className="bg-white">{children}</div>}
        {tab === 'theme' && <ThemeTab />}
      </div>
      {modalCategory ? (
        <SectionPickerPopup
          categoryKey={modalCategory}
          projectId={projectId}
          onClose={() => setModalCategory(null)}
        />
      ) : null}
      {editingInstance && selectedItem ? (
        <BlockComposer
          projectId=""
          categoryKey={(selectedItem.props.config as ComposedBlockConfig).category}
          skipPersist
          editing={{
            id: selectedItem.props.id as string,
            projectId: '',
            categoryKey: (selectedItem.props.config as ComposedBlockConfig).category,
            name: 'This block',
            description: null,
            status: 'DRAFT',
            isDefault: false,
            config: selectedItem.props.config as ComposedBlockConfig,
            updatedAt: '',
          }}
          onClose={() => setEditingInstance(false)}
          onSaved={(block) => {
            const selector = getSelectorForId(selectedItem.props.id as string)
            if (selector) {
              dispatch({
                type: 'replace',
                destinationIndex: selector.index,
                destinationZone: selector.zone,
                data: {
                  type: 'CustomComposedBlock',
                  props: { ...selectedItem.props, config: block.config },
                },
              })
            }
            setEditingInstance(false)
          }}
        />
      ) : null}
    </div>
  )
}
