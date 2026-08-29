'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Puck, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { toast } from '@/hooks/use-toast'
import { BlocksPanel } from '../blocks-panel'
import { InsertBlockButton } from '../insert-block-modal'
import { config } from '../puck.config'
import { getPage, savePage } from '../store'

/**
 * Visual page editor. Renders Puck with:
 *  - the shared responsive block `config`
 *  - built-in viewport switcher (mobile / tablet / desktop) for on-canvas
 *    responsive preview across all devices
 *  - iframe disabled so the host app's Tailwind styles apply inside the canvas
 *  - persistence wired to the backend builder_pages table (KDL-448)
 */
export default function PageBuilderEditor() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['page-builder-page', params.id],
    queryFn: () => getPage(params.id),
  })

  const saveMutation = useMutation({
    mutationFn: (data: Data) => savePage(params.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['page-builder-pages'] })
      void qc.invalidateQueries({ queryKey: ['page-builder-page', params.id] })
      toast({ title: 'Published', description: 'Page saved and published.' })
    },
    onError: () =>
      toast({
        title: 'Save failed',
        description: 'Could not save the page.',
        variant: 'destructive',
      }),
  })

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading editor…</div>

  if (isError || !page) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Page not found.</p>
        <button
          onClick={() => router.push('/admin/page-builder')}
          className="mt-3 text-primary underline"
        >
          Back to pages
        </button>
      </div>
    )
  }

  return (
    <ModuleGuard slug="page-builder">
      <div className="h-[calc(100vh-var(--th-layout-header-height))]">
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
            saveMutation.mutate(data)
            window.open(`/p/${page.slug}`, '_blank')
          }}
          overrides={{
            headerActions: ({ children }) => (
              <>
                <a
                  href={`/p/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  <ExternalLink size={15} /> View
                </a>
                <InsertBlockButton />
                {children}
              </>
            ),
            fields: ({ children, itemSelector }) => (
              <BlocksPanel itemSelector={itemSelector}>{children}</BlocksPanel>
            ),
          }}
        />
        <button
          onClick={() => router.push('/admin/page-builder')}
          className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg hover:bg-foreground/80"
        >
          <ArrowLeft size={15} /> Pages
        </button>
      </div>
    </ModuleGuard>
  )
}
