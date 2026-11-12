'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Puck, blocksPlugin, type Data, type ComponentData } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import '../../../page-builder/puck-overrides.css'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { toast } from '@/hooks/use-toast'
import { BlocksPanel } from '../../../page-builder/blocks-panel'
import { config } from '../../../../../frontend/blocks/puck.config'
import {
  autosavePage,
  checkPage,
  getPage,
  issuesFromPublishError,
  publishPage,
  type PageIssue,
} from '../../../page-builder/store'
import { PublishChecksDialog } from '../../../page-builder/PublishChecks'
import { PublishStatus } from '../../../page-builder/PublishControls'
import { PreviewLinkButton } from '../../../page-builder/PreviewLink'
import { useLayoutChrome } from '@/admin/hooks/useLayoutChrome'
import { useAutosave, type AutosaveStatus } from '@/admin/hooks/useAutosave'

// Top Header/Header/Footer are layout-managed — every page gets the same
// one, picked once on the Layout page (website/layout), not per page here.
// Editing/removing them from an individual page's canvas would silently
// drift that one page away from the shared layout, defeating the point of
// having a single layout choice. So this editor never shows them: they're
// stripped out of the content it hands to Puck, the categories that would
// let someone manually add a duplicate are hidden from "Add a section",
// and on save they're spliced back in unchanged around whatever Puck
// actually edited.
const LAYOUT_START_BLOCK_TYPES = new Set([
  'ConstructionTopBar',
  'ConstructionHeader',
  'NavBar',
  'MedicalTopNav',
])
const LAYOUT_END_BLOCK_TYPES = new Set(['ConstructionFooter', 'Footer'])
const LAYOUT_MANAGED_CATEGORY_KEYS = ['top-bar', 'header', 'bottombar']

function splitLayoutBlocks(content: ComponentData[]) {
  const startBlocks = content.filter((b) => LAYOUT_START_BLOCK_TYPES.has(b.type))
  const endBlocks = content.filter((b) => LAYOUT_END_BLOCK_TYPES.has(b.type))
  const editableContent = content.filter(
    (b) => !LAYOUT_START_BLOCK_TYPES.has(b.type) && !LAYOUT_END_BLOCK_TYPES.has(b.type)
  )
  return { startBlocks, endBlocks, editableContent }
}

