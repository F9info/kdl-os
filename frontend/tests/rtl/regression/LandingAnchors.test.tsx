import { describe, it, expect, vi } from 'vitest'
import { render } from '../utils'
import { landing } from '@/frontend/blocks/packs/landing'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }))

// Header and footer links jump to a section by anchor (#pricing), so every landing section can carry one.
type Def = {
  defaultProps: Record<string, unknown>
  fields: Record<string, unknown>
  render: (p: Record<string, unknown>) => React.ReactElement
}
const def = (t: string) => landing.components[t] as unknown as Def
const html = (type: string, extra: Record<string, unknown>) =>
  render(def(type).render({ ...def(type).defaultProps, ...extra })).container.innerHTML

const SECTIONS = Object.keys(landing.components).filter(
  (k) => !['LandingHeader', 'LandingFooter'].includes(k)
)

describe('landing section anchors', () => {
  it.each(SECTIONS)('%s has an anchor field', (type) => {
    expect(Object.keys(def(type).fields)).toContain('anchor')
  })

  it('the header and footer, which are the navigation itself, do not', () => {
    expect(Object.keys(def('LandingHeader').fields)).not.toContain('anchor')
    expect(Object.keys(def('LandingFooter').fields)).not.toContain('anchor')
  })

  it('a section with an anchor is reachable by #anchor', () => {
    expect(html('LandingPricing', { anchor: 'pricing' })).toContain('id="pricing"')
  })

  it('a section without one gets no extra wrapper', () => {
    expect(html('LandingPricing', { anchor: '' })).not.toContain('id="')
    expect(html('LandingPricing', {})).not.toContain('id="')
  })

  it('Contact keeps its own anchor behaviour (no second id)', () => {
    const out = html('LandingContact', { anchor: 'contact' })
    expect((out.match(/id="contact"/g) ?? []).length).toBe(1)
  })
})
