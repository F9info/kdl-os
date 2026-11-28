import { describe, it, expect } from 'vitest'
import { render } from '../utils'
import { general } from '@/frontend/blocks/packs/general'
import { construction } from '@/frontend/blocks/packs/construction'
import { medical } from '@/frontend/blocks/packs/medical'

// The Counters section of the General and Construction packs and the Medical contact cards each offer four
// designs: the same content in every design, a different look in each, and a block saved before designs
// existed (no `variant`) keeps Design 1.
type Def = {
  defaultProps: Record<string, unknown>
  fields: Record<string, { type?: string; options?: { value: string }[] }>
  render: (p: Record<string, unknown>) => React.ReactElement
}
const CASES: { name: string; def: Def; visible: string[] }[] = [
  {
    name: 'General StatsStrip',
    def: general.components.StatsStrip as unknown as Def,
    visible: ['25+', 'Years of experience', '15K+', 'Happy customers'],
  },
  {
    name: 'Construction ConstructionStatsStrip',
    def: construction.components.ConstructionStatsStrip as unknown as Def,
    visible: ['25+', 'Years in Business', '850+', 'Projects Completed'],
  },
  {
    name: 'Medical MedicalContactInfoCards',
    def: medical.components.MedicalContactInfoCards as unknown as Def,
    visible: ['Emergency Case', '(123) 456 7890', 'Opening Hours', 'Email Us'],
  },
]
const html = (def: Def, variant?: string) => {
  const props: Record<string, unknown> = { ...def.defaultProps }
  if (variant) props.variant = variant
  else delete props.variant
  return render(def.render({ ...props, puck: { metadata: {} } })).container.innerHTML
}

describe.each(CASES)('$name designs', ({ def, visible }) => {
  it('has a Design 1-4 picker and defaults to Design 1', () => {
    expect(def.fields.variant).toBeTruthy()
    expect(def.defaultProps.variant).toBe('1')
  })
  it('shows the same content in all four designs', () => {
    for (const v of ['1', '2', '3', '4']) {
      const out = html(def, v)
      for (const text of visible) expect(out, `design ${v} shows "${text}"`).toContain(text)
    }
  })
  it('renders four different looks', () => {
    expect(new Set(['1', '2', '3', '4'].map((v) => html(def, v))).size).toBe(4)
  })
  it('a block saved with no variant keeps Design 1', () => {
    expect(html(def)).toBe(html(def, '1'))
  })
})
