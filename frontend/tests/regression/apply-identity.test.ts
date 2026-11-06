import { describe, it, expect } from 'vitest'
import { applyIdentity, mergeIdentity } from '@/frontend/lib/apply-identity'

type Page = { root: object; content: { type: string; props: Record<string, any> }[] }
const page: Page = {
  root: {},
  content: [
    {
      type: 'ConstructionHeader',
      props: { brand: 'Old Co', logoUrl: '/old.png', transparent: true },
    },
    { type: 'ConstructionHero', props: { brand: 'Keep me' } },
    { type: 'Footer', props: { brand: 'Old Co', logoUrl: '' } },
    {
      type: 'CustomComposedBlock',
      props: {
        config: {
          atoms: [
            { type: 'logo', src: '/old.png', text: 'Old Co' },
            { type: 'row', children: [{ type: 'logo', src: '', text: '' }] },
          ],
        },
      },
    },
  ],
}

describe('applyIdentity', () => {
  it('overlays name and logo on header/footer blocks only, keeping other props', () => {
    const out = applyIdentity(page, { app_name: 'Acme', logo_light: 'https://cdn/x.png' })
    expect(out.content[0]!.props).toMatchObject({
      brand: 'Acme',
      logoUrl: 'https://cdn/x.png',
      transparent: true,
    })
    expect(out.content[1]!.props).toEqual({ brand: 'Keep me' }) // not a brand block
    expect(out.content[2]!.props).toMatchObject({ brand: 'Acme', logoUrl: 'https://cdn/x.png' })
  })

  it('updates logo atoms in composed blocks, including nested ones', () => {
    const out = applyIdentity(page, { app_name: 'Acme', logo_light: '/n.png' })
    const atoms = out.content[3]!.props.config.atoms
    expect(atoms[0]).toMatchObject({ src: '/n.png', text: 'Acme' })
    expect(atoms[1].children![0].src).toBe('/n.png')
  })

  it('empty identity values keep the baked ones (fallback)', () => {
    expect(applyIdentity(page, {})).toBe(page)
    const out = applyIdentity(page, { app_name: 'Acme', logo_light: '' })
    expect(out.content[0]!.props).toMatchObject({ brand: 'Acme', logoUrl: '/old.png' })
    const out2 = applyIdentity(page, { app_name: '  ', logo_light: '/n.png' })
    expect(out2.content[0]!.props).toMatchObject({ brand: 'Old Co', logoUrl: '/n.png' })
  })

  it('never mutates the input and tolerates missing data', () => {
    const copy = JSON.stringify(page)
    applyIdentity(page, { app_name: 'Acme' })
    expect(JSON.stringify(page)).toBe(copy)
    expect(applyIdentity(null, { app_name: 'x' })).toBeNull()
    expect(applyIdentity({ content: 'nope' }, { app_name: 'x' })).toEqual({ content: 'nope' })
  })
})

describe('mergeIdentity (T5.5)', () => {
  const base = { app_name: 'Project', logo_light: '/p.png', description: 'd' }
  it('no overrides: the project identity as is', () => {
    expect(mergeIdentity(base, null)).toBe(base)
    expect(mergeIdentity(base, undefined)).toBe(base)
  })
  it('non-empty overrides win, empty or blank ones inherit, input not mutated', () => {
    const merged = mergeIdentity(base, { app_name: 'Spring', logo_light: '', description: '  ' })
    expect(merged).toEqual({ app_name: 'Spring', logo_light: '/p.png', description: 'd' })
    expect(base.app_name).toBe('Project')
  })
  it("a page's own logo replaces the project's dark logo too, unless it has its own dark one", () => {
    const withDark = { ...base, logo_dark: '/p-dark.png' }
    expect(mergeIdentity(withDark, { logo_light: '/s.png' })).not.toHaveProperty('logo_dark')
    expect(
      mergeIdentity(withDark, { logo_light: '/s.png', logo_dark: '/s-dark.png' }).logo_dark
    ).toBe('/s-dark.png')
    expect(mergeIdentity(withDark, { app_name: 'Spring' }).logo_dark).toBe('/p-dark.png')
  })
  it('the merged identity drives the header/footer brand', () => {
    const data = {
      root: {},
      content: [{ type: 'NavBar', props: { brand: 'Baked', logoUrl: '/b.png' } }],
    }
    const out = applyIdentity(data, mergeIdentity(base, { app_name: 'Spring' }))
    expect(out.content[0]!.props).toMatchObject({ brand: 'Spring', logoUrl: '/p.png' })
  })
})
