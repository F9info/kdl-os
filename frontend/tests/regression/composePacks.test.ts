import { describe, it, expect } from 'vitest'
import { composePacks } from '@/app/admin/page-builder/packs/compose'
import type { ComponentPack } from '@/app/admin/page-builder/packs/types'

const root = {
  fields: { title: { type: 'text' as const } },
  defaultProps: { title: 'Test' },
  render: () => null as unknown as React.ReactElement,
}

const makeComponent = () => ({
  label: 'test',
  fields: {},
  defaultProps: {},
  render: () => null as unknown as React.ReactElement,
})

describe('composePacks', () => {
  it('merges components from a single pack into the config', () => {
    const pack: ComponentPack = {
      key: 'a',
      label: 'Pack A',
      components: { Foo: makeComponent(), Bar: makeComponent() },
    }
    const cfg = composePacks(root, [pack])
    expect(Object.keys(cfg.components!)).toContain('Foo')
    expect(Object.keys(cfg.components!)).toContain('Bar')
  })

  it('merges components from multiple packs', () => {
    const packA: ComponentPack = {
      key: 'a',
      label: 'Pack A',
      components: { Foo: makeComponent() },
    }
    const packB: ComponentPack = {
      key: 'b',
      label: 'Pack B',
      components: { Bar: makeComponent() },
    }
    const cfg = composePacks(root, [packA, packB])
    expect(Object.keys(cfg.components!)).toContain('Foo')
    expect(Object.keys(cfg.components!)).toContain('Bar')
  })

  it('merges categories from multiple packs', () => {
    const packA: ComponentPack = {
      key: 'a',
      label: 'Pack A',
      components: { Foo: makeComponent() },
      categories: { layout: { title: 'Layout', components: ['Foo'] } },
    }
    const packB: ComponentPack = {
      key: 'b',
      label: 'Pack B',
      components: { Bar: makeComponent() },
      categories: { content: { title: 'Content', components: ['Bar'] } },
    }
    const cfg = composePacks(root, [packA, packB])
    expect(cfg.categories?.layout?.components).toContain('Foo')
    expect(cfg.categories?.content?.components).toContain('Bar')
  })

  it('extends an existing category when multiple packs share the same category key', () => {
    const packA: ComponentPack = {
      key: 'a',
      label: 'Pack A',
      components: { Foo: makeComponent() },
      categories: { layout: { title: 'Layout', components: ['Foo'] } },
    }
    const packB: ComponentPack = {
      key: 'b',
      label: 'Pack B',
      components: { Bar: makeComponent() },
      categories: { layout: { title: 'Layout', components: ['Bar'] } },
    }
    const cfg = composePacks(root, [packA, packB])
    expect(cfg.categories?.layout?.components).toContain('Foo')
    expect(cfg.categories?.layout?.components).toContain('Bar')
  })

  it('throws on component key collision between packs', () => {
    const packA: ComponentPack = {
      key: 'a',
      label: 'Pack A',
      components: { Shared: makeComponent() },
    }
    const packB: ComponentPack = {
      key: 'b',
      label: 'Pack B',
      components: { Shared: makeComponent() },
    }
    expect(() => composePacks(root, [packA, packB])).toThrow(/Component key collision.*"Shared"/)
  })

  it('preserves the given root on the returned config', () => {
    const cfg = composePacks(root, [])
    expect(cfg.root).toBe(root)
  })
})
