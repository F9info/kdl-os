// One header look site-wide, decided by content instead of per-page props: a Design 1 header
// floats (transparent, light text) over a photo hero, and is solid + dark text otherwise.
// Pages scaffolded at different times carry different stored `transparent`/`lightText`,
// so derive them from the block below the header when rendering.

const HERO_TYPES = new Set(['ConstructionInnerBanner', 'ConstructionHero'])
// Non-visual / floating blocks that can sit between the header and the hero.
const SKIP_TYPES = new Set(['ConstructionFloatingActions'])

interface Block {
  type: string
  props?: Record<string, unknown>
}

export function applyHeaderOverlay<T>(data: T): T {
  const content = (data as { content?: Block[] } | null)?.content
  if (!Array.isArray(content)) return data
  const i = content.findIndex((b) => b.type === 'ConstructionHeader')
  if (i < 0) return data
  const next = content
    .slice(i + 1)
    .find((b) => !SKIP_TYPES.has(b.type) && b.props?.visible !== false)
  const overlay = Boolean(next && HERO_TYPES.has(next.type))
  const header = content[i]!
  const patched = content.map((b, n) =>
    n === i
      ? { ...header, props: { ...header.props, transparent: overlay, lightText: overlay } }
      : b
  )
  return { ...data, content: patched }
}
