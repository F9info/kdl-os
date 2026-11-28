// Pages reference the project's saved header/footer layout (T4.2). Each page still carries its own
// top bar / header / footer block; at public render time we overlay the saved layout onto those
// blocks, so changing the layout takes effect on every page without rebuilding them.
//
// A slot switched off drops the block from what is rendered; a built-in design ('1'-'5') re-styles it.
// Adding a missing block, swapping a legacy NavBar/Footer, and `custom:<id>` designs still need the
// Layout page's "Create layout" (they add blocks to the page), so they are left alone here.

export interface SlotValue {
  enabled: boolean
  variant: string
  config?: Record<string, string>
}
export interface SiteLayoutValue {
  topHeader?: SlotValue
  header?: SlotValue
  footer?: SlotValue
}

const SLOT_BLOCK = {
  topHeader: 'ConstructionTopBar',
  header: 'ConstructionHeader',
  footer: 'ConstructionFooter',
} as const
// The F9 Tech design ('f9') swaps the slot's Construction block for the F9 one, with the layout's own settings.
const F9_BLOCK = { header: 'F9Header', footer: 'F9Footer' } as const
// A Landing design ('landing:1'-'landing:4') swaps the slot's block for the Landing header / footer with that
// design number and the layout's own settings (menu links, button, palette, font). Logo, name, phone and the
// footer's contact details still come from Identity.
const LANDING_BLOCK = { header: 'LandingHeader', footer: 'LandingFooter' } as const
const LANDING_DEFAULTS = {
  header: {
    palette: 'brand',
    font: 'bricolage',
    links: '',
    ctaLabel: 'Get a free quote',
    ctaHref: '#contact',
  },
  footer: { palette: 'brand', font: 'bricolage', links: 'Back to top|#', note: '' },
} as const
const LANDING_VARIANT = /^landing:([1-4])$/

interface Block {
  type: string
  props?: Record<string, unknown>
}

export function applySiteLayout<T>(data: T, layout: SiteLayoutValue | null | undefined): T {
  const content = (data as { content?: Block[] } | null)?.content
  if (!layout || !Array.isArray(content)) return data
  const slots = Object.entries(SLOT_BLOCK) as [keyof SiteLayoutValue, string][]
  let changed = false
  const patched: Block[] = []
  for (const b of content) {
    const slot =
      slots.find(([, type]) => type === b.type)?.[0] ??
      (Object.entries(F9_BLOCK).find(([, type]) => type === b.type)?.[0] as
        keyof SiteLayoutValue | undefined) ??
      (Object.entries(LANDING_BLOCK).find(
        ([k, type]) =>
          type === b.type && LANDING_VARIANT.test(layout[k as keyof SiteLayoutValue]?.variant ?? '')
      )?.[0] as keyof SiteLayoutValue | undefined)
    const value = slot && layout[slot]
    const f9Type = slot && slot in F9_BLOCK ? F9_BLOCK[slot as keyof typeof F9_BLOCK] : undefined
    const landingType =
      slot && slot in LANDING_BLOCK ? LANDING_BLOCK[slot as keyof typeof LANDING_BLOCK] : undefined
    const landingNo = value ? LANDING_VARIANT.exec(value.variant)?.[1] : undefined
    if (!value) {
      patched.push(b)
    } else if (!value.enabled) {
      // Dropped from what is rendered only; the stored page keeps the block, so switching the slot
      // back on shows it again. (Not a `visible` flag: the footer block has no such prop.)
      changed = true
    } else if (value.variant === 'f9' && f9Type) {
      changed = true
      patched.push({
        type: f9Type,
        props: { ...(b.type === f9Type ? b.props : { id: b.props?.id }), ...(value.config ?? {}) },
      })
    } else if (landingNo && landingType) {
      changed = true
      const base = b.type === landingType ? b.props : { id: b.props?.id }
      patched.push({
        type: landingType,
        props: {
          ...LANDING_DEFAULTS[slot as 'header' | 'footer'],
          ...base,
          ...(value.config ?? {}),
          variant: landingNo,
        },
      })
    } else if (b.type === f9Type || b.type === landingType) {
      patched.push(b)
    } else if (/^[1-5]$/.test(value.variant) && b.props?.variant !== value.variant) {
      changed = true
      patched.push({ ...b, props: { ...b.props, variant: value.variant } })
    } else {
      patched.push(b)
    }
  }
  return changed ? { ...data, content: patched } : data
}
