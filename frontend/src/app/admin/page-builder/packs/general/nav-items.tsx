import { useHeaderMenuTree, type HeaderMenuItem } from '../header-nav-menu'

// One shape for header/footer links, whether they come from the Menus module (Admin > CMS >
// Navigation) or from the block's own "Title|/link" fallback lines.
export type NavItem = { label: string; href: string; newTab?: boolean; children: NavItem[] }

// More than this many top-level items and the rest move under a "More" dropdown, so the header
// never overflows (and "Contact us" is never pushed off-screen).
export const MAX_VISIBLE = 7

const safe = (url: string | null) => {
  const u = (url ?? '').trim().toLowerCase()
  return u.startsWith('javascript:') || u.startsWith('data:') || u.startsWith('vbscript:')
    ? '#'
    : url || '#'
}

const fromMenu = (items: HeaderMenuItem[]): NavItem[] =>
  items.map((i) => ({
    label: i.label,
    href: i.no_page ? '' : safe(i.url),
    newTab: i.open_in_new_tab,
    children: fromMenu(i.children),
  }))

const fromLines = (links: string): NavItem[] =>
  links
    .split('\n')
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p.length >= 2 && p[0])
    .map(([label, href]) => ({ label: label!, href: safe(href ?? '#'), children: [] }))

/** Menu module first (once it has items); the block's own lines are only the fallback. */
export function useNavItems(
  key: 'header' | 'footer',
  links: string,
  projectId: string | undefined
): NavItem[] {
  const tree = useHeaderMenuTree(projectId, key)
  return tree ? fromMenu(tree) : fromLines(links ?? '')
}

export const flatten = (items: NavItem[]): NavItem[] =>
  items.flatMap((i) => [i, ...flatten(i.children)]).filter((i) => i.href)

function Sub({ items, depth = 0 }: { items: NavItem[]; depth?: number }) {
  return (
    <>
      {items.map((c, i) => (
        <div key={i}>
          {c.href ? (
            <a
              href={c.href}
              target={c.newTab ? '_blank' : undefined}
              rel={c.newTab ? 'noopener noreferrer' : undefined}
              className="block whitespace-nowrap rounded px-3 py-1.5 text-sm hover:bg-primary/10"
              style={{ paddingLeft: 12 + depth * 12 }}
            >
              {c.label}
            </a>
          ) : (
            <span
              className="block px-3 py-1.5 text-sm font-semibold opacity-70"
              style={{ paddingLeft: 12 + depth * 12 }}
            >
              {c.label}
            </span>
          )}
          {c.children.length > 0 && <Sub items={c.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  )
}

/**
 * Top-level links with hover/focus dropdowns for sub-items. `linkClass` styles each top-level
 * link; `panelClass` styles the dropdown panel (so dark headers can pass dark colours).
 */
export function NavLinks({
  items,
  linkClass,
  panelClass = 'bg-surface text-body border border-divider',
}: {
  items: NavItem[]
  linkClass: string
  panelClass?: string
}) {
  const over = items.length > MAX_VISIBLE
  const shown: (NavItem & { more?: boolean })[] = over
    ? [
        ...items.slice(0, MAX_VISIBLE),
        { label: 'More', href: '', children: items.slice(MAX_VISIBLE), more: true },
      ]
    : items
  return (
    <>
      {shown.map((item, i) =>
        item.children.length > 0 ? (
          <div key={i} className="group relative" data-nav-more={item.more ? 'true' : undefined}>
            {item.href ? (
              <a href={item.href} className={linkClass}>
                {item.label} <span aria-hidden="true">▾</span>
              </a>
            ) : (
              <button type="button" aria-haspopup="true" className={linkClass}>
                {item.label} <span aria-hidden="true">▾</span>
              </button>
            )}
            <div className="invisible absolute left-0 top-full z-30 min-w-44 pt-2 opacity-0 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className={`rounded-lg p-1 shadow-lg ${panelClass}`}>
                <Sub items={item.children} />
              </div>
            </div>
          </div>
        ) : item.href ? (
          <a
            key={i}
            href={item.href}
            target={item.newTab ? '_blank' : undefined}
            rel={item.newTab ? 'noopener noreferrer' : undefined}
            className={linkClass}
          >
            {item.label}
          </a>
        ) : (
          <span key={i} className={`${linkClass} cursor-default`}>
            {item.label}
          </span>
        )
      )}
    </>
  )
}
