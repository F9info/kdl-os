import { describe, it, expect } from 'vitest'
import { projectTypeLabel } from '@/admin/lib/project-type'
import { visibleSurfaces } from '@/admin/lib/website-surfaces'

describe('projectTypeLabel: one website product, the Web app', () => {
  const cases: [string, string[], string][] = [
    ['Admin project only', ['admin'], 'Admin project'],
    ['Web app', ['admin', 'website'], 'Web app'],
    ['Landing pages only', ['admin', 'landing'], 'Landing pages'],
    ['Web app + Landing pages', ['admin', 'website', 'landing'], 'Web app + Landing pages'],
  ]
  it.each(cases)('%s', (_name, selected, label) => {
    expect(projectTypeLabel(selected)).toBe(label)
  })

  it('has no separate "static website" type: a static copy is a conversion of the Web app', () => {
    for (const selected of [
      ['admin', 'website'],
      ['admin', 'website', 'landing'],
    ]) {
      expect(projectTypeLabel(selected)).not.toMatch(/static/i)
    }
    expect(projectTypeLabel([])).toBe('Admin project')
  })
})

describe('visibleSurfaces: Brands cards', () => {
  it('Web app, Landing Pages and Collateral', () => {
    expect(visibleSurfaces({ landingEnabled: true })).toEqual(['webapp', 'landing', 'collateral'])
  })

  it('no Landing Pages card without the Landing module', () => {
    expect(visibleSurfaces({ landingEnabled: false })).toEqual(['webapp', 'collateral'])
  })

  it('Forms and the static export are inside the Web app, never cards of their own', () => {
    const all = visibleSurfaces({ landingEnabled: true }) as string[]
    expect(all).not.toContain('forms')
    expect(all).not.toContain('static')
  })
})
