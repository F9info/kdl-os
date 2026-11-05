import { describe, it, expect } from 'vitest'
import { applyIdentity } from '@/lib/apply-identity'

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
