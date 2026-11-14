// Live brand binding (T3.1). Header/footer blocks carry `brand` and `logoUrl` props that were
// baked into the page JSON when the site was built. At render time we overlay the Application
// Identity (name + logo) so changing it shows on the site without rebuilding the pages.
// An empty identity value never overrides: the baked value stays as the fallback.

// Keep in sync with BRAND_LOGO_BLOCK_TYPES in
// backend/src/modules/template-engine/drivers/website-seed-content.js (the blocks that carry them).
export const BRAND_LOGO_BLOCK_TYPES = new Set([
  'NavBar',
  'Footer',
  'TaglineStrip',
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

// Company contact details and socials: one map says which block prop shows which Identity field, so
// editing Identity changes the site everywhere (no per-block hand edits). Identity values win when set;
// an empty one keeps whatever the page has, except that a "#" placeholder link is dropped so no dead icon shows.
// Social slot order differs by design (read from the blocks): TopBar/Header-d1/Footer-5 are
// Facebook, Instagram, LinkedIn, YouTube; Header and Footer 1-4 are Facebook, LinkedIn, Instagram, X.
const SOCIALS_FB_IG_LI_YT = [
  'social_facebook',
  'social_instagram',
  'social_linkedin',
  'social_youtube',
]
const SOCIALS_FB_LI_IG_X = ['social_facebook', 'social_linkedin', 'social_instagram', 'social_x']

const socialProps = (prefix: string, order: string[]): Record<string, string> =>
  Object.fromEntries(order.map((key, i) => [`${prefix}${i + 1}Href`, key]))

/** block prop -> Identity key, for the blocks that show company contact details. */
function contactMap(b: Block): Record<string, string> | null {
  if (b.type === 'ConstructionTopBar')
    return {
      d1Email: 'contact_email',
      d1Phone: 'contact_phone',
      d4Email: 'contact_email',
      d4Phone: 'contact_phone',
      ...socialProps('d1Social', SOCIALS_FB_IG_LI_YT),
      ...socialProps('d4Social', SOCIALS_FB_IG_LI_YT),
    }
  if (b.type === 'ConstructionHeader')
    return {
      phoneNumber: 'contact_phone',
      email: 'contact_email',
      ...socialProps('social', SOCIALS_FB_LI_IG_X),
    }
  if (b.type === 'ConstructionFooter')
    return {
      contactPhone: 'contact_phone',
      contactPhone2: 'contact_phone_secondary',
      contactEmail: 'contact_email',
      contactEmail2: 'contact_email_secondary',
      contactAddress: 'contact_address',
      copyright: 'copyright',
      ...socialProps('social', b.props?.variant === '5' ? SOCIALS_FB_IG_LI_YT : SOCIALS_FB_LI_IG_X),
    }
  return null
}

function applyContact(b: Block, identity: Identity | null | undefined): Block {
  const map = contactMap(b)
  if (!map || !identity) return b
  const props: Record<string, unknown> = { ...b.props }
  for (const [prop, key] of Object.entries(map)) {
    const value = identity[key]?.trim()
    if (value) props[prop] = value
    else if (props[prop] === '#' && /Href$/.test(prop)) props[prop] = ''
  }
  // No copyright saved in Identity: a placeholder one ("Your Brand", "DemoLogo") becomes the company + this year.
  const company = (identity.company_name?.trim() || identity.app_name?.trim()) ?? ''
  if (
    map.copyright &&
    !identity.copyright?.trim() &&
    company &&
    /your brand|demologo/i.test(String(props.copyright ?? ''))
  )
    props.copyright = `© ${new Date().getFullYear()} ${company}. All rights reserved.`
  if (b.type === 'ConstructionFooter') applyFooterLinks(props, identity)
  return { ...b, props }
}

const isPlaceholderHref = (h: unknown) => !String(h ?? '').trim() || String(h).trim() === '#'

/**
 * Footer links that would go nowhere are not shown. "Get Directions" opens a map search for the company address
 * from Identity (no address, no link); the legal row (Terms, Privacy ...) keeps only links that have a real
 * address, so a "#" never ships. A link the page's author set to a real address is left alone.
 */
function applyFooterLinks(props: Record<string, unknown>, identity: Identity) {
  if (isPlaceholderHref(props.directionsHref)) {
    const address = identity.contact_address?.trim().replace(/\s*\n\s*/g, ', ')
    if (address) {
      props.directionsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    } else {
      props.directionsLabel = ''
    }
  }
  if (typeof props.policyLinks === 'string') {
    props.policyLinks = props.policyLinks
      .split('\n')
      .filter((line) => !isPlaceholderHref(line.split('|')[1]))
      .join('\n')
  }
}

/**
 * The company name and logo to show, from Application Identity. The website shows the company, not the admin
 * application: company values first, app values as fallback. Empty means "not set", never an override.
 */
export function brandOf(identity: Identity | null | undefined): { name: string; logo: string } {
  return {
    name: (identity?.company_name?.trim() || identity?.app_name?.trim()) ?? '',
    logo: (identity?.company_logo_light?.trim() || identity?.logo_light?.trim()) ?? '',
  }
}

/** The `brand` / `logoUrl` props a brand-logo block gets from Identity; only the ones that are set. */
export function brandProps(identity: Identity | null | undefined): {
  brand?: string
  logoUrl?: string
} {
  const { name, logo } = brandOf(identity)
  return { ...(name && { brand: name }), ...(logo && { logoUrl: logo }) }
}

/** The word the built-in sample copy uses for the company ("DemoLogo was founded in 1996 ..."). */
export const SAMPLE_BRAND_TOKEN = 'DemoLogo'

/** Replaces the sample company word with the real name, anywhere inside a block's props. */
function withCompanyName(value: unknown, name: string): unknown {
  if (typeof value === 'string')
    return value.includes(SAMPLE_BRAND_TOKEN) ? value.replaceAll(SAMPLE_BRAND_TOKEN, name) : value
  if (Array.isArray(value)) return value.map((v) => withCompanyName(v, name))
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withCompanyName(v, name)]))
  return value
}

export function applyIdentity<T>(data: T, identity: Identity | null | undefined): T {
  const { name, logo } = brandOf(identity)
  const content = (data as { content?: Block[] } | null)?.content
  if (!Array.isArray(content) || !identity || Object.keys(identity).length === 0) return data
  const patched = content.map((b0) => {
    const b = applyContact(
      name ? { ...b0, props: withCompanyName(b0.props, name) as Block['props'] } : b0,
      identity
    )
    if (BRAND_LOGO_BLOCK_TYPES.has(b.type)) {
      return {
        ...b,
        props: { ...b.props, ...brandProps(identity) },
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