// Hides the "Top Header"/"Header"/"Footer" categories from this editor's
// "Add a section" panel and Insert-block modal — both read `config` via
// Puck's own usePuck(), so a locally-derived config (not the shared
// module-level one other surfaces still import unfiltered) is enough to
// keep this scoped to the template-engine edit page.
const editorConfig = {
  ...config,
  categories: Object.fromEntries(
    Object.entries(config.categories ?? {}).filter(
      ([key]) => !LAYOUT_MANAGED_CATEGORY_KEYS.includes(key)
    )
  ),
}

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
  const router = useRouter()
  // Opened from the Landing Pages screen: after Save, go back there (finished pages, Preview and Convert).
  const fromLanding = searchParams.get('from') === 'landing'
  // From the Landing Pages screen, Back returns there.
  const backHref = fromLanding
    ? '/admin/landing-pages'
    : projectId
      ? `/admin/template-engine/projects/${projectId}/website`
      : '/admin/template-engine'
  const qc = useQueryClient()
  const { topHeaderNode, headerNode, footerNode } = useLayoutChrome(projectId)
  // True once an edit was autosaved as a draft since the page was loaded or last published.
  const [editedSincePublish, setEditedSincePublish] = useState(false)

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['page-builder-page', params.id],
    queryFn: () => getPage(params.id),
  })

  // Publish flow: check first; if the page has problems or suggestions the author reviews them
  // (PublishChecksDialog) before anything goes live. The server enforces the errors too.
  const [pending, setPending] = useState<{ data: Data; issues: PageIssue[] } | null>(null)
  const saveMutation = useMutation({
    mutationFn: ({ data, force }: { data: Data; force: boolean }) =>
      publishPage(params.id, data, force),
    onSuccess: () => {
      setEditedSincePublish(false)
      setPending(null)
      void qc.invalidateQueries({ queryKey: ['page-builder-page', params.id] })
      toast({ title: 'Saved', description: 'Your changes are live.' })
      if (fromLanding) {
        void qc.invalidateQueries({ queryKey: ['landing-sites'] }) // the list must show this page as saved
        router.push('/admin/landing-pages?finished=1')
      }
    },
    onError: (err, vars) => {
      // The server's own check caught something the editor's check did not see (e.g. a page was
      // deleted meanwhile): show it the same way.
      const issues = issuesFromPublishError(err)
      if (issues) return setPending({ data: vars.data, issues })
      toast({
        title: 'Save failed',
        description: 'Could not save the page.',
        variant: 'destructive',
      })
    },
  })
  const checkMutation = useMutation({
    mutationFn: (data: Data) => checkPage(params.id, data).then((checks) => ({ data, checks })),
    onSuccess: ({ data, checks }) => {
      // The SEO button is not in this editor, so SEO suggestions could not be acted on: leave them out.
      const issues = checks.issues.filter((i) => !i.code.startsWith('SEO_'))
      if (issues.length > 0) setPending({ data, issues })
      else saveMutation.mutate({ data, force: false })
    },
    // A failed check must never block publishing: the server still enforces the errors.
    onError: (_err, data) => saveMutation.mutate({ data, force: false }),
  })

  // Split out once per page load — `onPublish` below closes over this to
  // splice the layout-managed blocks back in around whatever Puck actually
  // edited, since Puck itself never saw them.
  const layoutSplit = useMemo(
    () => splitLayoutBlocks(page?.data.content ?? []),
    [page?.data.content]
  )

  // Puck only ever sees the editable middle; every save splices the
  // layout-managed blocks back around it (manual Save and autosave alike).
  const buildFinal = useCallback(
    (data: Data): Data => ({
      ...data,
      content: [...layoutSplit.startBlocks, ...data.content, ...layoutSplit.endBlocks],
    }),
    [layoutSplit]
  )
  const baseline = useMemo(
    () => (page ? buildFinal({ ...page.data, content: layoutSplit.editableContent }) : null),
    [page, layoutSplit, buildFinal]
  )
  const autosave = useAutosave<Data>((data) => autosavePage(params.id, data), baseline)
  const { schedule: scheduleAutosave } = autosave
  useEffect(() => {
    if (autosave.status === 'saving' || autosave.status === 'error') setEditedSincePublish(true)
  }, [autosave.status])
  const handleChange = useCallback(
    (data: Data) => scheduleAutosave(buildFinal(data)),
    [scheduleAutosave, buildFinal]
  )

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

  const editableData: Data = { ...page.data, content: layoutSplit.editableContent }

  function handlePublish(data: Data) {
    const final = buildFinal(data)
    autosave.markSaved(final) // supersedes any pending autosave
    // Autosave of the same content may still be in flight: the check reads the saved draft, so
    // send the content with the publish and check what the server will actually publish.
    checkMutation.mutate(final)
  }

  return (
    <ModuleGuard slug="page-builder">
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
          /* Puck's no-iframe canvas root (@puckeditor/core Canvas/index.tsx)
             inline-styles itself \`position: absolute; top: 0; bottom: 0;
             height: zoomConfig.rootHeight; overflow: auto\` — rootHeight
             comes from measuring the WRAPPER's own contentBox once (never
             recomputed off content height), so it freezes at roughly the
             visible pane's height, not the page's real height.
             Overriding position/top/bottom/height/overflow (all four —
             inline height+overflow beat a plain class, \`height: auto\`
             alone isn't enough either) still wasn't sufficient: root's
             PARENT (\`.PuckCanvas-inner\`) is \`display: flex\` with the
             default row direction, so \`align-items: stretch\` (the flex
             default) forces root to the parent's cross-axis height
             regardless of root's own \`height\` value — a separate sizing
             mechanism \`height: auto\` doesn't opt out of on its own.
             Net effect: root stayed pinned to the pane's height no matter
             what, so the real footer (appended after \`{children}\` in
             \`overrides.preview\` below) rendered inside that cramped box
             right under whatever little content fit, instead of after the
             full page (reported: footer showing directly under the hero
             slider — and later, mid-scroll, appearing to repeat before
             more sections — instead of after the FAQ section at the true
             end of the page). \`align-self: flex-start\` opts root out of
             the stretch so height:auto can finally take effect, sizing
             root to its real children with the already-scrollable
             \`PuckCanvas\` ancestor doing the one real scroll. */
          .te-fields-left [class*="PuckCanvas-root_"] {
            position: static !important;
            top: auto !important;
            bottom: auto !important;
            height: auto !important;
            overflow: visible !important;
            align-self: flex-start !important;
          }
        `}</style>
        <Puck
          config={editorConfig}
          data={editableData}
          metadata={{ pageTitle: page.title, projectId: projectId ?? undefined }}
          plugins={[blocksPlugin()]}
          iframe={{ enabled: false }}
          viewports={[
            { width: 390, label: 'Mobile' },
            { width: 768, label: 'Tablet' },
            { width: 1280, label: 'Desktop' },
          ]}
          headerTitle={page.title}
          headerPath={`/p/${page.slug}`}
          onChange={handleChange}
          onPublish={handlePublish}
          // Edits autosave as a draft; this "Save" button makes them live as a new version.
          dictionary={{ 'header-publish': 'Save' }}
          overrides={{
            outline: () => <></>,
            // The canvas area (root render + all DropZone content) — wraps
            // it with the project's actual Top Header/Header/Footer as
            // plain, `pointer-events-none` React nodes (not Puck blocks),
            // so they show exactly what the real page will look like
            // without being draggable/selectable/deletable from here.
            preview: ({ children }) => (
              <>
                {topHeaderNode && (
                  <div className="pointer-events-none relative select-none">{topHeaderNode}</div>
                )}
                {headerNode && (
                  <div className="pointer-events-none relative select-none">{headerNode}</div>
                )}
                {children}
                {footerNode && (
                  <div className="pointer-events-none relative select-none">{footerNode}</div>
                )}
              </>
            ),
            headerActions: ({ children }) => (
              <>
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  <ArrowLeft size={15} /> Back
                </Link>
                <PublishStatus
                  page={{
                    ...page,
                    hasUnpublishedChanges: page.hasUnpublishedChanges || editedSincePublish,
                  }}
                />
                <PreviewLinkButton pageId={params.id} direct={fromLanding} />
                <AutosaveBadge status={autosave.status} />
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
        {pending && (
          <PublishChecksDialog
            issues={pending.issues}
            busy={saveMutation.isPending}
            onBack={() => setPending(null)}
            onPublish={(anyway) => saveMutation.mutate({ data: pending.data, force: anyway })}
          />
        )}
      </div>
    </ModuleGuard>
  )
}

function AutosaveBadge({ status }: { status: AutosaveStatus }) {
  if (status === 'idle') return null
  return (
    <span role="status" className="flex items-center gap-1 text-xs">
      {status === 'saving' && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </span>
      )}
      {status === 'saved' && <span className="font-medium text-emerald-600">✓ Saved</span>}
      {status === 'error' && (
        <span className="font-medium text-destructive">
          ⚠ Autosave failed — will retry on next edit
        </span>
      )}
    </span>
  )
}
