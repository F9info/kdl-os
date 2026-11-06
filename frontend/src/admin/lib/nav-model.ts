import type { EnabledModule, ModuleNavItem } from '@/types/models.types'

// The admin sidebar and the command palette are both built from this model, and the model is built
// only from the enabled modules' manifests (`nav` in module.json). The one thing that is not a
// module is the Dashboard, which is the app shell itself.

export const SHELL_ITEMS: ModuleNavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard', order: 0 },
]

export interface NavSection {
  key: string
  label: string
  icon?: string
  order: number
  items: ModuleNavItem[]
}

export interface NavModel {
  /** Entries with no group, after the shell items. */
  top: ModuleNavItem[]
  /** Collapsible groups declared by `nav[].group` (Media, Access Control, Settings, ...). */
  groups: NavSection[]
  /** Parts of an umbrella bundle (Content) listed under the bundle's own entry. */
  bundles: NavSection[]
}

const DEFAULT_ORDER = 100

/** Stable sort by `order` (default 100); equal orders keep their manifest order. */
function byOrder(items: ModuleNavItem[]): ModuleNavItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (a.item.order ?? DEFAULT_ORDER) - (b.item.order ?? DEFAULT_ORDER) || a.index - b.index
    )
    .map((x) => x.item)
}

/** First registration of a path wins, so two manifests can never show the same link twice. */
function uniqueByPath(items: ModuleNavItem[]): ModuleNavItem[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.path) ? false : (seen.add(i.path), true)))
}

export function buildNavModel(modules: EnabledModule[]): NavModel {
  const visible = modules.filter((m) => !m.hidden_by_products)

  const top: ModuleNavItem[] = []
  const groupItems = new Map<string, ModuleNavItem[]>()
  const groupMeta = new Map<string, { icon?: string; order: number }>()

  for (const m of visible.filter((x) => !x.parent)) {
    for (const item of m.nav) {
      if (!item.group) {
        top.push(item)
        continue
      }
      groupItems.set(item.group, [...(groupItems.get(item.group) ?? []), item])
      const meta = groupMeta.get(item.group) ?? { order: DEFAULT_ORDER }
      groupMeta.set(item.group, {
        icon: meta.icon ?? item.groupIcon,
        order: item.groupOrder ?? meta.order,
      })
    }
  }

  const groups: NavSection[] = [...groupItems.entries()]
    .map(([label, items]) => ({
      key: `group:${label}`,
      label,
      icon: groupMeta.get(label)?.icon,
      order: groupMeta.get(label)?.order ?? DEFAULT_ORDER,
      items: uniqueByPath(byOrder(items)),
    }))
    .sort((a, b) => a.order - b.order)

  const bundles: NavSection[] = visible
    .filter((b) => visible.some((m) => m.parent === b.slug))
    .map((b) => ({
      key: `bundle:${b.slug}`,
      label: b.name,
      icon: b.icon ?? undefined,
      order: DEFAULT_ORDER,
      items: uniqueByPath(
        byOrder(visible.filter((m) => m.parent === b.slug).flatMap((m) => m.nav))
      ),
    }))

  return { top: uniqueByPath(byOrder(top)), groups, bundles }
}

/** Every link in the model, in sidebar order: shell, top level, bundles, groups. */
export function flattenNav(model: NavModel): ModuleNavItem[] {
  return uniqueByPath([
    ...SHELL_ITEMS,
    ...model.top,
    ...model.bundles.flatMap((b) => b.items),
    ...model.groups.flatMap((g) => g.items),
  ])
}

/**
 * Is this entry the current page? Plain entries match their path (and sub-paths unless `exact`).
 * Entries that open as a stage of another screen declare `activeWhen` in the manifest instead.
 */
export function isNavActive(
  item: ModuleNavItem,
  pathname: string,
  search: URLSearchParams | string,
  exact = false
): boolean {
  const plain = pathname === item.path || (!exact && pathname.startsWith(item.path + '/'))
  const w = item.activeWhen
  if (!w) return plain
  const view = (typeof search === 'string' ? new URLSearchParams(search) : search).get('view')
  const stage =
    (!w.pathStartsWith || pathname.startsWith(w.pathStartsWith)) &&
    (!w.pathEndsWith || pathname.endsWith(w.pathEndsWith)) &&
    (w.view === undefined || view === w.view) &&
    !(w.viewNotIn && view !== null && w.viewNotIn.includes(view))
  return plain || stage
}
