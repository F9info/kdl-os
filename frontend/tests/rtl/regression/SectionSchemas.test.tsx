import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '@/frontend/blocks/puck.config'
import {
  buildSectionSchemas,
  fieldKind,
  fieldTab,
  isFieldHidden,
  isStyleField,
  sectionSchemas,
} from '@/frontend/blocks/section-schema'

// The committed schema (src/frontend/blocks/section-schemas.json) is generated from the block
// library. Changed a block's fields? Regenerate:  UPDATE_SECTION_SCHEMAS=1 pnpm vitest run tests/rtl/regression/SectionSchemas.test.tsx
const FILE = path.join(process.cwd(), 'src/frontend/blocks/section-schemas.json')
const generated = buildSectionSchemas(config.components as never)

describe('section schemas (T7.1): explicit field kinds and editor tabs per block', () => {
  it('the committed schema matches the block library', () => {
    if (process.env.UPDATE_SECTION_SCHEMAS)
      fs.writeFileSync(FILE, `${JSON.stringify(generated, null, 2)}\n`)
    const committed = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    expect(committed).toEqual(generated) // out of date? see the command at the top of this file
  })

  it('covers every registered block, each with a label and at least its own fields', () => {
    const types = Object.keys(config.components ?? {})
    expect(types.length).toBeGreaterThan(100)
    expect(Object.keys(sectionSchemas).sort()).toEqual(types.slice().sort())
    for (const [type, s] of Object.entries(sectionSchemas)) {
      expect(s.label, type).toBeTruthy()
      for (const [key, f] of Object.entries(s.fields)) {
        expect(['content', 'style'], `${type}.${key}`).toContain(f.tab)
        expect(f.kind, `${type}.${key}`).toBeTruthy()
      }
    }
  })

  it('reproduces the editor tab routing the editor used before (nothing moved tabs)', () => {
    for (const [type, s] of Object.entries(sectionSchemas))
      for (const [key, f] of Object.entries(s.fields))
        expect(f.tab, `${type}.${key}`).toBe(isStyleField(key) ? 'style' : 'content')
  })

  it('known blocks: Hero has content + style fields, ConstructionHero hides its redundant ones', () => {
    expect(sectionSchemas.Hero!.fields.title!.kind).toBe('text')
    expect(sectionSchemas.Hero!.fields.title!.tab).toBe('content')
    expect(sectionSchemas.Hero!.fields.primaryColor!.tab).toBe('style')
    expect(fieldTab('ConstructionHero', 'primaryColor')).toBe('style')
    expect(isFieldHidden('ConstructionHero', 'variant')).toBe(true)
    expect(isFieldHidden('ConstructionHero', 'title')).toBe(false)
  })

  it('a block with no schema entry falls back to the name rule instead of breaking', () => {
    expect(fieldTab('SomeFutureBlock', 'padding')).toBe('style')
    expect(fieldTab('SomeFutureBlock', 'title')).toBe('content')
    expect(isFieldHidden('SomeFutureBlock', 'title')).toBe(false)
  })
})

describe('fieldKind', () => {
  it('maps Puck field types and tells text-like fields apart by what they are for', () => {
    expect(fieldKind('title', { type: 'text' })).toBe('text')
    expect(fieldKind('body', { type: 'textarea' })).toBe('textarea')
    expect(fieldKind('heroImage', { type: 'custom' })).toBe('image')
    expect(fieldKind('logoUrl', { type: 'text' })).toBe('image')
    expect(fieldKind('ctaHref', { type: 'text' })).toBe('link')
    expect(fieldKind('primaryColor', { type: 'text' })).toBe('color')
    expect(fieldKind('items', { type: 'array' })).toBe('list')
    expect(fieldKind('count', { type: 'number' })).toBe('number')
    expect(
      fieldKind('align', { type: 'radio', options: [{ value: 'left' }, { value: 'center' }] })
    ).toBe('select')
    expect(
      fieldKind('rounded', { type: 'radio', options: [{ value: true }, { value: false }] })
    ).toBe('toggle')
    expect(fieldKind('menu', { type: 'custom' })).toBe('custom')
  })

  it('select/toggle entries carry their allowed values', () => {
    const s = buildSectionSchemas({
      X: {
        label: 'X',
        fields: { align: { type: 'radio', options: [{ value: 'left' }, { value: 'right' }] } },
      },
    })
    expect(s.X!.fields.align).toEqual({ kind: 'select', tab: 'style', options: ['left', 'right'] })
  })
})
