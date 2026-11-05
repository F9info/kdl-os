import { describe, it, expect } from 'vitest'
import { isStageNavActive } from '@/components/layout/AdminSidebar'

const base = '/admin/template-engine/projects/p1'

describe('isStageNavActive — CMS entries stay highlighted on their stage pages', () => {
  it('Color Palette on /palette', () => {
    expect(isStageNavActive('/admin/color-palette', `${base}/palette`, '')).toBe(true)
    expect(isStageNavActive('/admin/brands', `${base}/palette`, '')).toBe(false)
  })
  it('Types on /website, Pages only with ?view=pages', () => {
    expect(isStageNavActive('/admin/brands', `${base}/website`, '')).toBe(true)
    expect(isStageNavActive('/admin/pages', `${base}/website`, '')).toBe(false)
    expect(isStageNavActive('/admin/pages', `${base}/website`, '?view=pages')).toBe(true)
    expect(isStageNavActive('/admin/brands', `${base}/website`, '?view=pages')).toBe(false)
  })
  it('does nothing outside Template Engine stage pages', () => {
    expect(isStageNavActive('/admin/color-palette', '/admin/dashboard', '')).toBe(false)
  })
})
