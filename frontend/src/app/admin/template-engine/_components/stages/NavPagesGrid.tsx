'use client'

import { Pencil } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { listPages } from '@/app/admin/page-builder/store'
import type { PageRecord } from '@/frontend/pages/page-record'
import type { MenuItemNode } from '@/app/admin/menus/_tree'

export interface NavPageCard {
  key: string
  label: string
  page: PageRecord | null
}

const flatten = (nodes: MenuItemNode[]): MenuItemNode[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)])

/**
 * One card per Navigation entry (plus Home, which is the site root, not a menu item), each resolved to
 * its builder page by page_id, else by the `/p/<slug>` URL. Same source as the Navigation step, so the
 * two always list the same pages.
 */
export function resolveNavPages(
  items: MenuItemNode[],
  pages: PageRecord[],
  homeId?: string
): NavPageCard[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const bySlug = new Map(pages.map((p) => [p.slug, p]))
  const home = (homeId && byId.get(homeId)) || pages.find((p) => /(^|-)home$/.test(p.slug)) || null
  const cards: NavPageCard[] = [{ key: 'home', label: 'Home', page: home }]
  for (const n of flatten(items)) {
    if (!n.is_active || n.no_page || n.link_type === 'external') continue
    const slug = n.url?.match(/^\/p\/([^/?#]+)/)?.[1]
    const page = (n.page_id && byId.get(n.page_id)) || (slug ? bySlug.get(slug) : undefined) || null
    if (page && page.id === home?.id) continue
    cards.push({ key: n.id, label: n.label, page })
  }
  return cards
}

export function NavPagesGrid({ projectId, homeId }: { projectId: string; homeId?: string }) {
  const { data: menu } = useQuery({
    queryKey: ['menu', projectId, 'header'],
    queryFn: () =>
      api
        .post('/menus/ensure', { project_id: projectId, key: 'header', name: 'Header menu' })
        .then((r) => r.data.data.menu as { items: MenuItemNode[] }),
  })
  const { data: pages } = useQuery({
    queryKey: ['pages-for-menu', projectId],
    queryFn: () => listPages(),
  })
  if (!menu || !pages) return null
  const cards = resolveNavPages(menu.items, pages, homeId)
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="nav-pages-grid"
    >
      {cards.map((c) => (
        <div key={c.key} className="overflow-hidden rounded-lg border bg-card">
          <div className="h-1.5 bg-gradient-to-r from-primary to-secondary" />
          <div className="flex min-h-[110px] flex-col gap-2 p-4">
            <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {c.page ? 'Page' : 'No page yet'}
            </span>
            <b className="text-sm">{c.label}</b>
            {c.page ? (
              <Button size="sm" asChild className="mt-auto w-fit">
                <a
                  href={`/admin/template-engine/edit/${c.page.id}?projectId=${projectId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </a>
              </Button>
            ) : (
              <p className="mt-auto text-xs text-muted-foreground">
                Press Next on Navigation to build it.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
