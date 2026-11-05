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
    const slot = slots.find(([, type]) => type === b.type)?.[0]
    const value = slot && layout[slot]
    if (!value) {
      patched.push(b)
    } else if (!value.enabled) {
      // Dropped from what is rendered only; the stored page keeps the block, so switching the slot
      // back on shows it again. (Not a `visible` flag: the footer block has no such prop.)
      changed = true
    } else if (/^[1-5]$/.test(value.variant) && b.props?.variant !== value.variant) {
      changed = true
      patched.push({ ...b, props: { ...b.props, variant: value.variant } })
    } else {
      patched.push(b)
    }
  }
  return changed ? { ...data, content: patched } : data
}
