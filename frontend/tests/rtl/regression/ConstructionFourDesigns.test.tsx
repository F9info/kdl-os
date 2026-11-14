import { describe, it, expect, vi } from 'vitest'
import { render } from '../utils'
import { construction } from '@/frontend/blocks/packs/construction'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }))

// Icon Feature Grid, Approach Split and Process Steps each have four designs: the same content in all of them, a
// different look in each, and a block saved before designs 3 and 4 existed keeps its own design.
type Def = {
  defaultProps: Record<string, unknown>
  fields: Record<string, { options?: { value: string }[] }>
  render: (p: Record<string, unknown>) => React.ReactElement
}
const def = (t: string) => construction.components[t] as unknown as Def

const SAMPLE: Record<string, Record<string, unknown>> = {
  ConstructionIconFeatureGrid: {
    sectionEyebrow: 'Why us',
    sectionTitle: 'Grid title',
    items: [
      { icon: 'star', title: 'Feature one', description: 'Describes one' },
      { icon: 'shield', title: 'Feature two', description: 'Describes two' },
    ],
  },
  ConstructionApproachSplit: {
    eyebrow: 'Approach',
    heading: 'Approach heading',
    paragraph1: 'First paragraph',
    paragraph2: 'Second paragraph',
    photo: '/p.jpg',
    highlight1Title: 'Highlight A',
    highlight1Description: 'About A',
    highlight2Title: 'Highlight B',
    highlight2Description: 'About B',
    stat1Value: '25',
    stat1Label: 'Years',
    stat2Value: '300',
    stat2Label: 'Projects',
    stat3Value: '30',
    stat3Label: 'People',
    // the block prefers these rows over the single fields above when both exist
    highlights: [
      { icon: 'star', title: 'Highlight A', description: 'About A' },
      { icon: 'shield', title: 'Highlight B', description: 'About B' },
    ],
    stats: [
      { value: '25', label: 'Years' },
      { value: '300', label: 'Projects' },
    ],
  },
  ConstructionProcessSteps: {
    sectionEyebrow: 'How',
    sectionTitle: 'Steps title',
    sectionSubtitle: 'Steps subtitle',
    items: [
      { stepLabel: '01 — Plan', title: 'Plan it', description: 'We plan' },
      { stepLabel: '02 — Build', title: 'Build it', description: 'We build' },
    ],
  },
}
const VISIBLE: Record<string, string[]> = {
  ConstructionIconFeatureGrid: ['Grid title', 'Feature one', 'Describes two'],
  ConstructionApproachSplit: [
    'Approach heading',
    'First paragraph',
    'Second paragraph',
    'Highlight A',
    'About B',
    'Years',
    'Projects',
  ],
  ConstructionProcessSteps: ['Steps title', 'Steps subtitle', 'Plan it', 'We build', '02 — Build'],
}

const html = (type: string, variant?: string) => {
  const props: Record<string, unknown> = { ...def(type).defaultProps, ...SAMPLE[type] }
  if (variant) props.variant = variant
  else delete props.variant
  return render(def(type).render(props)).container.innerHTML
}

describe.each(Object.keys(SAMPLE))('%s', (type) => {
  it('offers designs 1 to 4 in the editor and the block picker', () => {
    expect(def(type).fields.variant?.options?.map((o) => o.value)).toEqual(['1', '2', '3', '4'])
    expect(construction.variants?.[type]).toEqual(['1', '2', '3', '4'])
  })

  it.each(['1', '2', '3', '4'])('design %s shows the same content', (v) => {
    const out = html(type, v)
    for (const text of VISIBLE[type] ?? []) expect(out).toContain(text)
  })

  it('looks different in every design', () => {
    expect(new Set(['1', '2', '3', '4'].map((v) => html(type, v))).size).toBe(4)
  })

  it('a block saved without a design keeps design 1', () => {
    expect(html(type)).toBe(html(type, '1'))
  })

  it('designs 3 and 4 use the theme colours, not fixed palette colours', () => {
    // (the app's theme provider injects its own <script>; only the block's markup is checked)
    const markup = (v: string) => html(type, v).replace(/<script[\s\S]*?<\/script>/g, '')
    for (const v of ['3', '4']) expect(markup(v)).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})
