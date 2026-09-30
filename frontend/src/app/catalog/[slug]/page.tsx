'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { config } from '@/app/admin/page-builder/puck.config'
import api from '@/lib/axios'
import { siteProjectId } from '@/lib/site-project'

interface PublicCatalogItem {
  id: string
  project_id: string | null
  name: string
  description: string | null
  image: string | null
}

/**
 * One reusable route for every catalog item's detail page — `/catalog/{slug}`
 * resolves the CatalogItem by slug, then renders its auto-created,
 * admin-editable detail page. Same premise as `/sectors/[slug]`.
 */
export default function CatalogDetailPage() {
  const params = useParams<{ slug: string }>()
  const projectId = siteProjectId(useSearchParams().get('projectId'))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-catalog-item', params.slug, projectId],
    queryFn: () =>
      api
        .get(`/catalog/public/${params.slug}`, { params: { project_id: projectId ?? undefined } })
        .then(
          (r) =>
            r.data.data as {
              item: PublicCatalogItem
              page: { data: unknown; title: string } | null
            }
        ),
    retry: false,
  })

  const item = data?.item
  const page = data?.page

  useEffect(() => {
    if (!item) return
    document.title = item.name
  }, [item])

  if (isLoading) return <div className="min-h-screen" />

  if (isError || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>404 — no catalog item at /catalog/{params.slug}</p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="rounded-2xl w-full h-72 object-cover mb-8"
          />
        )}
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{item.name}</h1>
        <p className="text-slate-600 leading-relaxed mb-4">{item.description}</p>
      </div>
    )
  }

  return (
    <div className="detail-page-inter">
      <Render
        config={config}
        data={page.data as never}
        metadata={{ pageTitle: item.name, projectId: item.project_id ?? undefined }}
      />
    </div>
  )
}
