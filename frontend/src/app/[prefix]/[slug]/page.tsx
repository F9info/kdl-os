'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { config } from '@/app/admin/page-builder/puck.config'
import api from '@/lib/axios'
import { siteProjectId } from '@/lib/site-project'

interface PublicEntry {
  id: string
  title: string
  description: string | null
  image: string | null
}

/**
 * One generic route for every admin-created Details Page type (Blog, Service, ...):
 * `/{slug_prefix}/{slug}`. Static routes (/work, /sectors, /catalog, /admin, ...) win
 * over this dynamic one, so it only serves prefixes defined in `detail_page_types`.
 */
export default function DetailEntryPage() {
  const params = useParams<{ prefix: string; slug: string }>()
  const projectId = siteProjectId(useSearchParams().get('projectId'))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-detail-entry', params.prefix, params.slug, projectId],
    queryFn: () =>
      api
        .get(`/detail-page-types/public/${params.prefix}/${params.slug}`, {
          params: { project_id: projectId ?? undefined },
        })
        .then((r) => r.data.data as { entry: PublicEntry; page: { data: unknown } | null }),
    retry: false,
  })

  const entry = data?.entry
  useEffect(() => {
    if (entry) document.title = entry.title
  }, [entry])

  if (isLoading) return <div className="min-h-screen" />
  if (isError || !entry) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <p>
          404 — nothing at /{params.prefix}/{params.slug}
        </p>
      </div>
    )
  }
  if (!data?.page) {
    return (
      <div className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-title mb-4">{entry.title}</h1>
        <p className="text-body leading-relaxed">{entry.description}</p>
      </div>
    )
  }
  return (
    <div className="detail-page-inter">
      <Render
        config={config}
        data={data.page.data as never}
        metadata={{ pageTitle: entry.title, projectId: projectId ?? undefined }}
      />
    </div>
  )
}
