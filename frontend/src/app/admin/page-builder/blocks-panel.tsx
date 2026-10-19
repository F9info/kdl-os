'use client'

import { isLegacyNumberedKey } from './packs/numbered-families'
import { useEffect, useRef, useState } from 'react'
import { usePuck, AutoField, FieldLabel } from '@puckeditor/core'
import type { Field } from '@puckeditor/core'
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
          // Every insert (insertBlockComponent) always appends a brand-new
          // block with its own id — never replaces an existing one — so
          // there's no technical reason a section can only be added once
          // per page. This used to gray out (and block) a category once
          // any instance of it existed, which made it impossible to add a
          // second copy of the same block/slider on one page.
          const usedOnPage = (cat.components ?? []).some((compKey) => usedTypes.has(compKey))
          return (
            <button
              key={key}
              onClick={() => onOpenCategory(key)}
              title={label}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left"
              style={{
                background: OD.tile,
                border: `1px solid ${OD.tileBd}`,
                color: '#c7ccd3',
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
                  {usedOnPage
                    ? `Add another ${label.toLowerCase()}`
                    : `Choose a ${label.toLowerCase()} design`}
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

function ThemeEngineLink() {
  return (
    <div
      style={{ background: OD.panel, color: '#e5e7eb' }}
      className="p-4 text-center text-[11px] leading-relaxed"
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
 * A field key counts as "Style" (appearance/behaviour, not what it says) if
 * it's one of these exact names or ends in "Color" / starts with "show" —
 * every pack component in this app names its padding/background/align/
 * variant/colour/visibility-toggle fields this way, so this one heuristic
 * covers Style vs Content for every block without rewriting each
 * component's `fields` schema. Puck's own field editor (`children`, used by
 * the old single Style tab) can't be split by tag — it hands back one
 * opaque rendered tree — so this renders each field itself via Puck's
 * exported `AutoField`/`FieldLabel` instead, keyed straight off the
 * component's own `Config.components[type].fields`.
 *
 * Two more prefixes route to Style but render in their own collapsible
 * group instead of the flat list: `slider*` (arrows/dots/autoplay/loop/
 * fade-or-slide — the Slick-style carousel knobs) and `typo*` (per-element
 * font size/weight/color for title/tagline/paragraph/button). A block only
 * needs to name its fields this way — see `ConstructionHero` — to get both
 * accordions for free.
 */
/** Fields kept in a component's `fields` schema (Puck requires an entry per
 *  prop — dropping one there breaks type-checking and any already-published
 *  page still carrying that prop's saved value) but hidden from both panel
 *  tabs for that one component — `variant`/`primaryColor`/`secondaryColor`
 *  on `ConstructionHero` are redundant now that the Slider Settings/
 *  Typography accordions cover styling, per explicit request. Scoped by
 *  component type so hiding `variant` here doesn't hide every other
 *  block's own design picker. */
const HIDDEN_FIELDS: Record<string, Set<string>> = {
  ConstructionHero: new Set(['variant', 'primaryColor', 'secondaryColor']),
  ConstructionOurBrands: new Set([
    'tab1Label',
    'tab1Groups',
    'tab2Label',
    'tab2Groups',
    'tab3Label',
    'tab3Groups',
  ]),
}

const STYLE_FIELD_KEYS = new Set(['padding', 'background', 'align', 'variant', 'spacing', 'gap'])
function isStyleField(key: string): boolean {
  return (
    STYLE_FIELD_KEYS.has(key) ||
    /Color$/.test(key) ||
    /^show[A-Z]/.test(key) ||
    /^slider/.test(key) ||
    /^typo/.test(key)
  )
}

/** Direct-dispatch prop update for one field on the selected item — same
 *  `replace` action the Composer's "Edit in Composer" save path already
 *  uses (below), just merging one prop instead of swapping `config`. */
function useUpdateSelectedProp() {
  const { selectedItem, dispatch, getSelectorForId } = usePuck()
  return (key: string, value: unknown) => {
    if (!selectedItem) return
    const id = selectedItem.props?.id as string | undefined
    const selector = id ? getSelectorForId(id) : null
    if (!selector) return
    dispatch({
      type: 'replace',
      destinationIndex: selector.index,
      destinationZone: selector.zone,
      data: { ...selectedItem, props: { ...selectedItem.props, [key]: value } },
    })
  }
}

/** Collapsible field group for the Style tab (native `<details>` — no extra
 *  state, no dependency). Open by default: with only two possible groups
 *  (Slider Settings, Typography) hiding them by default costs an extra
 *  click for no real space saved. */
function FieldAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border-t border-slate-100">
      <summary className="flex cursor-pointer list-none select-none items-center justify-between px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {title}
        <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-3 p-3 pt-0">{children}</div>
    </details>
  )
}

/** Best-effort human label for a slide/card array item, tried in the order
 *  the real components actually use these keys. */
function slideItemLabel(item: Record<string, unknown>, index: number): string {
  const candidate = item.dotLabel ?? item.title ?? item.headline ?? item.lead ?? item.name
  return typeof candidate === 'string' && candidate.trim() ? candidate : `Slide ${index + 1}`
}

/** Puck's own array-field expand/collapse UI has no externally-readable
 *  "which item is open" id (it's a random `useId()` per AutoField mount,
 *  invisible outside Puck's internals) — so clicking an array item there
 *  can't drive the canvas preview. This is a separate, dedicated picker
 *  row that writes a plain `activeSlideIndex` prop instead (read by the
 *  slide/slider components' own render functions to pick which slide to
 *  show), so "select a slide here, see it on the canvas" has a real,
 *  reliable target to click. */
function SlidePreviewPicker({
  slides,
  activeIndex,
  onSelect,
}: {
  slides: Record<string, unknown>[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {slides.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            i === activeIndex
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {slideItemLabel(item, i)}
        </button>
      ))}
    </div>
  )
}

function FieldList({
  entries,
  values,
  update,
}: {
  entries: [string, Field][]
  values: Record<string, unknown>
  update: (key: string, value: unknown) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map(([key, field]) => {
        const arrayValue = values[key]
        const showSlidePicker =
          field.type === 'array' &&
          /slides$/i.test(key) &&
          Array.isArray(arrayValue) &&
          arrayValue.length > 0
        return (
          <FieldLabel key={key} label={key}>
            {showSlidePicker && (
              <SlidePreviewPicker
                slides={arrayValue as Record<string, unknown>[]}
                activeIndex={
                  typeof values.activeSlideIndex === 'number' ? values.activeSlideIndex : 0
                }
                onSelect={(i) => update('activeSlideIndex', i)}
              />
            )}
            <AutoField field={field} value={values[key]} onChange={(value) => update(key, value)} />
          </FieldLabel>
        )
      })}
    </div>
  )
}

function SplitFieldEditor({ group }: { group: 'style' | 'content' }) {
  const { config, selectedItem } = usePuck()
  const update = useUpdateSelectedProp()
  if (!selectedItem) {
    return (
      <div className="p-4 text-center text-[12px] text-slate-400">Select a section to edit.</div>
    )
  }
  const component = (
    config.components as
      | Record<
          string,
          {
            fields?: Record<string, Field>
            resolveFields?: (
              data: unknown,
              params: { fields: Record<string, Field> }
            ) => Record<string, Field>
          }
        >
      | undefined
  )?.[selectedItem.type as string]
  const staticFields = component?.fields ?? {}
  // Components with a Design-1..4-style `variant` picker (Hero, Header,
  // TopBar, ...) declare `resolveFields` to hide every other variant's own
  // fields — call it here too, not just static `fields`, otherwise this
  // panel shows all 4 designs' fields (and all 4 designs' slide arrays)
  // stacked at once regardless of which design is selected.
  const fields = component?.resolveFields
    ? component.resolveFields(selectedItem, { fields: staticFields })
    : staticFields
  const hidden = HIDDEN_FIELDS[selectedItem.type as string]
  const entries = Object.entries(fields).filter(
    ([key]) =>
      !hidden?.has(key) &&
      !isLegacyNumberedKey(selectedItem.type as string, key) &&
      isStyleField(key) === (group === 'style')
  )
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-[12px] text-slate-400">
        No {group} settings on this block.
      </div>
    )
  }
  const values = selectedItem.props as Record<string, unknown>
  if (group === 'content') {
    return (
      <div className="p-3">
        <FieldList entries={entries} values={values} update={update} />
      </div>
    )
  }
  const generalEntries = entries.filter(([key]) => !/^slider/.test(key) && !/^typo/.test(key))
  const sliderEntries = entries.filter(([key]) => /^slider/.test(key))
  const typoEntries = entries.filter(([key]) => /^typo/.test(key))
  return (
    <div className="flex flex-col">
      {generalEntries.length > 0 && (
        <div className="p-3">
          <FieldList entries={generalEntries} values={values} update={update} />
        </div>
      )}
      {sliderEntries.length > 0 && (
        <FieldAccordion title="Slider Settings">
          <FieldList entries={sliderEntries} values={values} update={update} />
        </FieldAccordion>
      )}
      {typoEntries.length > 0 && (
        <FieldAccordion title="Typography">
          <FieldList entries={typoEntries} values={values} update={update} />
        </FieldAccordion>
      )}
    </div>
  )
}

