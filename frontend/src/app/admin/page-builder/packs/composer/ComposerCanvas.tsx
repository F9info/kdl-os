'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Trash2, GripVertical, ChevronUp, Eye, Plus, X } from 'lucide-react'
import {
  ATOM_CATALOGUE,
  ATOM_GROUPS,
  ATOM_BY_TYPE,
  ChipRow,
  layoutContainerStyle,
  childWrapStyle,
  atomStyleProps,
  AtomStyleField,
  normalizeGridColumns,
  ComposerProjectContext,
  type ComposerAtom,
} from './atoms'
import { atomCatalogueFor } from './catalogue-by-category'
import { DEFAULT_SETTINGS, type ComposedBlockConfig } from './render-composed-block'
import {
  createCustomBlock,
  updateCustomBlock,
  getBrandDefaults,
  type BrandDefaults,
  type CustomBlockRecord,
} from './custom-blocks-store'

function newAtomId(type: string) {
  return `${type}-${crypto.randomUUID()}`
}

// "Select your structure" tile grid for + Add Row — a curated set of the
// most common column splits (not every possible column count/ratio; more
// unusual splits are still reachable afterward via the per-child Column
// span/offset controls once elements are in the row). `ratios` drives the
// little preview diagram; `columns` is the actual grid track count created
// (an uneven split like 1:2 still needs 3 total tracks so a span-1 + span-2
// child can occupy them — the row starts empty, so which child gets which
// span is set afterward, same as any other grid row).
interface StructurePreset {
  id: string
  label: string
  mode: 'grid' | 'stack'
  columns?: number
  ratios: number[] | 'stack'
}
const STRUCTURE_PRESETS: StructurePreset[] = [
  { id: '1col', label: '1 column', mode: 'grid', columns: 1, ratios: [1] },
  { id: '2col', label: '2 columns', mode: 'grid', columns: 2, ratios: [1, 1] },
  { id: '3col', label: '3 columns', mode: 'grid', columns: 3, ratios: [1, 1, 1] },
  { id: '4col', label: '4 columns', mode: 'grid', columns: 4, ratios: [1, 1, 1, 1] },
  { id: '1-3+2-3', label: '1/3 + 2/3', mode: 'grid', columns: 3, ratios: [1, 2] },
  { id: '2-3+1-3', label: '2/3 + 1/3', mode: 'grid', columns: 3, ratios: [2, 1] },
  { id: '6col', label: '6 columns', mode: 'grid', columns: 6, ratios: [1, 1, 1, 1, 1, 1] },
  {
    id: '12col',
    label: '12 columns',
    mode: 'grid',
    columns: 12,
    ratios: Array(12).fill(1),
  },
  { id: 'stack', label: 'Stack', mode: 'stack', ratios: 'stack' },
]

function StructurePreview({ preset }: { preset: StructurePreset }) {
  if (preset.ratios === 'stack') {
    return (
      <div className="flex h-9 w-14 flex-col justify-between gap-1 p-0.5">
        <div className="h-full flex-1 rounded-sm bg-slate-300" />
        <div className="h-full flex-1 rounded-sm bg-slate-300" />
        <div className="h-full flex-1 rounded-sm bg-slate-300" />
      </div>
    )
  }
  return (
    <div
      className="grid h-9 w-14 gap-1"
      style={{ gridTemplateColumns: preset.ratios.map((r) => `${r}fr`).join(' ') }}
    >
      {preset.ratios.map((_, i) => (
        <div key={i} className="rounded-sm bg-slate-300" />
      ))}
    </div>
  )
}

// Tree helpers over ComposerAtom[] — atoms nest via `children` (only 'layout'
// atoms use it), so every add/move/remove has to walk the whole tree instead
// of a flat array. Pure functions, no component state, so they live at module
// scope rather than being recreated every render.

function findAtom(atoms: ComposerAtom[], id: string): ComposerAtom | null {
  for (const a of atoms) {
    if (a.id === id) return a
    if (a.children) {
      const found = findAtom(a.children, id)
      if (found) return found
    }
  }
  return null
}

function containsId(atom: ComposerAtom, id: string): boolean {
  if (atom.id === id) return true
  return (atom.children ?? []).some((c) => containsId(c, id))
}

