import { describe, it, expect } from 'vitest'
import { projectTypeLabel, DELIVERY_OPTIONS, type WebsiteDelivery } from '@/admin/lib/project-type'
import { visibleSurfaces } from '@/admin/lib/website-surfaces'

describe('projectTypeLabel: the seven supported combinations', () => {
  const cases: [string, string[], WebsiteDelivery | null, string][] = [
    ['1 Admin project only', ['admin'], null, 'Admin project'],
    ['2 Web application', ['admin', 'website'], 'web-app', 'Web application'],
    ['3 Static website only', ['admin', 'website'], 'static', 'Static website'],
    ['4 Landing pages only', ['admin', 'landing'], null, 'Landing pages'],
    [
      '5 Web application + Landing pages',
      ['admin', 'website', 'landing'],
      'web-app',
      'Web application + Landing pages',
    ],
    [
      '6 Static website + Landing pages',
      ['admin', 'website', 'landing'],
      'static',
      'Static website + Landing pages',
    ],
    [
      '7 Web application + Static website + Landing pages',
      ['admin', 'website', 'landing'],
      'both',
      'Web application + Static website + Landing pages',
    ],
  ]
  it.each(cases)('%s', (_n, selected, delivery, label) => {
    expect(projectTypeLabel(selected, delivery)).toBe(label)
  })

  it('a Website with no delivery chosen yet is just "Website"; delivery is ignored without the Website product', () => {
    expect(projectTypeLabel(['admin', 'website'], null)).toBe('Website')
    expect(projectTypeLabel(['admin', 'landing'], 'static')).toBe('Landing pages')
    expect(projectTypeLabel([], null)).toBe('Admin project')
  })

  it('offers exactly the three deliveries the backend accepts', () => {
    expect(DELIVERY_OPTIONS.map((o) => o.value)).toEqual(['web-app', 'static', 'both'])
  })
})

describe('visibleSurfaces: Brands cards follow the choice and the enabled modules', () => {
  const on = { landingEnabled: true, formsEnabled: true }
  it('not chosen yet: nothing is hidden (existing installs are unchanged)', () => {
    expect(visibleSurfaces({ delivery: null, ...on })).toEqual([
      'webapp',
      'landing',
      'forms',
      'collateral',
      'static',
    ])
  })
  it('web application: no static-export card', () => {
    expect(visibleSurfaces({ delivery: 'web-app', ...on })).toEqual([
      'webapp',
      'landing',
      'forms',
      'collateral',
    ])
  })
  it('static website: no live Web app card', () => {
    expect(visibleSurfaces({ delivery: 'static', ...on })).toEqual([
      'landing',
      'forms',
      'collateral',
      'static',
    ])
  })
  it('both: everything', () => {
    expect(visibleSurfaces({ delivery: 'both', ...on })).toEqual([
      'webapp',
      'landing',
      'forms',
      'collateral',
      'static',
    ])
  })
  it('Landing Pages and Forms cards need their modules enabled', () => {
    expect(
      visibleSurfaces({ delivery: 'both', landingEnabled: false, formsEnabled: false })
    ).toEqual(['webapp', 'collateral', 'static'])
  })
})
