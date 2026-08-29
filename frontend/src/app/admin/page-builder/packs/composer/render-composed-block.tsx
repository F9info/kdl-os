'use client'

import { ATOM_BY_TYPE, type ComposerAtom } from './atoms'

export interface ComposedBlockSettings {
  container: 'full' | 'boxed'
  padding: 'sm' | 'md' | 'lg'
  align: 'left' | 'center' | 'right'
  bg: string
}

export interface ComposedBlockConfig {
  category: string
  atoms: ComposerAtom[]
  settings: ComposedBlockSettings
}

export const DEFAULT_SETTINGS: ComposedBlockSettings = {
  container: 'full',
  padding: 'md',
  align: 'left',
  bg: '',
}

const PAD_CLASS = { sm: 'py-6', md: 'py-12', lg: 'py-20' } as const
const ALIGN_CLASS = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const

/**
 * Turns a ComposedBlockConfig into JSX. `opts.interactive` wraps every atom
 * in a clickable, selectable node — only the composer's own canvas sets this;
 * normal Puck editor rendering and the public site always render plain.
 */
export function renderComposedBlock(
  config: ComposedBlockConfig,
  opts?: { interactive?: boolean; selectedId?: string | null; onSelectAtom?: (id: string) => void }
) {
  const { atoms, settings } = config
  const interactive = !!opts?.interactive
  const wrapCls = settings.container === 'boxed' ? 'mx-auto max-w-5xl px-6' : 'w-full px-6'

  return (
    <section
      className={`flex flex-col gap-4 ${PAD_CLASS[settings.padding] ?? PAD_CLASS.md} ${ALIGN_CLASS[settings.align] ?? ALIGN_CLASS.left}`}
      style={settings.bg ? { backgroundColor: settings.bg } : undefined}
    >
      <div
        className={`flex flex-col gap-4 ${wrapCls} ${ALIGN_CLASS[settings.align] ?? ALIGN_CLASS.left}`}
      >
        {atoms.map((atom) => {
          const def = ATOM_BY_TYPE[atom.type]
          if (!def) return null
          const node = def.Render(atom)
          if (!interactive) return <div key={atom.id}>{node}</div>
          const selected = opts?.selectedId === atom.id
          return (
            <div
              key={atom.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                opts?.onSelectAtom?.(atom.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') opts?.onSelectAtom?.(atom.id)
              }}
              className={`cursor-pointer rounded-md outline outline-2 transition ${
                selected ? 'outline-blue-600' : 'outline-transparent hover:outline-blue-300'
              }`}
            >
              {node}
            </div>
          )
        })}
      </div>
    </section>
  )
}
