'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { config } from '@/frontend/blocks/puck.config'
import api from '@/lib/axios'
import { siteProjectId } from '@/lib/site-project'

interface PublicSector {
  id: string
  project_id: string | null
  name: string
  description: string | null
  image: string | null
}

/**
 * One reusable route for every sector's detail page — `/sectors/{slug}`
 * resolves the Sector by slug (optionally scoped by `?projectId=`), then
 * renders whatever Puck content its auto-created, admin-editable detail
 * page holds. Adding a new sector never needs a new route, template, or
 * line of frontend code — same premise as `/p/[slug]`, just keyed by
 * Sector.slug instead of BuilderPage.slug. The <head> (title, description,
 * canonical, Open Graph) is rendered server-side by page.tsx.
 */
export default function SectorDetailClient() {
  const params = useParams<{ slug: string }>()
  const projectId = siteProjectId(useSearchParams().get('projectId'))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-sector', params.slug, projectId],
    queryFn: () =>
      api
        .get(`/sectors/public/${params.slug}`, { params: { project_id: projectId ?? undefined } })
        .then(
          (r) =>
            r.data.data as { sector: PublicSector; page: { data: unknown; title: string } | null }
        ),
    retry: false,
  })

  const sector = data?.sector
  const page = data?.page

  if (isLoading) return <div className="min-h-screen" />

  if (isError || !sector) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <p>404 — no sector at /sectors/{params.slug}</p>
      </div>
    )
  }

  // No linked page yet, or its page is still a draft — fall back to a
  // plain render from the sector's own base fields rather than a blank
  // screen, so a brand-new sector is never a dead link.
  if (!page) {
    return (
      <div className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
        {sector.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sector.image}
            alt={sector.name}
            className="rounded-2xl w-full h-72 object-cover mb-8"
          />
        )}
        <h1 className="text-3xl font-bold text-title mb-4">{sector.name}</h1>
        {(sector.description ?? '')
          .split('\n\n')
          .filter(Boolean)
          .map((p, i) => (
            <p key={i} className="text-body leading-relaxed mb-4">
              {p}
            </p>
          ))}
      </div>
    )
  }

  return (
    <div className="detail-page-inter">
      <Render
        config={config}
        data={page.data as never}
        metadata={{ pageTitle: sector.name, projectId: sector.project_id ?? undefined }}
      />
    </div>
  )
}
