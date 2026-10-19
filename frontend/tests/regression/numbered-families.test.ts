import { describe, it, expect } from 'vitest'
import families from '@/app/admin/page-builder/packs/numbered-families.json'
import {
  itemsFromLegacy,
  resolveItems,
  withNumberedFamilies,
} from '@/app/admin/page-builder/packs/numbered-families'
import { construction } from '@/app/admin/page-builder/packs/construction'

describe('numbered families', () => {
  it('builds rows from legacy slots and drops empty ones', () => {
    expect(
      itemsFromLegacy(
        { faq1Question: 'Q1', faq1Answer: 'A1', faq2Question: '', faq2Answer: '' },
        'faq'
      )
    ).toEqual([{ question: 'Q1', answer: 'A1' }])
  })

  it('resolveItems prefers the array and falls back to the legacy rows', () => {
    const legacy = [{ q: 'old' }]
    expect(resolveItems([{ q: 'new' }], legacy, (r) => ({ q: r.q as string }))).toEqual([
      { q: 'new' },
    ])
    expect(resolveItems(undefined, legacy, (r) => ({ q: r.q as string }))).toBe(legacy)
  })

  it('turns flat fields into one array field and moves the defaults into rows', () => {
    const out = withNumberedFamilies({
      ConstructionFAQ: {
        fields: {
          title: { type: 'text' },
          faq1Question: { type: 'text' },
          faq1Answer: { type: 'textarea' },
          faq2Question: { type: 'text' },
          faq2Answer: { type: 'textarea' },
        },
        defaultProps: {
          title: 'T',
          faq1Question: 'Q1',
          faq1Answer: 'A1',
          faq2Question: 'Q2',
          faq2Answer: 'A2',
        },
      },
    }) as {
      ConstructionFAQ: {
        fields: Record<string, { type: string }>
        defaultProps: Record<string, unknown>
      }
    }
    const def = out.ConstructionFAQ
    expect(def.fields.faqs?.type).toBe('array')
    expect(def.defaultProps.faqs).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ])
    expect(def.defaultProps).not.toHaveProperty('faq1Question')
  })

  // Guards the single table against drifting from the real block definitions.
  it.each(Object.entries(families as Record<string, { prefix: string; prop: string }[]>))(
    '%s exposes its array field(s) and no legacy defaults',
    (type, fams) => {
      const def = (construction.components as Record<string, any>)[type]
      expect(def, `${type} missing from construction pack`).toBeTruthy()
      for (const { prefix, prop } of fams) {
        expect(def.fields[prop]?.type).toBe('array')
        expect(Array.isArray(def.defaultProps[prop])).toBe(true)
        expect(Object.keys(def.defaultProps).some((k) => new RegExp(`^${prefix}\\d`).test(k))).toBe(
          false
        )
      }
    }
  )
})
