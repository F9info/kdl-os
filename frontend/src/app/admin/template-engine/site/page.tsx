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
import { config } from '../../page-builder/puck.config'
import { getPage, type PageRecord } from '../../page-builder/store'

/**
 * "View all pages" destination for the template-engine Website stage — a
 * static, read-only multi-page PREVIEW (no editing), reached via
 * /admin/template-engine/site?ids=<id1>,<id2>,... .
 *
 * Deliberately independent of /admin/page-builder's admin UI (that section
 * is slated for removal) — only the page-builder backend/data layer (store.ts,
 * puck.config's Render) is reused, the same way the public /p/[slug] renderer
 * does. A tab strip switches which seeded page is shown; there is no Puck
 * editor, no save button, no drafts.
 */
export default function TemplateEngineSitePreview() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)

  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['page-builder-page', id], queryFn: () => getPage(id) })),
  })
  const pages = results.map((r) => r.data).filter((p): p is PageRecord => !!p)
  const isLoading = results.some((r) => r.isLoading)

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = pages.find((p) => p.id === activeId) ?? pages[0]

  return (
    <ModuleGuard slug="template-engine">
      <div className="flex h-screen flex-col">
        <div className="flex items-center gap-1 border-b bg-white px-3 py-2">
          <Link
            href="/admin/template-engine"
            className="mr-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Template Engine
          </Link>
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                active?.id === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-muted-foreground">Loading…</div>
          ) : !active ? (
            <div className="p-8 text-muted-foreground">No pages to preview.</div>
          ) : (
            <Render key={active.id} config={config} data={active.data} />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
