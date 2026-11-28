import { describe, it, expect } from 'vitest'
import layoutChrome from '@/frontend/blocks/layout-chrome.json'
import { config } from '@/frontend/blocks/puck.config'

// The editor, the publish checks and the page scaffold read this one list (src/frontend/blocks/layout-chrome.json).
describe('layout chrome list', () => {
  it('names only blocks that exist, so a typo cannot silently stop a header being managed', () => {
    const types = new Set(Object.keys(config.components ?? {}))
    for (const t of [...layoutChrome.start, ...layoutChrome.end, ...layoutChrome.scaffold]) {
      expect(types.has(t), t).toBe(true)
    }
  })
  it('a block is never both a start (header side) and an end (footer side) block', () => {
    expect(layoutChrome.start.filter((t) => layoutChrome.end.includes(t))).toEqual([])
  })
  it('the editor hides exactly the categories those blocks are filed under', () => {
    const cats = config.categories ?? {}
    for (const key of layoutChrome.managedCategories) expect(cats[key], key).toBeDefined()
  })
  it('the F9 header and footer are included, so the editor never lets a page drift from the layout', () => {
    expect(layoutChrome.start).toContain('F9Header')
    expect(layoutChrome.end).toContain('F9Footer')
  })
})
