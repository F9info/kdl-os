'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { applyHeaderOverlay } from '@/lib/header-overlay'
import { applyIdentity } from '@/lib/apply-identity'
import { applySiteLayout } from '@/lib/apply-site-layout'
import { useIdentity } from '@/hooks/useIdentity'
import { config } from '@/app/admin/page-builder/puck.config'
import { getPageBySlug } from '@/app/admin/page-builder/store'

/**
 * Public, responsive renderer for a published page.
 *
 * Uses the SAME `config` as the editor so what an admin builds is exactly what
 * a visitor sees. Fetches from the backend's public route (no auth required) —
 * only PUBLISHED pages are returned.
 */
export default function PublicPage() {
  const params = useParams<{ slug: string }>()
  const { identity, isLoading: identityLoading } = useIdentity()

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-page', params.slug],
    queryFn: () => getPageBySlug(params.slug),
    retry: false,
  })

  // Wait for identity too, so the baked brand never flashes before the live one.
  if (isLoading || identityLoading) return <div className="min-h-screen" />

  if (isError || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>404 — no published page at /p/{params.slug}</p>
      </div>
    )
  }

  return (
    <Render
      config={config}
      data={applyHeaderOverlay(applyIdentity(applySiteLayout(page.data, page.layout), identity))}
      metadata={{ pageTitle: page.title, projectId: page.projectId ?? undefined }}
    />
  )
}
