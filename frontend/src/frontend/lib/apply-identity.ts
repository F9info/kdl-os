// Live brand binding (T3.1). Header/footer blocks carry `brand` and `logoUrl` props that were
// baked into the page JSON when the site was built. At render time we overlay the Application
// Identity (name + logo) so changing it shows on the site without rebuilding the pages.
// An empty identity value never overrides: the baked value stays as the fallback.

// Keep in sync with BRAND_LOGO_BLOCK_TYPES in
// backend/src/modules/template-engine/drivers/website-seed-content.js (the blocks that carry them).
const BRAND_LOGO_BLOCK_TYPES = new Set([
  'NavBar',
  'Footer',
  'MedicalTopNav',
  'ConstructionHeader',
  'ConstructionFooter',
  'ConstructionTaglineStrip',
])

type Identity = Record<string, string | undefined>
interface Block {
  type: string
  props?: Record<string, unknown>
}
interface Atom {
  type?: string
  src?: string
  text?: string
  children?: Atom[]
}

// 'logo' atoms inside custom composed blocks track the brand the same way.
function patchAtoms(atoms: Atom[], name: string, logo: string): Atom[] {
  return atoms.map((a) => {
    const next: Atom =
      a.type === 'logo'
        ? { ...a, ...(logo && { src: logo }), ...(name && { text: name }) }
        : { ...a }
    if (Array.isArray(a.children)) next.children = patchAtoms(a.children, name, logo)
    return next
  })
}

export function applyIdentity<T>(data: T, identity: Identity | null | undefined): T {
  const name = identity?.app_name?.trim() ?? ''
  const logo = identity?.logo_light?.trim() ?? ''
  const content = (data as { content?: Block[] } | null)?.content
  if (!Array.isArray(content) || (!name && !logo)) return data
  const patched = content.map((b) => {
    if (BRAND_LOGO_BLOCK_TYPES.has(b.type)) {
      return {
        ...b,
        props: { ...b.props, ...(name && { brand: name }), ...(logo && { logoUrl: logo }) },
      }
    }
    const atoms = (b.props?.config as { atoms?: Atom[] } | undefined)?.atoms
    if (b.type === 'CustomComposedBlock' && Array.isArray(atoms)) {
      const config = { ...(b.props?.config as object), atoms: patchAtoms(atoms, name, logo) }
      return { ...b, props: { ...b.props, config } }
    }
    return b
  })
  return { ...data, content: patched }
}

/** Project identity with a site's overrides on top; an empty override keeps the project value. */
export function mergeIdentity(base: Identity, overrides?: Identity | null): Identity {
  if (!overrides) return base
  const merged: Identity = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (value?.trim()) merged[key] = value
  }
  // A page with its own logo but no dark one must not show the project's dark logo next to it.
  if (overrides.logo_light?.trim() && !overrides.logo_dark?.trim()) delete merged.logo_dark
  return merged
}