/**
 * Odoo-style Section / Reorder / Style / Content tab chrome for Puck's
 * `overrides.fields` slot — matches the reference design's 4-tab editor
 * shell (Section/Reorder/Style/Settings). Section tab is real (category
 * rows open the Insert-a-block modal pre-filtered; Inner Content atoms
 * insert directly). Reorder tab is a flat list of the page's own top-level
 * blocks, independent of Section's picker. Style and Content both render
 * the selected block's own fields (via `SplitFieldEditor`, split by
 * `isStyleField`) — Style gets padding/background/align/variant/colour/
 * visibility-toggle fields, Content gets everything else (text, images,
 * slide add/remove, ...). A Theme Engine link sits under Content since
 * site-wide colours/typography live there, not on the block.
 */
export function BlocksPanel({
  itemSelector,
  projectId,
}: {
  /** Puck's own field editor — no longer rendered; Style/Content each build
   *  their own view from the selected block's `fields` schema instead (see
   *  `SplitFieldEditor`). Still accepted since Puck's `overrides.fields`
   *  slot always passes it. */
  children?: React.ReactNode
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
        {tabBtn('theme', 'Content', Settings)}
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
        {tab === 'style' && !isCustomBlock && (
          <div className="bg-white">
            <SplitFieldEditor group="style" />
          </div>
        )}
        {tab === 'theme' &&
          (isCustomBlock ? (
            <div className="rounded-b-xl overflow-hidden">
              <ThemeEngineLink />
            </div>
          ) : (
            <div className="bg-white">
              <SplitFieldEditor group="content" />
              <ThemeEngineLink />
            </div>
          ))}
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
