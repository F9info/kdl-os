'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { ArrowLeft } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { useBrandKit } from '@/hooks/useTemplateEngine'
import { loadGoogleFont } from '@/lib/load-google-font'
import { config } from '../../page-builder/puck.config'
import { getPage, type PageRecord } from '../../page-builder/store'

/**
 * "View all pages" destination for the template-engine Website stage —
 * matches the design prototype's (templateEngine2.html) buildSiteDoc flow:
 * the real assembled site, one page visible at a time, switched by clicking
 * the seeded nav bar's own links (Home/About/Contact) rather than any admin
 * tab strip. Reached via /admin/template-engine/site?ids=<id1>,<id2>,... .
 *
 * Deliberately independent of /admin/page-builder's admin UI (slated for
 * removal) — only the page-builder backend/data layer (store.ts, puck.config's
 * Render) is reused, the same way the public /p/[slug] renderer does. No
 * Puck editor, no save button, no drafts — pure read-only preview.
 */
export default function TemplateEngineSitePreview() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const projectId = searchParams.get('projectId')

  // Brand kit typography (family names only — the per-element Font settings
  // type-scale table is session-local UI state, never persisted, so there's
  // nothing beyond family to apply here) applied as the page's base font.
  const { data: brandKit } = useBrandKit(projectId)
  const bodyFont = brandKit?.typography?.body?.family
  // Interpolated into a raw <style> tag below (React doesn't sanitize style
  // text children) — restrict to a safe font-name charset first.
  const SAFE_FONT_NAME = /^[A-Za-z0-9 _-]{1,64}$/
  const rawHeadingFont = brandKit?.typography?.heading?.family
  const headingFont = rawHeadingFont && SAFE_FONT_NAME.test(rawHeadingFont) ? rawHeadingFont : null
  useEffect(() => {
    if (bodyFont) loadGoogleFont(bodyFont)
    if (headingFont) loadGoogleFont(headingFont)
  }, [bodyFont, headingFont])

  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['page-builder-page', id], queryFn: () => getPage(id) })),
  })
  const pages = results.map((r) => r.data).filter((p): p is PageRecord => !!p)
  const isLoading = results.some((r) => r.isLoading)

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = pages.find((p) => p.id === activeId) ?? pages[0]
  const containerRef = useRef<HTMLDivElement>(null)

  // The seeded NavBar/Footer render plain text links (e.g. "About", "Contact")
  // with no page-id wiring — same situation the html prototype solved by
  // matching link text against page names. Delegate clicks on the rendered
  // page and jump to whichever page's title matches the clicked text.
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest('a,button,span')
    const text = el?.textContent?.trim().toLowerCase()
    if (!text) return
    const match = pages.find((p) => p.title.trim().toLowerCase() === text)
    if (match && match.id !== active?.id) {
      e.preventDefault()
      setActiveId(match.id)
      containerRef.current?.scrollTo({ top: 0 })
    }
  }

  return (
    <ModuleGuard slug="template-engine">
      {/* flex-column + its own scrollable body, same layout the page-builder
          site preview used — a `position: fixed` back button previously sat
          here instead, but /admin's shared AdminShell wraps this route and
          can turn `fixed` into effectively-`absolute` (any transformed
          ancestor does that), scrolling the back link away with the page.
          An in-flow header row can't be scrolled out of view like that. */}
      <div className="flex h-screen flex-col">
        <div className="flex items-center gap-1 border-b bg-white px-3 py-2">
          <Link
            href={
              projectId
                ? `/admin/template-engine/projects/${projectId}/website`
                : '/admin/template-engine'
            }
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
        <div
          className="gg-site flex-1 overflow-auto"
          ref={containerRef}
          onClick={handleClick}
          style={bodyFont ? { fontFamily: `'${bodyFont}', Inter, sans-serif` } : undefined}
        >
          {headingFont && (
            <style>{`.gg-site h1,.gg-site h2,.gg-site h3,.gg-site h4,.gg-site h5,.gg-site h6{font-family:'${headingFont}',Inter,sans-serif;}`}</style>
          )}
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
