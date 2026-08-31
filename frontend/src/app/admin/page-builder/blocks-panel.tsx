'use client'

import { useEffect, useRef, useState } from 'react'
import { usePuck } from '@puckeditor/core'
import {
  Plus,
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
} from 'lucide-react'
import { InsertBlockModal, insertBlockComponent } from './insert-block-modal'
import { BlockComposer } from './packs/composer/BlockComposer'
import type { ComposedBlockConfig } from './packs/composer/render-composed-block'

/** Odoo-style chrome colours, matched to the reference prototype. */
const OD = { bg: '#1c1e24', panel: '#181b21', tile: '#23262e', tileBd: '#2d313a', muted: '#8b93a1' }
const TAB_ACCENT = { blocks: '#22c55e', style: '#38bdf8', theme: '#c4e04a' }

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
        Blocks
      </div>
      <div className="flex flex-col gap-1.5">
        {categories.map(([key, cat]) => {
          const Icon = categoryIcon(cat.title ?? key)
          return (
            <button
              key={key}
              onClick={() => onOpenCategory(key)}
              title={cat.title ?? key}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-left"
              style={{ background: OD.tile, border: `1px solid ${OD.tileBd}`, color: '#c7ccd3' }}
            >
              <Icon size={16} color={TAB_ACCENT.blocks} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate text-[10.5px] font-semibold leading-tight">
                {cat.title ?? key}
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
            <Icon size={15} color={TAB_ACCENT.blocks} strokeWidth={1.75} />
            <span className="text-center text-[10px] font-semibold leading-tight">
              {(config.components as Record<string, { label?: string }>)[key]?.label ?? key}
            </span>
          </button>
        ))}
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
 * Odoo-style Blocks / Style / Theme tab chrome for Puck's `overrides.fields`
 * slot. Blocks tab is real (category tiles open the Insert-a-block modal
 * pre-filtered; Inner Content atoms insert directly). Style tab shows Puck's
 * own field editor for the selected block — the prototype's generic
 * background/padding/shadow/animation controls need a per-block style data
 * model this app doesn't have yet, so this reuses per-component fields
 * instead of faking those controls. Theme tab points at the real Theme
 * Engine module rather than mocking colours/typography here.
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
  const [tab, setTab] = useState<'blocks' | 'style' | 'theme'>('blocks')
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
        {tabBtn('blocks', 'Blocks', Plus)}
        {tabBtn('style', 'Style', Pencil)}
        {tabBtn('theme', 'Theme', Settings)}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'blocks' && <BlocksTab onOpenCategory={setModalCategory} />}
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
        <InsertBlockModal
          initialCategory={modalCategory}
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
