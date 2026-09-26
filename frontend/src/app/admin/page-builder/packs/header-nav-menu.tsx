import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

// Defense-in-depth: the backend schema already blocks javascript:/data:/
// vbscript: on write, but old rows or a direct DB edit could still carry one.
function safeHref(url: string | null) {
  const trimmed = (url ?? '').trim().toLowerCase()
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return '#'
  }
  return url || '#'
}

export interface HeaderMenuItem {
  id: string
  label: string
  url: string | null
  open_in_new_tab: boolean
  children: HeaderMenuItem[]
}

/**
 * Fetches the project's "header" Menu tree (Menus module — see
 * backend/src/modules/menus/) for `ConstructionHeader`. `null` (not `[]`)
 * means "no menu configured for this project yet" — the caller falls back
 * to its own flat `links` field in that case, same "DB wins once
 * populated" pattern as every other module this session.
 */
export function useHeaderMenuTree(projectId: string | undefined) {
  const { data } = useQuery({
    queryKey: ['menu-public-header', projectId],
    queryFn: () =>
      fetch(`/api/menus/public?key=header${projectId ? `&project_id=${projectId}` : ''}`)
        .then((r) => r.json())
        .then((json) => (json?.data?.menu?.items ?? null) as HeaderMenuItem[] | null),
    enabled: Boolean(projectId),
  })
  return data && data.length > 0 ? data : null
}

/**
 * Desktop header nav rendered from a (up to 3-level) Menu tree — a hover
 * dropdown for level 2, a hover flyout to the side for level 3. Pure CSS
 * (Tailwind `group`/`group-hover`), no open/close state — matches the
 * always-available hover-dropdown pattern real sites use, and needs no
 * click-outside handling.
 */
export function HeaderNavMenu({
  items,
  linkClassName,
  activeClassName,
}: {
  items: HeaderMenuItem[]
  linkClassName: string
  activeClassName: string
}) {
  return (
    <nav className="flex items-center gap-2">
      {items.map((item, i) => {
        const hasChildren = item.children.length > 0
        return (
          <div key={item.id} className={hasChildren ? 'group/l1 relative' : undefined}>
            <Link
              href={safeHref(item.url)}
              target={item.open_in_new_tab ? '_blank' : undefined}
              rel={item.open_in_new_tab ? 'noopener noreferrer' : undefined}
              className={`${i === 0 ? activeClassName : `${linkClassName} px-2`} inline-flex items-center gap-1`}
            >
              {item.label}
              {hasChildren && (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              )}
            </Link>
            {hasChildren && (
              <div className="invisible absolute left-0 top-full z-50 min-w-[200px] rounded-lg border border-slate-200 bg-white py-2 opacity-0 shadow-lg transition group-hover/l1:visible group-hover/l1:opacity-100">
                {item.children.map((child) => {
                  const hasGrandchildren = child.children.length > 0
                  return (
                    <div
                      key={child.id}
                      className={hasGrandchildren ? 'group/l2 relative' : undefined}
                    >
                      <Link
                        href={safeHref(child.url)}
                        target={child.open_in_new_tab ? '_blank' : undefined}
                        rel={child.open_in_new_tab ? 'noopener noreferrer' : undefined}
                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {child.label}
                        {hasGrandchildren && (
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                          </svg>
                        )}
                      </Link>
                      {hasGrandchildren && (
                        <div className="invisible absolute left-full top-0 z-50 min-w-[200px] rounded-lg border border-slate-200 bg-white py-2 opacity-0 shadow-lg transition group-hover/l2:visible group-hover/l2:opacity-100">
                          {child.children.map((grandchild) => (
                            <Link
                              key={grandchild.id}
                              href={safeHref(grandchild.url)}
                              target={grandchild.open_in_new_tab ? '_blank' : undefined}
                              rel={grandchild.open_in_new_tab ? 'noopener noreferrer' : undefined}
                              className="block px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {grandchild.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
