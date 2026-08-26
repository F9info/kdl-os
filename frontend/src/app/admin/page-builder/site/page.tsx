'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { ArrowLeft } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { cn } from '@/lib/utils'
import { config } from '../puck.config'
import { getPage } from '../store'

/**
 * "View all pages" — a real, working multi-page site preview for a set of
 * page-builder pages (e.g. a template-engine run's assembled pages), reached
 * via /admin/page-builder/site?ids=<id1>,<id2>,... .
 *
 * Reads through the admin (authenticated) page API rather than the public
 * /p/[slug] route, since these pages are typically still DRAFT — "Direct
 * editing is disabled while Studio is active" means preview, not publish.
 */
export default function SitePreview() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)

  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['page-builder-page', id], queryFn: () => getPage(id) })),
  })
  const pages = results.map((r) => r.data).filter((p) => !!p)
  const isLoading = results.some((r) => r.isLoading)

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = pages.find((p) => p.id === activeId) ?? pages[0]

  return (
    <ModuleGuard slug="page-builder">
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-10 flex items-center gap-1 border-b bg-white px-3 py-2">
          <Link
            href="/admin/page-builder"
            className="mr-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Pages
          </Link>
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                (active?.id ?? pages[0]?.id) === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {p.title}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-muted-foreground">Loading…</div>
        ) : !active ? (
          <div className="p-8 text-muted-foreground">No pages to preview.</div>
        ) : (
          <Render config={config} data={active.data} />
        )}
      </div>
    </ModuleGuard>
  )
}
