import { describe, it, expect, vi } from 'vitest'
import { render } from '../utils'
import { landing } from '@/frontend/blocks/packs/landing'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }))

// The landing Header and Form each have four designs: the same content in all of them, a different look in
// each, and a page saved before designs existed (no `variant`) keeps Design 1.
type Def = {
  defaultProps: Record<string, unknown>
  fields: Record<string, { options?: { value: string }[] }>
  render: (p: Record<string, unknown>) => React.ReactElement
}
const def = (t: string) => landing.components[t] as unknown as Def

const identity = {
  company_name: 'Acme Robotics',
  company_logo_light: '/acme.png',
  contact_phone: '+91 98765 43210',
}
const SAMPLE: Record<string, Record<string, unknown>> = {
  LandingHeader: {
    links: 'About|#about\nPricing|#pricing',
    ctaLabel: 'Get a quote',
    ctaHref: '#contact',
  },
  LandingForm: {
    eyebrow: 'Talk',
    title: 'Form title',
    subtitle: 'Form subtitle',
    formSlug: 'contact',
    anchor: 'contact',
  },
}
const VISIBLE: Record<string, string[]> = {
  LandingHeader: ['Acme Robotics', '+91 98765 43210', 'About', 'Pricing', 'Get a quote'],
  LandingForm: ['Talk', 'Form title', 'Form subtitle'],
}

const html = (type: string, variant?: string) => {
  const props: Record<string, unknown> = {
    ...def(type).defaultProps,
    ...SAMPLE[type],
    puck: { metadata: { identity, preview: true } },
  }
  if (variant) props.variant = variant
  else delete props.variant
  return render(def(type).render(props)).container.innerHTML
}

describe.each(Object.keys(SAMPLE))('%s designs', (type) => {
  it('offers Design 1 to 4 in the editor and in the block picker', () => {
    expect(def(type).fields.variant?.options?.map((o) => o.value)).toEqual(['1', '2', '3', '4'])
    expect(landing.variants?.[type]).toEqual(['1', '2', '3', '4'])
  })

  it.each(['1', '2', '3', '4'])('Design %s shows the same content', (v) => {
    const out = html(type, v)
    for (const text of VISIBLE[type] ?? []) expect(out).toContain(text)
  })

  it('looks different in every design', () => {
    const all = ['1', '2', '3', '4'].map((v) => html(type, v))
    expect(new Set(all).size).toBe(4)
  })

  it('a block saved without a design keeps Design 1', () => {
    expect(html(type)).toBe(html(type, '1'))
  })
})

describe('LandingHeader', () => {
  it('takes the name, logo and phone from Identity, never from the block', () => {
    expect(Object.keys(def('LandingHeader').fields)).not.toContain('name')
    expect(html('LandingHeader', '3')).toContain('/acme.png')
  })
})

describe('LandingForm', () => {
  it('does not repeat the anchor id when a design wraps the form', () => {
    const out = html('LandingForm', '2')
    expect((out.match(/id="contact"/g) ?? []).length).toBeLessThanOrEqual(1)
  })
})