function extractAtom(
  atoms: ComposerAtom[],
  id: string
): { removed: ComposerAtom | null; next: ComposerAtom[] } {
  let removed: ComposerAtom | null = null
  function walk(list: ComposerAtom[]): ComposerAtom[] {
    const next: ComposerAtom[] = []
    for (const a of list) {
      if (a.id === id) {
        removed = a
        continue
      }
      next.push(a.children ? { ...a, children: walk(a.children) } : a)
    }
    return next
  }
  // `walk` must run (and populate `removed` via closure) before `removed` is
  // read — an object literal `{ removed, next: walk(atoms) }` evaluates the
  // `removed` property first, capturing it as still-null every single time.
  const next = walk(atoms)
  return { removed, next }
}

function insertBeforeId(
  atoms: ComposerAtom[],
  targetId: string,
  newAtom: ComposerAtom
): ComposerAtom[] {
  const idx = atoms.findIndex((a) => a.id === targetId)
  if (idx >= 0) {
    const next = [...atoms]
    next.splice(idx, 0, newAtom)
    return next
  }
  return atoms.map((a) =>
    a.children ? { ...a, children: insertBeforeId(a.children, targetId, newAtom) } : a
  )
}

// Atom types with a brand-fillable placeholder — see the addAtom() prefetch.
const BRAND_PREFILL_TYPES = new Set(['logo', 'nav', 'heading', 'text', 'button', 'badge'])

/** Applies whichever brand default this atom type uses, only while it's
 *  still at its untouched default (own content default, or no Style yet) —
 *  never clobbers a manual edit made before the fetch resolved. */
function applyBrandDefaults(a: ComposerAtom, brand: BrandDefaults): ComposerAtom {
  if (a.type === 'logo') {
    if (a.src !== '' || a.text !== 'Your Brand') return a
    if (!brand.logoUrl && !brand.companyName) return a
    return { ...a, src: brand.logoUrl || a.src, text: brand.companyName || a.text }
  }
  if (a.type === 'nav') {
    if (a.items !== 'Home, About, Services, Contact' || !brand.navigationItems) return a
    return { ...a, items: brand.navigationItems }
  }
  if (a.type === 'heading') {
    if (a.style || !brand.headingFamily) return a
    return { ...a, style: { fontFamily: brand.headingFamily } }
  }
  if (a.type === 'text') {
    if (a.style || !brand.bodyFamily) return a
    return { ...a, style: { fontFamily: brand.bodyFamily } }
  }
  if (a.type === 'button' || a.type === 'badge') {
    if (a.style || !brand.primaryColor) return a
    return { ...a, style: { bgColor: brand.primaryColor, textColor: '#ffffff' } }
  }
  return a
}

function updateNodeById(
  atoms: ComposerAtom[],
  id: string,
  updater: (a: ComposerAtom) => ComposerAtom
): ComposerAtom[] {
  return atoms.map((a) => {
    if (a.id === id) return updater(a)
    if (a.children) return { ...a, children: updateNodeById(a.children, id, updater) }
    return a
  })
}

function swapWithPrev(atoms: ComposerAtom[], id: string): ComposerAtom[] {
  const idx = atoms.findIndex((a) => a.id === id)
  if (idx > 0) {
    const next = [...atoms]
    ;[next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!]
    return next
  }
  if (idx === 0) return atoms
  return atoms.map((a) => (a.children ? { ...a, children: swapWithPrev(a.children, id) } : a))
}

