import { useState, type ReactNode } from 'react'
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

// `no_page` items keep their dropdown (hover is on the wrapping div, not
// this element) but stop being a clickable link — same className either
// way so layout/hover styling is identical.
function NavLabel({
  item,
  className,
  children,
  onClick,
}: {
  item: HeaderMenuItem
  className: string
  children: ReactNode
  onClick?: () => void
}) {
  if (item.no_page) {
    return <span className={`${className} cursor-default select-none`}>{children}</span>
  }
  return (
    <Link
      href={safeHref(item.url)}
      target={item.open_in_new_tab ? '_blank' : undefined}
      rel={item.open_in_new_tab ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      className={className}
    >
      {children}
    </Link>
  )
}

export interface HeaderMenuItem {
  id: string
  label: string
  url: string | null
  open_in_new_tab: boolean
  no_page?: boolean
  children: HeaderMenuItem[]
}

// Menu items store `/p/te-<runId>-<key>`; the site serves each page at `/<key>` (Home at `/`),
// so link there directly instead of bouncing through the /p redirect.
const PAGE_URL = /^\/p\/(?:.+?-c[a-z0-9]{24}-)([^/?#]+)([?#].*)?$/
function friendlyUrl(url: string | null): string | null {
  const m = url ? PAGE_URL.exec(url) : null
  return m ? `${m[1] === 'home' ? '/' : `/${m[1]}`}${m[2] ?? ''}` : url
}
function friendlyTree(items: HeaderMenuItem[]): HeaderMenuItem[] {
  return items.map((i) => ({ ...i, url: friendlyUrl(i.url), children: friendlyTree(i.children) }))
}

/**
 * Fetches a project's Menu tree by key (Menus module — see
 * backend/src/modules/menus/) — `key: 'header'` for `ConstructionHeader`,
 * `key: 'footer'` for `ConstructionFooter`. These are genuinely independent
 * menus (separate rows), not the same tree shown twice. `null` (not `[]`)
 * means "no menu configured for this project yet" — the caller falls back
 * to its own flat `links` field in that case, same "DB wins once
 * populated" pattern as every other module this session.
 */
export function useHeaderMenuTree(projectId: string | undefined, key: string = 'header') {
  const { data } = useQuery({
    queryKey: ['menu-public', key, projectId],
    queryFn: () =>
      fetch(`/api/menus/public?key=${key}${projectId ? `&project_id=${projectId}` : ''}`)
        .then((r) => r.json())
        .then((json) => {
          const items = json?.data?.menu?.items as HeaderMenuItem[] | undefined
          return items ? friendlyTree(items) : null
        }),
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
            <NavLabel
              item={item}
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
            </NavLabel>
            {hasChildren && (
              <div className="invisible absolute left-0 top-full z-50 min-w-[200px] rounded-lg border border-divider bg-card py-2 opacity-0 shadow-lg transition group-hover/l1:visible group-hover/l1:opacity-100">
                {item.children.map((child) => {
                  const hasGrandchildren = child.children.length > 0
                  return (
                    <div
                      key={child.id}
                      className={hasGrandchildren ? 'group/l2 relative' : undefined}
                    >
                      <NavLabel
                        item={child}
                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-body hover:bg-background"
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
                      </NavLabel>
                      {hasGrandchildren && (
                        <div className="invisible absolute left-full top-0 z-50 min-w-[200px] rounded-lg border border-divider bg-card py-2 opacity-0 shadow-lg transition group-hover/l2:visible group-hover/l2:opacity-100">
                          {child.children.map((grandchild) => (
                            <NavLabel
                              key={grandchild.id}
                              item={grandchild}
                              className="block px-4 py-2 text-sm font-medium text-body hover:bg-background"
                            >
                              {grandchild.label}
                            </NavLabel>
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

const MOBILE_INDENT = ['', 'ml-4 border-l border-divider pl-3', 'ml-4 border-l border-divider pl-3']
const MOBILE_TEXT = ['text-lg font-medium', 'text-base', 'text-sm text-body']

function MobileNavItem({
  item,
  depth,
  onNavigate,
}: {
  item: HeaderMenuItem
  depth: number
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const hasChildren = item.children.length > 0
  const text = `${MOBILE_TEXT[depth] ?? MOBILE_TEXT[2]} text-title`
  return (
    <div className={depth > 0 ? (MOBILE_INDENT[depth] ?? MOBILE_INDENT[2]) : undefined}>
      <div className="flex items-center justify-between gap-2 py-2">
        {item.no_page ? (
          // Not a link: tapping the label itself should open its sub-items.
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`flex-1 text-left ${text}`}
          >
            {item.label}
          </button>
        ) : (
          <NavLabel item={item} className={`flex-1 ${text}`} onClick={onNavigate}>
            {item.label}
          </NavLabel>
        )}
        {hasChildren && (
          <button
            type="button"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="p-2 -mr-2 text-body"
          >
            <svg
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div>
          {item.children.map((child) => (
            <MobileNavItem key={child.id} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Mobile-drawer counterpart of `HeaderNavMenu`: the same (up to 3-level) Menu
 * tree as a tap-to-expand accordion — hover dropdowns don't exist on touch.
 * `onNavigate` closes the drawer when a link is followed.
 */
export function MobileNavMenu({
  items,
  onNavigate,
}: {
  items: HeaderMenuItem[]
  onNavigate: () => void
}) {
  return (
    <nav className="mb-8 flex flex-col overflow-y-auto">
      {items.map((item) => (
        <MobileNavItem key={item.id} item={item} depth={0} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}
