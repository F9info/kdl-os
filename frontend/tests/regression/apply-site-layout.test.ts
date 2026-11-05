import { describe, it, expect } from 'vitest'
import { applySiteLayout } from '@/lib/apply-site-layout'

const page = () => ({
  root: {},
  content: [
    { type: 'ConstructionTopBar', props: { variant: '1', visible: true } },
    { type: 'ConstructionHeader', props: { variant: '1', visible: true, brand: 'Acme' } },
    { type: 'ConstructionHero', props: { variant: '1' } },
    { type: 'ConstructionFooter', props: { variant: '1', visible: true } },
    { type: 'NavBar', props: { variant: '1' } },
  ],
})
const on = (variant: string) => ({ enabled: true, variant })

describe('applySiteLayout', () => {
  it('re-styles the matching blocks with a built-in design, keeping other props', () => {
    const out = applySiteLayout(page(), { header: on('3'), footer: on('2') })
    expect(out.content[1]!.props).toMatchObject({ variant: '3', brand: 'Acme', visible: true })
    expect(out.content[3]!.props).toMatchObject({ variant: '2' })
    expect(out.content[0]!.props).toMatchObject({ variant: '1' }) // slot not in layout: untouched
  })

  it('drops a block from the render when its slot is switched off (footer included)', () => {
    const out = applySiteLayout(page(), {
      topHeader: { enabled: false, variant: '1' },
      footer: { enabled: false, variant: '1' },
    })
    expect(out.content.map((b) => b.type)).toEqual([
      'ConstructionHeader',
      'ConstructionHero',
      'NavBar',
    ])
  })

  it('keeps an editor-hidden block hidden, and ignores custom designs', () => {
    const p = page()
    p.content[1]!.props.visible = false
    const out = applySiteLayout(p, { header: on('4'), footer: on('custom:abc') })
    expect(out.content[1]!.props).toMatchObject({ visible: false, variant: '4' })
    expect(out.content[3]!.props).toMatchObject({ variant: '1' })
  })

  it('leaves non-layout blocks alone (hero, legacy NavBar)', () => {
    const out = applySiteLayout(page(), { header: on('5'), footer: on('5'), topHeader: on('5') })
    expect(out.content[2]!.props).toEqual({ variant: '1' }) // hero
    expect(out.content[4]!.props).toEqual({ variant: '1' }) // NavBar
  })

  it('returns the same object when there is nothing to do, and never mutates', () => {
    const p = page()
    expect(applySiteLayout(p, null)).toBe(p)
    expect(applySiteLayout(p, {})).toBe(p)
    expect(applySiteLayout(p, { header: on('1') })).toBe(p) // already variant 1
    const copy = JSON.stringify(p)
    applySiteLayout(p, { header: on('3') })
    expect(JSON.stringify(p)).toBe(copy)
    expect(applySiteLayout(null, { header: on('3') })).toBeNull()
  })
})
