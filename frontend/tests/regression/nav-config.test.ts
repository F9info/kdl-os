import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NAV_ICONS } from '@/admin/lib/nav-icons'
import { buildNavModel, flattenNav } from '@/admin/lib/nav-model'
import type { EnabledModule, ModuleNavItem } from '@/types/models.types'

/**
 * Navigation is configured ONLY in the module manifests (`nav` in backend/src/modules/<m>/module.json).
 * These tests read every real manifest, so a bad icon, a duplicate link, a link to a page that does not
 * exist or a permission nobody registered fails here instead of showing up as a broken sidebar.
 */
const ROOT = path.resolve(process.cwd(), '..')
const MODULES_DIR = path.join(ROOT, 'backend/src/modules')
const ADMIN_APP = path.join(process.cwd(), 'src/app')

interface Manifest {
  slug: string
  name: string
  core?: boolean
  umbrella?: boolean
  icon?: string
  dependsOn?: string[]
  navSuppressedByPeer?: string[]
  permissions?: (string | { name: string; actions: string[] })[]
  nav?: ModuleNavItem[]
}

const manifests: Manifest[] = fs
  .readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(MODULES_DIR, d.name, 'module.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(MODULES_DIR, d.name, 'module.json'), 'utf8')))
  // The e2e fixture is test scaffolding, not part of the product.
  .filter((m: Manifest) => m.slug !== 'e2e-fixture')

const DEFAULT_ACTIONS = ['view', 'add', 'edit', 'delete', 'publish']

// Permission modules and their actions: manifests + the base modules the RBAC seed registers.
const permissionActions = new Map<string, string[]>()
for (const m of manifests) {
  for (const p of m.permissions ?? []) {
    if (typeof p === 'string') permissionActions.set(p, DEFAULT_ACTIONS)
    else permissionActions.set(p.name, p.actions)
  }
}
const seed = fs.readFileSync(
  path.join(ROOT, 'backend/prisma/seeders/user-management.seed.js'),
  'utf8'
)
for (const match of seed.matchAll(/\{ name: '([a-z-]+)', label:/g)) {
  const name = match[1] ?? ''
  if (!permissionActions.has(name)) permissionActions.set(name, DEFAULT_ACTIONS)
}

const allItems = manifests.flatMap((m) => (m.nav ?? []).map((item) => ({ slug: m.slug, item })))

describe('manifest navigation config', () => {
  it('every entry names a registered icon (no silent fallback to the generic one)', () => {
    for (const { slug, item } of allItems) {
      expect(item.icon, `${slug} › ${item.label} has no icon`).toBeTruthy()
      expect(
        Object.keys(NAV_ICONS),
        `${slug} › ${item.label}: unknown icon ${item.icon}`
      ).toContain(item.icon)
      if (item.groupIcon)
        expect(Object.keys(NAV_ICONS), `${slug} › group icon ${item.groupIcon}`).toContain(
          item.groupIcon
        )
    }
  })

  it('a bundle (umbrella) names a registered icon for its own entry', () => {
    for (const m of manifests.filter((x) => x.umbrella)) {
      expect(m.icon, `${m.slug} (bundle) has no icon`).toBeTruthy()
      expect(Object.keys(NAV_ICONS), `${m.slug}: unknown icon ${m.icon}`).toContain(m.icon)
    }
  })

  it('no two entries share a link', () => {
    const seen = new Map<string, string>()
    for (const { slug, item } of allItems) {
      expect(
        seen.get(item.path),
        `${item.path} is declared by ${seen.get(item.path)} and ${slug}`
      ).toBeUndefined()
      seen.set(item.path, slug)
    }
  })

  it('every link points to an admin page that exists', () => {
    for (const { slug, item } of allItems) {
      expect(item.path.startsWith('/admin/'), `${slug} › ${item.path}`).toBe(true)
      const page = path.join(ADMIN_APP, item.path.replace(/^\//, ''), 'page.tsx')
      expect(fs.existsSync(page), `${slug} › ${item.label}: no page at ${item.path}`).toBe(true)
    }
  })

  it('every permission is a registered module:action', () => {
    for (const { slug, item } of allItems) {
      if (!item.permission) continue
      const [mod = '', action = ''] = item.permission.split(':')
      expect(
        permissionActions.has(mod),
        `${slug} › ${item.label}: unknown permission module ${mod}`
      ).toBe(true)
      expect(
        permissionActions.get(mod),
        `${slug} › ${item.label}: ${mod} has no action ${action}`
      ).toContain(action)
    }
  })

  it('titles are unique inside their group, and each group has one consistent icon and position', () => {
    const groups = new Map<string, ModuleNavItem[]>()
    for (const { item } of allItems)
      if (item.group) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
    for (const [name, items] of groups) {
      const labels = items.map((i) => i.label)
      expect(new Set(labels).size, `group ${name} repeats a title`).toBe(labels.length)
      const icons = new Set(items.map((i) => i.groupIcon).filter(Boolean))
      const orders = new Set(items.map((i) => i.groupOrder).filter((o) => o !== undefined))
      expect(icons.size, `group ${name} needs exactly one groupIcon`).toBe(1)
      expect(orders.size, `group ${name} needs exactly one groupOrder`).toBe(1)
    }
  })

  it('no two links anywhere use the same title', () => {
    const all = allItems.map((x) => x.item.label)
    expect(new Set(all).size, 'a title is used by two different links').toBe(all.length)
  })
})

// Everything enabled, the way the backend serialises it (umbrella parent, peer suppression).
function enabledFrom(list: Manifest[]): EnabledModule[] {
  const slugs = new Set(list.map((m) => m.slug))
  return list.map((m) => ({
    slug: m.slug,
    name: m.name,
    icon: m.icon ?? null,
    core: !!m.core,
    parent: list.find((o) => o.umbrella && o.dependsOn?.includes(m.slug))?.slug ?? null,
    hidden_by_products: false,
    nav: (m.navSuppressedByPeer ?? []).some((p) => slugs.has(p)) ? [] : (m.nav ?? []),
  }))
}

describe('navigation built from the real manifests', () => {
  const model = buildNavModel(enabledFrom(manifests))

  it('top level: Users, Modules, then the optional modules in their configured order', () => {
    expect(model.top.map((i) => i.label)).toEqual([
      'Users',
      'Modules',
      'Notifications',
      'Integrations',
    ])
  })

  it('groups: Admin Settings, Media, Access Control, Settings, with their entries in order', () => {
    expect(model.groups.map((g) => g.label)).toEqual([
      'Admin Settings',
      'Media',
      'Access Control',
      'Settings',
    ])
    const by = Object.fromEntries(model.groups.map((g) => [g.label, g.items.map((i) => i.label)]))
    expect(by['Media']).toEqual(['Library', 'AI Providers', 'Cloud Imports'])
    expect(by['Access Control']).toEqual(['Roles', 'Permissions', 'Activity Log'])
    expect(by['Admin Settings']).toEqual(['Identity', 'SEO', 'Themes'])
    expect(by['Settings']).toEqual(['Field Types', 'Field Categories', 'Custom Fields', 'Storage'])
  })

  it('the CMS bundle (Content) owns the website parts and none of them leak to the top level', () => {
    const content = model.bundles.find((b) => b.label === 'Frontend')!
    expect(content.icon).toBe('LayoutGrid')
    const labels = content.items.map((i) => i.label)
    for (const l of [
      'Website Details',
      'Color Palette',
      'Brands',
      'Navigation',
      'Layouts',
      'Pages',
      'Sections',
    ])
      expect(labels).toContain(l)
    for (const l of labels) expect(model.top.map((i) => i.label)).not.toContain(l)
  })

  it('Landing Pages and Forms stay out of the sidebar (cards on Content > Brands)', () => {
    const labels = flattenNav(model).map((i) => i.label)
    expect(labels).not.toContain('Landing Pages')
    expect(labels).not.toContain('Forms')
  })

  it('disabling a module removes exactly its entries; no empty bundle is left behind', () => {
    const without = (...slugs: string[]) =>
      flattenNav(buildNavModel(enabledFrom(manifests.filter((m) => !slugs.includes(m.slug))))).map(
        (i) => i.label
      )
    const full = flattenNav(model).map((i) => i.label)
    expect(without('integrations')).toEqual(full.filter((l) => l !== 'Integrations'))
    expect(without('notifications', 'theme-engine-ui')).toEqual(
      full.filter((l) => l !== 'Notifications' && l !== 'Themes')
    )
    const noCms = buildNavModel(enabledFrom(manifests.filter((m) => m.slug !== 'cms')))
    // Without the umbrella its parts are no longer bundled: they surface as plain top-level entries.
    expect(noCms.bundles.map((b) => b.label)).not.toContain('Frontend')
  })
})
