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
      <div className="te-outline-right h-screen [&_[class*=PuckLayout-nav]]:hidden">
        {/* Puck hardwires Outline to grid-area "left" / Fields to "right" — no
            public prop for this. Swap by moving the area tokens to the
            opposite physical column (and the matching width var with them)
            instead of forcing grid-area on the content, so each sidebar's
            resize handle (sibling-selector-bound to the same area name)
            still tracks its panel. Known gap: the desktop "outline only,
            fields hidden" state isn't in puck.css at all (falls back to
            both-hidden) so there's nothing to mirror for it. */}
        <style>{`
          .te-outline-right [class*="PuckLayout-inner_"] {
            --puck-pluginbar-width: 0px !important;
          }
          .te-outline-right [class*="SidebarSection-heading_"] [class*="Heading_"] {
            font-size: 13px !important;
          }
          @media (min-width: 638px) {
            .te-outline-right [class*="PuckLayout-inner_"] {
              grid-template-areas: "header header header header" "sidenav right editor left" !important;
            }
            .te-outline-right [class*="PuckLayout--rightSideBarVisible_"] [class*="PuckLayout-inner_"] {
              grid-template-columns: var(--puck-pluginbar-width) var(--puck-sidebar-right-width) var(--puck-frame-width) 0 !important;
            }
            .te-outline-right [class*="PuckLayout--leftSideBarVisible_"][class*="PuckLayout--rightSideBarVisible_"] [class*="PuckLayout-inner_"] {
              grid-template-columns: var(--puck-pluginbar-width) var(--puck-sidebar-right-width) var(--puck-frame-width) var(--puck-sidebar-left-width) !important;
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
