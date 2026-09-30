'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { config } from '@/app/admin/page-builder/puck.config'
import api from '@/lib/axios'
import { siteProjectId } from '@/lib/site-project'

interface PublicWork {
  id: string
  project_id: string | null
  name: string
  subtitle: string | null
  image: string | null
}

/**
 * One reusable route for every "Our Work" category's detail page —
 * `/work/{slug}` — same premise as `/sectors/[slug]`, just keyed by
 * WorkCategory.slug instead of Sector.slug.
 */
export default function WorkDetailPage() {
  const params = useParams<{ slug: string }>()
  const projectId = siteProjectId(useSearchParams().get('projectId'))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-work', params.slug, projectId],
    queryFn: () =>
      api
        .get(`/work/public/${params.slug}`, { params: { project_id: projectId ?? undefined } })
        .then(
          (r) => r.data.data as { item: PublicWork; page: { data: unknown; title: string } | null }
        ),
    retry: false,
  })

  const work = data?.item
  const page = data?.page

  useEffect(() => {
    if (!work) return
    document.title = work.name
  }, [work])

  if (isLoading) return <div className="min-h-screen" />

  if (isError || !work) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>404 — no work category at /work/{params.slug}</p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
        {work.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.image}
            alt={work.name}
            className="rounded-2xl w-full h-72 object-cover mb-8"
          />
        )}
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{work.name}</h1>
        <p className="text-slate-600 leading-relaxed mb-4">{work.subtitle}</p>
      </div>
    )
  }

  return (
    <div className="detail-page-inter">
      <Render
        config={config}
        data={page.data as never}
        metadata={{ pageTitle: work.name, projectId: work.project_id ?? undefined }}
      />
    </div>
  )
}
