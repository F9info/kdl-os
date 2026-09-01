'use client'

import { useState } from 'react'
import { Trash2, GripVertical, ChevronUp, Eye } from 'lucide-react'
import { ATOM_CATALOGUE, ATOM_GROUPS, ATOM_BY_TYPE, type ComposerAtom } from './atoms'
import { atomCatalogueFor } from './catalogue-by-category'
import { DEFAULT_SETTINGS, type ComposedBlockConfig } from './render-composed-block'
import { createCustomBlock, updateCustomBlock, type CustomBlockRecord } from './custom-blocks-store'

function newAtomId(type: string) {
  return `${type}-${crypto.randomUUID()}`
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
  const [dragFromId, setDragFromId] = useState<string | null>(null)

  const palette = atomCatalogueFor(categoryKey)
  const paletteByGroup = ATOM_GROUPS.map((group) => ({
    group,
    atoms: palette.filter((a) => a.group === group),
  })).filter((g) => g.atoms.length > 0)

  function addAtom(type: string) {
    const def = ATOM_CATALOGUE.find((a) => a.type === type)
    if (!def) return
    const atom: ComposerAtom = { id: newAtomId(type), type, ...def.defaultProps }
    setConfig((c) => ({ ...c, atoms: [...c.atoms, atom] }))
    setSelectedId(atom.id)
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

  function moveAtomUp(id: string) {
    setConfig((c) => {
      const idx = c.atoms.findIndex((a) => a.id === id)
      if (idx <= 0) return c
      const atoms = [...c.atoms]
      ;[atoms[idx - 1], atoms[idx]] = [atoms[idx]!, atoms[idx - 1]!]
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
  const selectedDef = selectedAtom ? ATOM_BY_TYPE[selectedAtom.type] : null

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
          <Eye size={13} /> Publish
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
                    onClick={() => addAtom(atom.type)}
                    className="flex flex-col items-center gap-2 rounded-[10px] border border-[#2d313a] bg-[#20232a] py-3.5 text-[#8b93a1] hover:border-[#38bdf8] hover:text-[#e5e7eb]"
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
            Click an element to add it to the bottom. Use the drag handle on a canvas element to
            reorder it.
          </p>
        </div>

        {/* Center: canvas */}
        <div className="flex flex-1 flex-col items-center overflow-auto bg-[#0e0f13] p-8">
          <div className="w-full max-w-[900px] overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl">
            {config.atoms.length === 0 ? (
              <div className="px-8 py-24 text-center text-slate-400">
                <div className="mb-2.5 text-4xl">▦</div>
                Start building your section
                <br />
                <span className="text-xs">Add elements from the left panel.</span>
              </div>
            ) : (
              <div role="presentation" onClick={() => setSelectedId(null)}>
                {config.atoms.map((atom) => {
                  const def = ATOM_BY_TYPE[atom.type]
                  if (!def) return null
                  const selected = selectedId === atom.id
                  const idx = config.atoms.findIndex((a) => a.id === atom.id)
                  return (
                    <div
                      key={atom.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        setDragFromId(atom.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragFromId) reorderAtoms(dragFromId, atom.id)
                        setDragFromId(null)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedId(atom.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          setSelectedId(atom.id)
                        }
                      }}
                      className={`group relative border-2 p-4 transition ${
                        selected
                          ? 'border-[#38bdf8]'
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
                      {def.Render(atom)}
                    </div>
                  )
                })}
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
              <selectedDef.Field
                atom={selectedAtom}
                onChange={(patch) => patchAtom(selectedAtom.id, patch)}
              />
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
