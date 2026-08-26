'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { Puck, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { config } from '../puck.config'
import { getPage, savePage, type PageRecord } from '../store'

/**
 * "View all pages" destination — a real, working multi-page EDITOR for a set
 * of page-builder pages (e.g. a template-engine run's assembled pages),
 * reached via /admin/page-builder/site?ids=<id1>,<id2>,... .
 *
 * A tab strip switches which page is loaded into the real Puck editor.
 * Unsaved edits are kept per-page in `drafts` so switching tabs doesn't lose
 * work. "Save and Next" (injected into Puck's own header, alongside its
 * stock Publish button) saves the active page then advances to the next tab.
 */
export default function SitePreview() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const qc = useQueryClient()

  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['page-builder-page', id], queryFn: () => getPage(id) })),
  })
  const pages = results.map((r) => r.data).filter((p): p is PageRecord => !!p)
  const isLoading = results.some((r) => r.isLoading)

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p.id === (activeId ?? pages[0]?.id))
  )
  const active = pages[activeIndex]

  // Live edits per page, keyed by id — Puck's onChange fires on every edit;
  // keeping a draft per page means switching tabs doesn't lose unsaved work.
  const [drafts, setDrafts] = useState<Record<string, Data>>({})
  const [isSaving, setIsSaving] = useState(false)
  const isLast = activeIndex >= pages.length - 1

  async function saveAndAdvance() {
    if (!active) return
    const data = drafts[active.id] ?? active.data
    setIsSaving(true)
    try {
      await savePage(active.id, data)
      await qc.invalidateQueries({ queryKey: ['page-builder-page', active.id] })
      toast({ title: 'Saved', description: `${active.title} saved.` })
      const next = pages[activeIndex + 1]
      if (next) setActiveId(next.id)
    } catch {
      toast({
        title: 'Save failed',
        description: 'Could not save the page.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ModuleGuard slug="page-builder">
      <div className="flex h-screen flex-col">
        <div className="flex items-center gap-1 border-b bg-white px-3 py-2">
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
                active?.id === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-muted-foreground">Loading…</div>
          ) : !active ? (
            <div className="p-8 text-muted-foreground">No pages to edit.</div>
          ) : (
            <Puck
              key={active.id}
              config={config}
              data={drafts[active.id] ?? active.data}
              iframe={{ enabled: false }}
              onChange={(data) => setDrafts((prev) => ({ ...prev, [active.id]: data }))}
              headerTitle={active.title}
              headerPath={`/p/${active.slug}`}
              overrides={{
                headerActions: ({ children }) => (
                  <>
                    {!isLast && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={saveAndAdvance}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving…' : 'Save and Next'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {children}
                  </>
                ),
              }}
            />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
