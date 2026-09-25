import { describe, it, expect } from 'vitest'
import {
  withCurrentSelection,
  type BlockCardEntry,
} from '@/app/admin/page-builder/insert-block-modal'

function entry(key: string, variant: string | null, index: number, total: number): BlockCardEntry {
  return { key, variant, index, total }
}

describe('withCurrentSelection', () => {
  it('flags the card matching an existing block of the same type+variant as isCurrent', () => {
    const cards = [entry('ConstructionHero', '1', 0, 2), entry('ConstructionHero', '2', 1, 2)]
    const content = [{ type: 'ConstructionHero', props: { id: 'x', variant: '2' } }]
    const result = withCurrentSelection(cards, content)
    expect(result.find((c) => c.variant === '2')?.isCurrent).toBe(true)
    expect(result.find((c) => c.variant === '1')?.isCurrent).toBe(false)
  })

  it('pins the matching card to the front of its own variant group, leaving other groups untouched', () => {
    const cards = [
      entry('ConstructionHero', '1', 0, 2),
      entry('ConstructionHero', '2', 1, 2),
      entry('ConstructionAboutSplit', null, 0, 1),
    ]
    const content = [{ type: 'ConstructionHero', props: { id: 'x', variant: '2' } }]
    const result = withCurrentSelection(cards, content)
    expect(result.map((c) => `${c.key}:${c.variant}`)).toEqual([
      'ConstructionHero:2',
      'ConstructionHero:1',
      'ConstructionAboutSplit:null',
    ])
  })

  it('matches a null-variant component on type alone', () => {
    const cards = [entry('ConstructionAboutSplit', null, 0, 1)]
    const content = [{ type: 'ConstructionAboutSplit', props: { id: 'y' } }]
    const result = withCurrentSelection(cards, content)
    expect(result[0]?.isCurrent).toBe(true)
  })

  it('leaves order and flags unchanged when nothing on the page matches', () => {
    const cards = [entry('ConstructionHero', '1', 0, 2), entry('ConstructionHero', '2', 1, 2)]
    const content = [{ type: 'SomeOtherBlock', props: { id: 'z' } }]
    const result = withCurrentSelection(cards, content)
    expect(result.every((c) => !c.isCurrent)).toBe(true)
    expect(result.map((c) => c.variant)).toEqual(['1', '2'])
  })

  it('handles empty/undefined content without throwing', () => {
    const cards = [entry('ConstructionHero', '1', 0, 1)]
    expect(withCurrentSelection(cards, [])).toEqual([{ ...cards[0], isCurrent: false }])
    expect(withCurrentSelection(cards, undefined)).toEqual([{ ...cards[0], isCurrent: false }])
  })
})