/** null = the atom is at the section root; undefined = not found in the tree. */
function parentIdOf(
  atoms: ComposerAtom[],
  id: string,
  parent: string | null = null
): string | null | undefined {
  for (const a of atoms) {
    if (a.id === id) return parent
    if (a.children) {
      const found = parentIdOf(a.children, id, a.id)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * The section-builder canvas: a grouped element palette, a live white canvas
 * card on a dark backdrop, and a per-element Settings panel — deliberately
 * matching the reference design (sectionBuilder.html) exactly: dark Odoo-ish
 * chrome (#14161b/#181b21/#20232a), five palette groups (Basic, Branding &
 * Navigation, Media, Content, Advanced), and a Settings panel that edits
 * only the selected element (no section-wide layout/style tabs — the
 * reference doesn't have them, so neither does this).
 */
export function ComposerCanvas({
  projectId,
  categoryKey,
  editing,
  skipPersist,
  onClose,
  onSaved,
}: {
  projectId: string
  categoryKey: string
  /** Present when reopening an existing custom block to edit it. */
  editing?: CustomBlockRecord
  /**
   * Skip the template-persistence API entirely and hand the composed config
   * straight to `onSaved` — used when editing the config already sitting
   * inside one page instance, where `editing.id` is that instance's Puck id
   * (not a CustomBlockTemplate row), so a real PUT would 404 or, at best,
   * silently rewrite the shared template instead of just this instance.
   */
  skipPersist?: boolean
  onClose: () => void
  onSaved: (block: CustomBlockRecord) => void
}) {
  const [name, setName] = useState(editing?.name ?? 'Untitled block')
  const [config, setConfig] = useState<ComposedBlockConfig>(
    editing?.config ?? { category: categoryKey, atoms: [], settings: DEFAULT_SETTINGS }
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Unifies two drag sources over the same canvas drop targets: reordering an
  // atom already on the canvas, and dragging a brand-new one in from the
  // palette (the palette itself has no drop targets — only click-to-add).
  const [dragPayload, setDragPayload] = useState<
    { kind: 'existing'; id: string } | { kind: 'new'; type: string } | null
  >(null)
  // Which 'layout' atom new palette adds land in (null = section root) —
  // set by selecting a layout atom, or the parent of whatever else you select.
  const [activeContainerId, setActiveContainerId] = useState<string | null>(null)
  // The "+ Add Row" Grid/Flex/Stack chooser — a direct shortcut to the same
  // 'layout' atom the palette tile creates, since burying it one click deep
  // in the Content group wasn't discoverable enough on an empty canvas.
  const [showRowMenu, setShowRowMenu] = useState(false)
  // Same structure-picker as "+ Add Row", but scoped to a single column
  // inside an existing grid row — turns that one column's plain element into
  // a nested row (its own sub-grid), for "a row inside a column". Holds the
  // id of whichever column's picker is currently open (null = none).
  const [nestRowMenuFor, setNestRowMenuFor] = useState<string | null>(null)
  // Content vs Style tab in the right-hand Settings panel for the selected
  // atom — Content is that atom's own Field (text/links/etc), Style is the
  // generic Elementor-style color/background/border/shadow/padding panel
  // that applies the same way to every atom type.
  const [settingsTab, setSettingsTab] = useState<'content' | 'style'>('content')

  const palette = atomCatalogueFor(categoryKey)
  const paletteByGroup = ATOM_GROUPS.map((group) => ({
    group,
    atoms: palette.filter((a) => a.group === group),
  })).filter((g) => g.atoms.length > 0)

  function addAtom(
    type: string,
    containerId: string | null = null,
    overrides?: Record<string, unknown>
  ) {
    const def = ATOM_CATALOGUE.find((a) => a.type === type)
    if (!def) return
    const atom: ComposerAtom = { id: newAtomId(type), type, ...def.defaultProps, ...overrides }

    // These atoms' own defaults are static placeholders ('Your Brand', the
    // CSV nav list, a plain black-on-white button/badge, the browser's
    // default font) — none has a live binding to any brand (a block built
    // here can be reused on a different site later), but prefilling with
    // the site's actual logo/nav/colors/fonts on drop saves the near-
    // universal case of building THIS site's own content. Only overwrites
    // while the atom is still untouched, in case the fetch resolves after
    // the user already edited it.
    if (BRAND_PREFILL_TYPES.has(type)) {
      const atomId = atom.id
      getBrandDefaults(projectId)
        .then((brand) => {
          setConfig((c) => ({
            ...c,
            atoms: updateNodeById(c.atoms, atomId, (a) => applyBrandDefaults(a, brand)),
          }))
        })
        .catch(() => {})
    }

    // Section > Container > Layout > Elements — a plain element never sits
    // bare directly under the section root. The first thing landing at the
    // root auto-creates its own 1-column Grid row around it, so every
    // element always has real Grid/Flex/Stack settings one click away (on
    // its row), not just its own content fields.
    if (containerId === null && type !== 'layout') {
      const layoutDef = ATOM_CATALOGUE.find((a) => a.type === 'layout')
      if (layoutDef) {
        const wrapper: ComposerAtom = {
          id: newAtomId('layout'),
          type: 'layout',
          ...layoutDef.defaultProps,
          columns: 1,
          children: [atom],
        }
        setConfig((c) => ({ ...c, atoms: [...c.atoms, wrapper] }))
        setSelectedId(atom.id)
        setActiveContainerId(wrapper.id)
        return atom
      }
    }

    setConfig((c) => ({
      ...c,
      atoms: containerId
        ? normalizeGridColumns(
            updateNodeById(c.atoms, containerId, (parent) => ({
              ...parent,
              children: [...(parent.children ?? []), atom],
            }))
          )
        : [...c.atoms, atom],
    }))
    setSelectedId(atom.id)
    setActiveContainerId(atom.type === 'layout' ? atom.id : containerId)
    return atom
  }

  function addLayoutRow(mode: 'grid' | 'flex' | 'stack', columns?: number) {
    addAtom('layout', null, {
      mode,
      direction: mode === 'stack' ? 'vertical' : 'row',
      ...(columns ? { columns } : {}),
    })
    setShowRowMenu(false)
  }

  /** Replaces one column's plain element in place with a new 'layout' atom
   *  (the picked structure) wrapping that same element as its first child —
   *  the column keeps its own grid position (colSpan/colStart), it just now
   *  holds a nested row instead of a single element. */
  function wrapChildInNestedLayout(childId: string, mode: 'grid' | 'stack', columns?: number) {
    const layoutDef = ATOM_CATALOGUE.find((a) => a.type === 'layout')
    if (!layoutDef) return
    setConfig((c) => ({
      ...c,
      atoms: normalizeGridColumns(
        updateNodeById(c.atoms, childId, (child) => ({
          id: newAtomId('layout'),
          type: 'layout',
          ...layoutDef.defaultProps,
          mode,
          direction: mode === 'stack' ? 'vertical' : 'row',
          ...(columns ? { columns } : {}),
          colSpan: child.colSpan,
          colStart: child.colStart,
          children: [{ ...child, colSpan: undefined, colStart: undefined }],
        }))
      ),
    }))
    setNestRowMenuFor(null)
  }

  function patchAtom(id: string, patch: Record<string, unknown>) {
    setConfig((c) => ({ ...c, atoms: updateNodeById(c.atoms, id, (a) => ({ ...a, ...patch })) }))
  }

  /** Set one element's width out of 12. The row is switched to a 12-track
   *  grid first (siblings rescaled so they keep their look), so every
   *  element is sized independently and the row total is never a thing the
   *  user has to manage. */
  function setChildSpan(parentId: string, childId: string, span: number) {
    setConfig((c) => ({
      ...c,
      atoms: updateNodeById(c.atoms, parentId, (parent) => {
        const cols = Math.max(1, Math.min(12, Number(parent.columns ?? 2)))
        const k = 12 / cols
        return {
          ...parent,
          columns: 12,
          children: (parent.children ?? []).map((ch) => {
            const start = Number(ch.colStart ?? 0)
            const next = {
              ...ch,
              colSpan: Math.max(1, Math.round(Number(ch.colSpan ?? 1) * k)),
              colStart: start > 0 ? Math.min(12, Math.round((start - 1) * k) + 1) : ch.colStart,
            }
            return ch.id === childId ? { ...next, colSpan: span } : next
          }),
        }
      }),
    }))
  }

  function removeAtom(id: string) {
    setConfig((c) => ({ ...c, atoms: extractAtom(c.atoms, id).next }))
    if (selectedId === id) setSelectedId(null)
    if (activeContainerId === id) setActiveContainerId(null)
  }

  function moveAtomUp(id: string) {
    setConfig((c) => ({ ...c, atoms: swapWithPrev(c.atoms, id) }))
  }

  /** Reorder/reparent an atom already on the canvas to sit just before `beforeId`. */
  function moveAtom(fromId: string, beforeId: string) {
    if (fromId === beforeId) return
    setConfig((c) => {
      const moved = findAtom(c.atoms, fromId)
      if (!moved || containsId(moved, beforeId)) return c
      const { removed, next } = extractAtom(c.atoms, fromId)
      if (!removed) return c
      return { ...c, atoms: normalizeGridColumns(insertBeforeId(next, beforeId, removed)) }
    })
  }

  /** Move an atom already on the canvas into a container's empty drop zone
   *  (or back to the section root when `containerId` is null). */
  function moveIntoContainer(id: string, containerId: string | null) {
    setConfig((c) => {
      const moved = findAtom(c.atoms, id)
      if (!moved) return c
      if (containerId && (id === containerId || containsId(moved, containerId))) return c
      const { removed, next } = extractAtom(c.atoms, id)
      if (!removed) return c
      if (!containerId) return { ...c, atoms: [...next, removed] }
      return {
        ...c,
        atoms: normalizeGridColumns(
          updateNodeById(next, containerId, (parent) => ({
            ...parent,
            children: [...(parent.children ?? []), removed],
          }))
        ),
      }
    })
  }

  function insertNewAtomBefore(type: string, beforeId: string) {
    const def = ATOM_CATALOGUE.find((a) => a.type === type)
    if (!def) return
    const atom: ComposerAtom = { id: newAtomId(type), type, ...def.defaultProps }
    setConfig((c) => ({
      ...c,
      atoms: normalizeGridColumns(insertBeforeId(c.atoms, beforeId, atom)),
    }))
    setSelectedId(atom.id)
  }

  /** `beforeId` set = dropped on an existing atom (insert/move before it).
   *  `beforeId` null = dropped on a container's empty area (`containerId`,
   *  null for the section root itself). */
  function handleCanvasDrop(beforeId: string | null, containerId: string | null) {
    if (dragPayload?.kind === 'existing') {
      if (beforeId) moveAtom(dragPayload.id, beforeId)
      else moveIntoContainer(dragPayload.id, containerId)
    } else if (dragPayload?.kind === 'new') {
      if (beforeId) insertNewAtomBefore(dragPayload.type, beforeId)
      else addAtom(dragPayload.type, containerId)
    }
    setDragPayload(null)
  }

  function selectAtom(atom: ComposerAtom) {
    setSelectedId(atom.id)
    setActiveContainerId(
      atom.type === 'layout' ? atom.id : (parentIdOf(config.atoms, atom.id) ?? null)
    )
  }

  async function handleSave(status: 'DRAFT' | 'PUBLISHED') {
    setSaving(true)
    try {
      if (skipPersist) {
        onSaved({
          id: editing?.id ?? '',
          projectId,
          categoryKey,
          name,
          description: editing?.description ?? null,
          status,
          isDefault: editing?.isDefault ?? false,
          config,
          updatedAt: new Date().toISOString(),
        })
        return
      }
      const block = editing
        ? await updateCustomBlock(editing.id, projectId, { name, status, config })
        : await createCustomBlock({ projectId, categoryKey, name, status, config })
      onSaved(block)
    } finally {
      setSaving(false)
    }
  }

  const selectedAtom = selectedId ? findAtom(config.atoms, selectedId) : null
  const selectedDef = selectedAtom ? ATOM_BY_TYPE[selectedAtom.type] : null
  const selectedParentId = selectedAtom ? parentIdOf(config.atoms, selectedAtom.id) : undefined
  const selectedParent = selectedParentId ? findAtom(config.atoms, selectedParentId) : null
  const selectedParentIsGrid =
    selectedParent?.type === 'layout' && String(selectedParent.mode ?? 'grid') === 'grid'

  /** Drag the right edge of a grid child to set its colSpan, snapping to
   *  the parent's column tracks (width / columns). */
  function startSpanResize(e: React.MouseEvent, atom: ComposerAtom, parent: ComposerAtom) {
    e.preventDefault()
    e.stopPropagation()
    const node = (e.currentTarget as HTMLElement).parentElement
    const grid = node?.parentElement
    if (!node || !grid) return
    const colW = grid.getBoundingClientRect().width / 12
    const left = node.getBoundingClientRect().left
    let last = -1
    const onMove = (ev: MouseEvent) => {
      const span = Math.max(1, Math.min(12, Math.round((ev.clientX - left) / colW)))
      if (span !== last) {
        last = span
        setChildSpan(parent.id, atom.id, span)
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function renderAtomNode(atom: ComposerAtom, containerId: string | null): ReactNode {
    const def = ATOM_BY_TYPE[atom.type]
    if (!def) return null
    const selected = selectedId === atom.id
    const isActiveContainer = atom.type === 'layout' && activeContainerId === atom.id
    const siblings = containerId
      ? (findAtom(config.atoms, containerId)?.children ?? [])
      : config.atoms
    const idx = siblings.findIndex((a) => a.id === atom.id)
    const parent = containerId ? findAtom(config.atoms, containerId) : null

    return (
      <div
        key={atom.id}
        style={parent ? childWrapStyle(parent, atom) : undefined}
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          setDragPayload({ kind: 'existing', id: atom.id })
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', atom.id)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleCanvasDrop(atom.id, containerId)
        }}
        onClick={(e) => {
          e.stopPropagation()
          selectAtom(atom)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            selectAtom(atom)
          }
        }}
        className={`group relative border-2 p-4 transition ${
          selected
            ? 'border-[#38bdf8]'
            : isActiveContainer
              ? 'border-[#38bdf880]'
              : 'border-transparent hover:border-[#38bdf866]'
        }`}
      >
        <div
          className={`absolute right-1.5 top-1.5 z-10 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-lg transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span
            className="grid h-6 w-6 cursor-grab place-items-center rounded text-slate-500 hover:bg-slate-100"
            title="Drag to reorder"
          >
            <GripVertical size={13} />
          </span>
          {idx > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                moveAtomUp(atom.id)
              }}
              className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100"
              title="Move up"
            >
              <ChevronUp size={13} />
            </button>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeAtom(atom.id)
            }}
            className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
        <div style={atomStyleProps(atom).style}>
          {atom.type === 'layout' ? renderLayoutBody(atom) : def.Render(atom)}
        </div>
        {parent?.type === 'layout' &&
        String(parent.mode ?? 'grid') === 'grid' &&
        atom.type !== 'layout' ? (
          <div className="relative z-20 mt-2 flex justify-center">
            <button
              draggable={false}
              onClick={(e) => {
                e.stopPropagation()
                setNestRowMenuFor(nestRowMenuFor === atom.id ? null : atom.id)
              }}
              title="Nest a row inside this column"
              aria-label="Nest a row inside this column"
              className={`grid h-6 w-6 place-items-center rounded-full text-slate-400 transition opacity-0 group-hover:opacity-100 hover:bg-[#2563eb] hover:text-white ${
                nestRowMenuFor === atom.id ? 'opacity-100 bg-[#2563eb] text-white' : 'bg-slate-100'
              }`}
            >
              <Plus size={12} />
            </button>
            {nestRowMenuFor === atom.id ? (
              <div className="absolute top-full z-30 mt-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                {renderStructurePicker({
                  onPick: (mode, columns) => wrapChildInNestedLayout(atom.id, mode, columns),
                  onClose: () => setNestRowMenuFor(null),
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {parent?.type === 'layout' && String(parent.mode ?? 'grid') === 'grid' ? (
          <span
            draggable={false}
            onMouseDown={(e) => startSpanResize(e, atom, parent)}
            onClick={(e) => e.stopPropagation()}
            title="Drag to resize column width"
            className={`absolute -right-1.5 top-1/2 z-20 h-10 w-2.5 -translate-y-1/2 cursor-col-resize rounded-full bg-[#38bdf8] transition ${
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
        ) : null}
      </div>
    )
  }

  /** Shared "Select your structure" tile grid — used both by "+ Add Row"
   *  (a brand-new row at the section root) and a column's own "+" (wraps
   *  that one column's element into a nested row). `onPickFlex` is omitted
   *  to hide the "Flex row instead" fallback where it doesn't apply. */
  function renderStructurePicker(opts: {
    onPick: (mode: 'grid' | 'stack', columns?: number) => void
    onPickFlex?: () => void
    onClose: () => void
  }): ReactNode {
    return (
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            Select your structure
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              opts.onClose()
            }}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {STRUCTURE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              onClick={(e) => {
                e.stopPropagation()
                if (preset.mode === 'stack') opts.onPick('stack')
                else opts.onPick('grid', preset.columns)
              }}
              className="flex flex-col items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2.5 transition hover:border-[#2563eb] hover:bg-blue-50"
            >
              <StructurePreview preset={preset} />
            </button>
          ))}
        </div>
        {opts.onPickFlex ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              opts.onPickFlex?.()
            }}
            className="mt-2.5 w-full rounded-md border border-dashed border-slate-200 py-1.5 text-[11px] font-semibold text-slate-400 hover:border-[#2563eb] hover:text-[#2563eb]"
          >
            Flex row instead
          </button>
        ) : null}
      </div>
    )
  }

  /** The "+ Add Row" button — click reveals a Grid/Flex/Stack chooser, each
   *  option adding a 'layout' atom preset to that mode at the section root. */
  function renderAddRowControl(): ReactNode {
    if (!showRowMenu) {
      return (
        <button
          onClick={() => setShowRowMenu(true)}
          title="Add a row"
          aria-label="Add a row"
          className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-[#2563eb] hover:text-white"
        >
          <Plus size={18} />
        </button>
      )
    }
    return renderStructurePicker({
      onPick: (mode, columns) => addLayoutRow(mode, columns),
      onPickFlex: () => addLayoutRow('flex'),
      onClose: () => setShowRowMenu(false),
    })
  }

  function renderLayoutBody(atom: ComposerAtom): ReactNode {
    const children = atom.children ?? []
    const { className, style } = layoutContainerStyle(atom)
    return (
      <div>
        <div
          className={className}
          style={style}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleCanvasDrop(null, atom.id)
          }}
        >
          {children.length === 0 ? (
            <div
              className={`col-span-full rounded-md border-2 border-dashed p-6 text-center text-xs transition ${
                dragPayload
                  ? 'border-blue-400 bg-blue-50 text-blue-500'
                  : 'border-slate-200 text-slate-300'
              }`}
            >
              Drop elements here
            </div>
          ) : (
            children.map((child) => renderAtomNode(child, atom.id))
          )}
        </div>
        {children.length > 0 ? (
          <div className="flex justify-center py-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                selectAtom(atom)
              }}
              title="Add another element to this row, or edit its Grid/Flex/Stack settings"
              aria-label="Add to this row"
              className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-[#2563eb] hover:text-white"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#14161b] text-[13.5px] text-[#e5e7eb]">
      {/* Top bar */}
      <div className="flex h-[52px] flex-none items-center gap-3.5 border-b border-[#2d313a] bg-[#181b21] px-4">
        <span className="text-sm font-extrabold">◆ Section Builder</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-full border border-[#2d313a] bg-[#20232a] px-3 py-1 text-xs text-[#8b93a1] focus:text-[#e5e7eb]"
        />
        <span className="flex-1" />
        <button
          onClick={onClose}
          className="rounded-md border border-[#2d313a] bg-[#20232a] px-3.5 py-2 text-xs font-bold text-[#e5e7eb] hover:bg-[#282c34]"
        >
          Back
        </button>
        <button
          disabled={config.atoms.length === 0}
          onClick={() => {
            // Preview shows the CURRENT unsaved edits, not the last saved
            // version — a fresh tab (not this one) gets its own sessionStorage
            // cloned from this page's at open time, so writing here is enough
            // for the new tab to read it once on load. No backend round-trip:
            // nothing here is a real page yet, just a block being composed.
            sessionStorage.setItem('sb-preview', JSON.stringify(config))
            window.open('/admin/page-builder/section-builder/preview', '_blank')
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#2d313a] bg-[#20232a] px-3.5 py-2 text-xs font-bold text-[#e5e7eb] hover:bg-[#282c34] disabled:opacity-40"
        >
          <Eye size={13} /> Preview
        </button>
        <button
          disabled={saving || config.atoms.length === 0}
          onClick={() => handleSave('DRAFT')}
          className="rounded-md border border-[#2d313a] bg-[#20232a] px-3.5 py-2 text-xs font-bold text-[#e5e7eb] hover:bg-[#282c34] disabled:opacity-40"
        >
          Save draft
        </button>
        <button
          disabled={saving || config.atoms.length === 0}
          onClick={() => handleSave('PUBLISHED')}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#38bdf8] px-3.5 py-2 text-xs font-extrabold text-[#052a3a] hover:brightness-105 disabled:opacity-40"
        >
          Publish
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: grouped element palette */}
        <div className="w-[230px] flex-none overflow-y-auto border-r border-[#2d313a] bg-[#181b21] p-3.5">
          {paletteByGroup.map(({ group, atoms }) => (
            <div key={group} className="mb-3.5">
              <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-[#8b93a1]">
                {group}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {atoms.map((atom) => (
                  <button
                    key={atom.type}
                    draggable
                    onDragStart={(e) => {
                      setDragPayload({ kind: 'new', type: atom.type })
                      e.dataTransfer.effectAllowed = 'copy'
                      e.dataTransfer.setData('text/plain', atom.type)
                    }}
                    onDragEnd={() => setDragPayload(null)}
                    onClick={() => addAtom(atom.type, activeContainerId)}
                    className="flex cursor-grab flex-col items-center gap-2 rounded-[10px] border border-[#2d313a] bg-[#20232a] py-3.5 text-[#8b93a1] hover:border-[#38bdf8] hover:text-[#e5e7eb]"
                  >
                    <atom.icon size={19} />
                    <span className="text-[11px] font-bold leading-tight">{atom.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-[#8b93a1]">
            Tip
          </div>
          <p className="text-[11.5px] leading-relaxed text-[#8b93a1]">
            Drag an element onto the canvas, or click to add it to the bottom. Drag a canvas element
            to reorder or reposition it.
          </p>
        </div>

        {/* Center: canvas */}
        <div className="flex flex-1 flex-col items-center overflow-auto bg-[#0e0f13] p-8">
          <div className="w-full max-w-[900px] overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl">
            {config.atoms.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleCanvasDrop(null, null)
                }}
                className={`flex flex-col items-center gap-2.5 border-2 border-dashed py-14 text-center transition ${
                  dragPayload ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
                }`}
              >
                {renderAddRowControl()}
                {!showRowMenu ? (
                  <span className="text-xs text-slate-400">Drag widget here</span>
                ) : null}
              </div>
            ) : (
              <div
                role="presentation"
                onClick={() => {
                  setSelectedId(null)
                  setActiveContainerId(null)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleCanvasDrop(null, null)
                }}
              >
                <ComposerProjectContext.Provider value={projectId}>
                  {config.atoms.map((atom) => renderAtomNode(atom, null))}
                </ComposerProjectContext.Provider>
                <div
                  role="presentation"
                  className="border-t border-slate-100 p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderAddRowControl()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: settings for the selected element only */}
        <div className="w-[300px] flex-none overflow-y-auto border-l border-[#2d313a] bg-[#181b21] p-3.5">
          <div className="mb-3 text-[10.5px] font-extrabold uppercase tracking-wide text-[#8b93a1]">
            Settings
          </div>
          {selectedAtom && selectedDef ? (
            <>
              <div className="mb-3.5 flex items-center gap-2 border-b border-[#2d313a] pb-3">
                <selectedDef.icon size={14} className="text-[#8b93a1]" />
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                  {selectedDef.label}
                </span>
                <button
                  onClick={() => removeAtom(selectedAtom.id)}
                  className="rounded-md border border-[#2d313a] px-2.5 py-1 text-[11px] font-bold text-[#e5e7eb] hover:bg-[#20232a]"
                >
                  Delete
                </button>
              </div>
              <div className="mb-3.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setSettingsTab('content')}
                  className={`flex-1 rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                    settingsTab === 'content'
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-[#2d313a] text-[#8b93a1] hover:bg-[#20232a]'
                  }`}
                >
                  Content
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('style')}
                  className={`flex-1 rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                    settingsTab === 'style'
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-[#2d313a] text-[#8b93a1] hover:bg-[#20232a]'
                  }`}
                >
                  Style
                </button>
              </div>
              {settingsTab === 'style' ? (
                <AtomStyleField
                  atom={selectedAtom}
                  onChange={(patch) => patchAtom(selectedAtom.id, patch)}
                />
              ) : selectedParentIsGrid ? (
                <div className="mb-3.5 flex flex-col gap-3.5">
                  <ChipRow
                    label="Width (out of 12)"
                    value={String(
                      Math.round(
                        Number(selectedAtom.colSpan ?? 1) *
                          (12 / Math.max(1, Number(selectedParent!.columns ?? 2)))
                      )
                    )}
                    options={Array.from({ length: 12 }, (_, i) => ({
                      label: `${i + 1}`,
                      value: String(i + 1),
                    }))}
                    onChange={(v) => setChildSpan(selectedParent!.id, selectedAtom.id, Number(v))}
                  />
                  <ChipRow
                    label="Column start (offset)"
                    value={String(selectedAtom.colStart ?? 0)}
                    options={[
                      { label: 'Auto', value: '0' },
                      ...Array.from({ length: 12 }, (_, i) => ({
                        label: `${i + 1}`,
                        value: String(i + 1),
                      })),
                    ]}
                    onChange={(v) => {
                      setChildSpan(
                        selectedParent!.id,
                        selectedAtom.id,
                        Math.round(
                          Number(selectedAtom.colSpan ?? 1) *
                            (12 / Math.max(1, Number(selectedParent!.columns ?? 2)))
                        )
                      )
                      patchAtom(selectedAtom.id, { colStart: Number(v) })
                    }}
                  />
                </div>
              ) : null}
              {settingsTab === 'content' ? (
                <selectedDef.Field
                  atom={selectedAtom}
                  onChange={(patch) => patchAtom(selectedAtom.id, patch)}
                />
              ) : null}
            </>
          ) : (
            <p className="text-center text-[12.5px] leading-relaxed text-[#8b93a1]">
              Select an element on the canvas to edit its content, colours and spacing here.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
