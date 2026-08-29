'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Eye, Tablet, Smartphone, Monitor } from 'lucide-react'
import { ATOM_CATALOGUE, type ComposerAtom } from './atoms'
import { atomCatalogueFor } from './catalogue-by-category'
import {
  DEFAULT_SETTINGS,
  renderComposedBlock,
  type ComposedBlockConfig,
} from './render-composed-block'
import { createCustomBlock, updateCustomBlock, type CustomBlockRecord } from './custom-blocks-store'

type Viewport = 'desktop' | 'tablet' | 'mobile'
const VIEWPORT_WIDTH: Record<Viewport, number> = { desktop: 1180, tablet: 768, mobile: 390 }

function newAtomId(type: string) {
  return `${type}-${crypto.randomUUID()}`
}

export function BlockComposer({
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
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [rightTab, setRightTab] = useState<'content' | 'layout' | 'style' | 'responsive'>('content')
  const [saving, setSaving] = useState(false)

  const palette = atomCatalogueFor(categoryKey)

  function addAtom(type: string) {
    const def = ATOM_CATALOGUE.find((a) => a.type === type)
    if (!def) return
    const atom: ComposerAtom = { id: newAtomId(type), type, ...def.defaultProps }
    setConfig((c) => ({ ...c, atoms: [...c.atoms, atom] }))
    setSelectedId(atom.id)
    setRightTab('content')
  }

  function patchAtom(id: string, patch: Record<string, unknown>) {
    setConfig((c) => ({
      ...c,
      atoms: c.atoms.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }))
  }

  function removeAtom(id: string) {
    setConfig((c) => ({ ...c, atoms: c.atoms.filter((a) => a.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  function moveAtom(id: string, dir: -1 | 1) {
    setConfig((c) => {
      const idx = c.atoms.findIndex((a) => a.id === id)
      const next = idx + dir
      if (idx < 0 || next < 0 || next >= c.atoms.length) return c
      const atoms = [...c.atoms]
      // Bounds already checked above — indices are guaranteed valid here,
      // `noUncheckedIndexedAccess` just can't see that through the guard.
      ;[atoms[idx], atoms[next]] = [atoms[next]!, atoms[idx]!]
      return { ...c, atoms }
    })
  }

  function reorderAtoms(fromId: string, toId: string) {
    setConfig((c) => {
      const from = c.atoms.findIndex((a) => a.id === fromId)
      const to = c.atoms.findIndex((a) => a.id === toId)
      if (from < 0 || to < 0 || from === to) return c
      const atoms = [...c.atoms]
      const [moved] = atoms.splice(from, 1)
      atoms.splice(to, 0, moved!)
      return { ...c, atoms }
    })
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

  const selectedAtom = config.atoms.find((a) => a.id === selectedId) ?? null

  // Portaled to <body>: Puck's own `_PuckLayout-inner` sets
  // `position:relative; z-index:0`, which creates a stacking context that
  // traps any `fixed` descendant below the admin shell's own sticky header
  // regardless of z-index value — a full-bleed top bar (this component's)
  // is the first UI in this app to actually collide with it pixel-wise.
  return createPortal(
    <div className="fixed inset-0 z-[2100] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <button
          onClick={onClose}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold"
        />
        <span className="flex-1" />
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => {
            const Icon = v === 'desktop' ? Monitor : v === 'tablet' ? Tablet : Smartphone
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={`rounded p-1.5 ${viewport === v ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                aria-label={v}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
        <button
          disabled={saving}
          onClick={() => handleSave('DRAFT')}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          disabled={saving}
          onClick={() => handleSave('PUBLISHED')}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Eye size={14} /> Publish
        </button>
      </div>

      <div className="grid flex-1 grid-cols-[240px_1fr_320px] overflow-hidden">
        <div className="flex flex-col overflow-y-auto border-r border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Add elements
          </div>
          <div className="grid grid-cols-2 gap-2">
            {palette.map((atom) => (
              <button
                key={atom.type}
                onClick={() => addAtom(atom.type)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 py-3 text-slate-600 hover:border-blue-400 hover:text-blue-600"
              >
                <atom.icon size={18} />
                <span className="text-[11px] font-semibold">{atom.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
            Layers
          </div>
          <div className="flex flex-col gap-1.5">
            {config.atoms.length === 0 ? (
              <p className="text-xs text-slate-400">No elements yet — add one above.</p>
            ) : (
              config.atoms.map((atom) => (
                <div
                  key={atom.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', atom.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    reorderAtoms(e.dataTransfer.getData('text/plain'), atom.id)
                  }}
                  onClick={() => {
                    setSelectedId(atom.id)
                    setRightTab('content')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedId(atom.id)
                      setRightTab('content')
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    selectedId === atom.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <span className="flex-1 truncate font-medium">
                    {ATOM_CATALOGUE.find((a) => a.type === atom.type)?.label ?? atom.type}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveAtom(atom.id, -1)
                    }}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveAtom(atom.id, 1)
                    }}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAtom(atom.id)
                    }}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-auto bg-slate-100 p-6">
          <div
            className="mx-auto w-full overflow-hidden rounded-lg bg-white shadow-md transition-[max-width]"
            style={{ maxWidth: VIEWPORT_WIDTH[viewport] }}
          >
            <div role="presentation" onClick={() => setSelectedId(null)}>
              {renderComposedBlock(config, {
                interactive: true,
                selectedId,
                onSelectAtom: (id) => {
                  setSelectedId(id)
                  setRightTab('content')
                },
              })}
              {config.atoms.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-400">
                  Add elements from the left panel to build this block.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex border-b border-slate-200">
            {(['content', 'layout', 'style', 'responsive'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-bold capitalize ${
                  rightTab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="p-4">
            {rightTab === 'content' ? (
              selectedAtom ? (
                (() => {
                  const def = ATOM_CATALOGUE.find((a) => a.type === selectedAtom.type)
                  if (!def) return null
                  return (
                    <def.Field
                      atom={selectedAtom}
                      onChange={(patch) => patchAtom(selectedAtom.id, patch)}
                    />
                  )
                })()
              ) : (
                <p className="text-center text-xs text-slate-400">
                  Pick an element from Layers, or add one from the palette.
                </p>
              )
            ) : null}

            {rightTab === 'layout' ? (
              <div className="flex flex-col gap-3.5">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Container
                  </span>
                  <div className="flex gap-1.5">
                    {(['full', 'boxed'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          setConfig((c) => ({ ...c, settings: { ...c.settings, container: v } }))
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                          config.settings.container === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Padding</span>
                  <div className="flex gap-1.5">
                    {(['sm', 'md', 'lg'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          setConfig((c) => ({ ...c, settings: { ...c.settings, padding: v } }))
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold uppercase ${
                          config.settings.padding === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Align</span>
                  <div className="flex gap-1.5">
                    {(['left', 'center', 'right'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          setConfig((c) => ({ ...c, settings: { ...c.settings, align: v } }))
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                          config.settings.align === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {rightTab === 'style' ? (
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Background
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.settings.bg || '#ffffff'}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, settings: { ...c.settings, bg: e.target.value } }))
                    }
                    className="h-9 w-14 cursor-pointer rounded-md border border-slate-200"
                  />
                  <button
                    onClick={() =>
                      setConfig((c) => ({ ...c, settings: { ...c.settings, bg: '' } }))
                    }
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            {rightTab === 'responsive' ? (
              selectedAtom ? (
                <label className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Hide on mobile</span>
                  <input
                    type="checkbox"
                    checked={!!selectedAtom.hideMobile}
                    onChange={(e) => patchAtom(selectedAtom.id, { hideMobile: e.target.checked })}
                  />
                </label>
              ) : (
                <p className="text-center text-xs text-slate-400">
                  Pick an element from Layers to set its mobile visibility.
                </p>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
