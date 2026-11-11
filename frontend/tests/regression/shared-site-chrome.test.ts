import { describe, it, expect } from 'vitest'
import type { Data } from '@puckeditor/core'
import { withSharedChrome } from '@/frontend/membership/siteChrome'

const d = (types: string[], root: Record<string, unknown> = {}) =>
  ({
    root: { props: root },
    content: types.map((type) => ({ type, props: {} })),
  }) as unknown as Data
const types = (x: Data) => (x.content as { type: string }[]).map((b) => b.type)
const HOME = d([
  'ConstructionTopBar',
  'ConstructionHeader',
  'ConstructionHero',
  'ConstructionFooter',
])

describe('withSharedChrome', () => {
  it("swaps a page's own header/footer for the home page's, keeping its body", () => {
    const page = d(['ConstructionHeader', 'ConstructionInnerBanner', 'Text'])
    expect(types(withSharedChrome(page, HOME))).toEqual([
      'ConstructionTopBar',
      'ConstructionHeader',
      'ConstructionInnerBanner',
      'Text',
      'ConstructionFooter',
    ])
  })
  it('leaves landing pages (no chrome), ownChrome pages and a home without header alone', () => {
    const landing = d(['Text'])
    expect(withSharedChrome(landing, HOME)).toBe(landing)
    const own = d(['ConstructionHeader', 'Text'], { ownChrome: true })
    expect(withSharedChrome(own, HOME)).toBe(own)
    const page = d(['ConstructionHeader', 'Text'])
    expect(withSharedChrome(page, d(['Text']))).toBe(page)
    expect(withSharedChrome(page, undefined)).toBe(page)
  })
})
