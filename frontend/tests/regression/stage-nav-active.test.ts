import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { isNavActive } from '@/admin/lib/nav-model'
import type { ModuleNavItem } from '@/types/models.types'

// The CMS entries that open as a stage of the Template Engine page declare `activeWhen` in the
// `menus` manifest. Read the REAL manifest so this test fails if that config is changed or lost.
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), '../backend/src/modules/menus/module.json'), 'utf8')
) as { nav: ModuleNavItem[] }
const entry = (label: string) => manifest.nav.find((n) => n.label === label)!
const palette = entry('Color Palette')
const brands = entry('Brands')
const pages = entry('Pages')
const layouts = entry('Layouts')

const base = '/admin/template-engine/projects/p1'

describe('isNavActive: CMS entries stay highlighted on their stage pages', () => {
  it('Color Palette on /palette', () => {
    expect(isNavActive(palette, `${base}/palette`, '')).toBe(true)
    expect(isNavActive(brands, `${base}/palette`, '')).toBe(false)
  })
  it('Brands on /website, Pages and Layouts only with their ?view=', () => {
    expect(isNavActive(brands, `${base}/website`, '')).toBe(true)
    expect(isNavActive(pages, `${base}/website`, '')).toBe(false)
    expect(isNavActive(pages, `${base}/website`, '?view=pages')).toBe(true)
    expect(isNavActive(layouts, `${base}/website`, '?view=layouts')).toBe(true)
    expect(isNavActive(brands, `${base}/website`, '?view=pages')).toBe(false)
    expect(isNavActive(brands, `${base}/website`, '?view=layouts')).toBe(false)
  })
  it('does nothing outside Template Engine stage pages', () => {
    expect(isNavActive(palette, '/admin/dashboard', '')).toBe(false)
  })
  it('plain entries match their path and sub-paths, or only the exact path when asked', () => {
    const users: ModuleNavItem = { label: 'Users', path: '/admin/users' }
    expect(isNavActive(users, '/admin/users', '')).toBe(true)
    expect(isNavActive(users, '/admin/users/42', '')).toBe(true)
    expect(isNavActive(users, '/admin/users/42', '', true)).toBe(false)
    expect(isNavActive(users, '/admin/usersx', '')).toBe(false)
  })
})
