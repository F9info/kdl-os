import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render } from '../utils'
import { landing } from '@/frontend/blocks/packs/landing'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }))

// Each Landing section with a Design picker has four designs. They must show the SAME content,
// look different from each other, and an old page without a `variant` must keep Design 1.
const SAMPLE: Record<string, Record<string, unknown>> = {
  LandingStats: { stats: '2,500+|Happy customers\n98%|Would recommend\n24h|Reply time' },
  LandingBenefits: {
    eyebrow: 'Why us',
    title: 'Benefit title',
    subtitle: 'Sub',
    columns: '3',
    tone: 'light',
    items:
      '🚀|Fast|Quick turnaround\n🛡|Safe|Secure by design\n💡|Smart|Clever ideas\n🎯|Focused|On target',
  },
  LandingShowcase: {
    eyebrow: 'About',
    title: 'About title',
    text: 'About text',
    bullets: 'Point A\nPoint B',
    image: '/x.jpg',
    reverse: false,
    ctaLabel: 'Go',
    ctaHref: '/go',
  },
  LandingTestimonials: {
    eyebrow: 'Quotes',
    title: 'Quote title',
    items: 'Great work|Asha|CEO|/a.jpg\nVery good|Ravi|CTO|/b.jpg\nLoved it|Mina|COO|',
  },
  LandingFaq: {
    eyebrow: 'FAQ',
    title: 'Faq title',
    items: 'Question one?|Answer one\nQuestion two?|Answer two',
  },
  LandingCta: {
    title: 'Cta title',
    text: 'Cta text',
    buttonLabel: 'Press',
    buttonHref: '/p',
    image: '',
  },
}
const VISIBLE: Record<string, string[]> = {
  LandingStats: ['2,500+', 'Happy customers', '24h'],
  LandingBenefits: ['Benefit title', 'Fast', 'Quick turnaround', 'Focused'],
  LandingShowcase: ['About title', 'About text', 'Point A', 'Point B', 'Go'],
  LandingTestimonials: ['Quote title', 'Great work', 'Asha', 'Loved it'],
  LandingFaq: ['Faq title', 'Question one?', 'Answer two'],
  LandingCta: ['Cta title', 'Cta text', 'Press'],
}

const html = (type: string, variant?: string) => {
  const def = landing.components[type] as unknown as {
    defaultProps: Record<string, unknown>
    render: (p: Record<string, unknown>) => React.ReactElement
  }
  const props = { ...def.defaultProps, ...SAMPLE[type], ...(variant ? { variant } : {}) }
  if (!variant) delete props.variant
  return render(def.render(props)).container.innerHTML
}

describe.each(Object.keys(SAMPLE))('%s designs', (type) => {
  it('offers Design 1 to 4 in the editor', () => {
    const field = (
      landing.components[type]!.fields as Record<string, { options: { value: string }[] }>
    ).variant
    expect(field!.options.map((o) => o.value)).toEqual(['1', '2', '3', '4'])
    expect(landing.variants?.[type]).toEqual(['1', '2', '3', '4'])
  })

  it('shows the same content in every design', () => {
    for (const v of ['1', '2', '3', '4']) {
      const out = html(type, v)
      for (const text of VISIBLE[type]!) expect(out, `design ${v} lost "${text}"`).toContain(text)
    }
  })

  it('looks different in each design, and a page without a design keeps Design 1', () => {
    const outs = ['1', '2', '3', '4'].map((v) => html(type, v))
    expect(new Set(outs).size).toBe(4)
    expect(html(type)).toBe(outs[0])
  })
})
