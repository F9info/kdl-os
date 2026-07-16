'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Puck, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { config } from '../puck.config'
import { getPage, savePage, type PageRecord } from '../store'

/**
 * Visual page editor. Renders Puck with:
 *  - the shared responsive block `config`
 *  - built-in viewport switcher (mobile / tablet / desktop) for on-canvas
 *    responsive preview across all devices
 *  - iframe disabled so the host app's Tailwind styles apply inside the canvas
 */
export default function PageBuilderEditor() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [page, setPage] = useState<PageRecord | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const p = getPage(params.id)
    if (p) setPage(p)
    else setNotFound(true)
  }, [params.id])

  if (notFound) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Page not found.</p>
        <button onClick={() => router.push('/admin/page-builder')} className="mt-3 text-blue-600 underline">
          Back to pages
        </button>
      </div>
    )
  }

  if (!page) return <div className="p-8 text-slate-500">Loading editor…</div>

  return (
    <ModuleGuard slug="page-builder">
      <div className="h-[calc(100vh-0px)]">
        <Puck
          config={config}
          data={page.data}
          iframe={{ enabled: false }}
          viewports={[
            { width: 390, label: 'Mobile' },
            { width: 768, label: 'Tablet' },
            { width: 1280, label: 'Desktop' },
          ]}
          headerTitle={page.title}
          headerPath={`/p/${page.slug}`}
          onPublish={(data: Data) => {
            savePage(page.id, data)
            window.open(`/p/${page.slug}`, '_blank')
          }}
          overrides={{
            headerActions: ({ children }) => (
              <>
                <a
                  href={`/p/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink size={15} /> View
                </a>
                {children}
              </>
            ),
          }}
        />
        <button
          onClick={() => router.push('/admin/page-builder')}
          className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg hover:bg-slate-700"
        >
          <ArrowLeft size={15} /> Pages
        </button>
      </div>
    </ModuleGuard>
  )
}
