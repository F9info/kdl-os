'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Puck, blocksPlugin, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import '../../../page-builder/puck-overrides.css'
import { ArrowLeft } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { toast } from '@/hooks/use-toast'
import { BlocksPanel } from '../../../page-builder/blocks-panel'
import { InsertBlockButton } from '../../../page-builder/insert-block-modal'
import { config } from '../../../page-builder/puck.config'
import { getPage, savePage } from '../../../page-builder/store'

/**
 * "Edit" destination for a template-engine seeded page — reuses Puck's own
 * editor (drag/drop add, reorder, prop editing) rather than a bespoke UI,
 * hosted under template-engine so it doesn't depend on /admin/page-builder's
 * admin UI (slated for removal). Reached via
 * /admin/template-engine/edit/<pageId>?projectId=<projectId>.
 *
 * The back link is wired through Puck's own in-flow header (overrides.
 * headerActions) rather than a `position: fixed` button — /admin's shared
 * AdminShell layout can turn `fixed` into effectively-`absolute`, scrolling
 * a fixed button out of view (see the site-preview page's back-button fix).
 */
export default function TemplateEngineEditPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const backHref = projectId
    ? `/admin/template-engine/projects/${projectId}/website`
    : '/admin/template-engine'
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
      void qc.invalidateQueries({ queryKey: ['page-builder-page', params.id] })
      toast({ title: 'Saved', description: 'Page saved and published.' })
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
        <Link href={backHref} className="mt-3 inline-block text-primary underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <ModuleGuard slug="template-engine">
      <div className="te-fields-left fixed inset-0 z-[100] [&_[class*=PuckLayout-nav]]:hidden">
        {/* No Outline panel — it only duplicated the Section tab's own
            Reorder list. Puck hardwires Fields to grid-area "right" with no
            public prop to move it — pin the "left" area (Outline's slot,
            now empty since overrides.outline renders null) to 0 width so
            Fields is the only real column, instead of leaving a dead
            190px gap where Outline used to sit. */}
        <style>{`
          .te-fields-left [class*="PuckLayout-inner_"] {
            --puck-pluginbar-width: 0px !important;
          }
          .te-fields-left [class*="SidebarSection-heading_"] [class*="Heading_"] {
            font-size: 13px !important;
          }
          @media (min-width: 638px) {
            .te-fields-left [class*="PuckLayout-inner_"] {
              grid-template-areas: "header header header header" "sidenav right editor left" !important;
              grid-template-columns: var(--puck-pluginbar-width) var(--puck-sidebar-right-width) var(--puck-frame-width) 0 !important;
            }
          }
        `}</style>
        <Puck
          config={config}
          data={page.data}
          plugins={[blocksPlugin()]}
          iframe={{ enabled: false }}
          viewports={[
            { width: 390, label: 'Mobile' },
            { width: 768, label: 'Tablet' },
            { width: 1280, label: 'Desktop' },
          ]}
          headerTitle={page.title}
          headerPath={`/p/${page.slug}`}
          onPublish={(data: Data) => saveMutation.mutate(data)}
          overrides={{
            outline: () => <></>,
            headerActions: ({ children }) => (
              <>
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  <ArrowLeft size={15} /> Back
                </Link>
                <InsertBlockButton projectId={projectId ?? undefined} />
                {children}
              </>
            ),
            fields: ({ children, itemSelector }) => (
              <BlocksPanel itemSelector={itemSelector} projectId={projectId ?? undefined}>
                {children}
              </BlocksPanel>
            ),
          }}
        />
      </div>
    </ModuleGuard>
  )
}
