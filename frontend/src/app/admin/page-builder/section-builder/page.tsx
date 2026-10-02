'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PanelTop,
  LayoutTemplate,
  GalleryHorizontal,
  Sparkles,
  BarChart3,
  UserCircle,
  Video,
  Newspaper,
  Users,
  Briefcase,
  HelpCircle,
  MessageSquareQuote,
  ClipboardList,
  Megaphone,
  PanelBottom,
  Share2,
} from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ComposerCanvas } from '../packs/composer/ComposerCanvas'
import { ComposerProjectContext } from '../packs/composer/atoms'
import { renderComposedBlock } from '../packs/composer/render-composed-block'
import {
  deleteCustomBlock,
  duplicateCustomBlock,
  getDefaultProjectId,
  listCustomBlocks,
  setDefaultCustomBlock,
} from '../packs/composer/custom-blocks-store'

/** The 16-category taxonomy from templateEnginesections.html — same names as
 *  the in-editor "Insert a block" section picker (puck.config.tsx /
 *  blocks-panel.tsx), reused here as a landing picker since this route has
 *  no live Puck instance to derive categories from. */
const SECTION_CATEGORIES = [
  { key: 'top-bar', label: 'Top Header', icon: PanelTop },
  { key: 'header', label: 'Header', icon: LayoutTemplate },
  { key: 'hero-slider', label: 'Hero Slider', icon: GalleryHorizontal },
  { key: 'welcome', label: 'Welcome', icon: Sparkles },
  { key: 'counters', label: 'Counters', icon: BarChart3 },
  { key: 'founder', label: 'Founder', icon: UserCircle },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'blog-posts', label: 'Blog Posts', icon: Newspaper },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'services', label: 'Services', icon: Briefcase },
  { key: 'faq', label: 'FAQ', icon: HelpCircle },
  { key: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { key: 'forms', label: 'Forms', icon: ClipboardList },
  { key: 'cta', label: 'Call to Action', icon: Megaphone },
  { key: 'footer', label: 'Footer', icon: PanelBottom },
  { key: 'social-media', label: 'Social Media', icon: Share2 },
] as const

/**
 * Section Builder — a real, full-page screen for building a brand-new custom
 * section from atomic elements (heading, paragraph, button, image, layout,
 * testimonial, ...), reached via any "Insert a block" flow's "Create new"
 * card, or directly from the admin sidebar. Not a modal: it has its own URL,
 * survives a refresh, and the browser back button returns to wherever it was
 * opened from (`returnTo`).
 *
 * `category` pins which block category the finished section will be filed
 * under (so it shows up back in that category's Insert-a-block picker). When
 * it's absent — the sidebar link and the bare URL both omit it — this shows
 * a category picker first instead of guessing 'content'; picking a card
 * re-navigates to this same route with `?category=<key>` set.
 * `projectId` carries the single-project scoping key transparently — the
 * operator never sees or picks it (see KDL "no projects concept" removal);
 * falls back to the one default project when the caller has none in scope.
 */
export default function SectionBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  // Open-redirect guard: `returnTo` is caller-controlled (query param) and
  // fed straight to router.push — must be a same-origin admin path, never
  // an absolute/protocol-relative URL (`//evil.com`, `https://evil.com`)
  // that a crafted link could use to bounce an admin off-site on close/save.
  const rawReturnTo = searchParams.get('returnTo') ?? ''
  const hasReturnTo = rawReturnTo.startsWith('/admin/') && !rawReturnTo.startsWith('//')
  const blockId = searchParams.get('blockId')
  const isNew = searchParams.get('new') === '1'
  // Arriving from the category picker (no returnTo / new / blockId) shows the
  // saved-block list for that category; any explicit flow opens the canvas.
  const showList = !hasReturnTo && !blockId && !isNew
  const listHref = `/admin/page-builder/section-builder?category=${category ?? ''}`
  const returnTo = hasReturnTo ? rawReturnTo : showList ? listHref : '/admin/template-engine'
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '')

  useEffect(() => {
    if (!category || projectId) return
    getDefaultProjectId().then(setProjectId)
  }, [category, projectId])

  if (!category) {
    return (
      <ModuleGuard slug="page-builder">
        <div className="mx-auto max-w-5xl p-8">
          <h1 className="mb-1 text-xl font-bold">Section Builder</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Pick what kind of section you want to build.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {SECTION_CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => router.push(`/admin/page-builder/section-builder?category=${key}`)}
                className="flex flex-col items-center gap-2.5 rounded-lg border border-border bg-card py-6 text-card-foreground transition hover:border-primary hover:text-primary"
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </ModuleGuard>
    )
  }

  if (showList) {
    return (
      <ModuleGuard slug="page-builder">
        <BlockList category={category} projectId={projectId} />
      </ModuleGuard>
    )
  }

  return (
    <ModuleGuard slug="page-builder">
      <CanvasHost
        projectId={projectId}
        category={category}
        blockId={blockId}
        returnTo={returnTo}
        onDone={() => router.push(returnTo)}
      />
    </ModuleGuard>
  )
}

function CanvasHost({
  projectId,
  category,
  blockId,
  returnTo,
  onDone,
}: {
  projectId: string
  category: string
  blockId: string | null
  returnTo: string
  onDone: () => void
}) {
  void returnTo
  const { data: blocks, isLoading } = useQuery({
    queryKey: ['custom-blocks', projectId, category],
    queryFn: () => listCustomBlocks(projectId, category),
    enabled: Boolean(projectId && blockId),
  })
  const editing = blockId ? blocks?.find((b) => b.id === blockId) : undefined
  return (
    <>
      {/* z-[2100] matches BlockComposer.tsx's own full-screen composer overlay —
          anything lower (e.g. the shared Dialog's z-50) renders behind this
          page and is invisible even though it's mounted, like the MediaPicker
          opened from the Image URL field's Upload button. */}
      <div className="fixed inset-0 z-[2100]">
        {projectId && !(blockId && isLoading) ? (
          <ComposerCanvas
            key={editing?.id ?? 'new'}
            projectId={projectId}
            categoryKey={category}
            editing={editing}
            onClose={onDone}
            onSaved={onDone}
          />
        ) : (
          <LoadingSpinner fullPage />
        )}
      </div>
    </>
  )
}

/** Saved blocks for one category (stored in the DB) with edit / duplicate /
 *  set-default / delete — the same records the website Layout step offers. */
function BlockList({ category, projectId }: { category: string; projectId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const label = SECTION_CATEGORIES.find((c) => c.key === category)?.label ?? category
  const { data: blocks, isLoading } = useQuery({
    queryKey: ['custom-blocks', projectId, category],
    queryFn: () => listCustomBlocks(projectId, category),
    enabled: Boolean(projectId),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['custom-blocks', projectId, category] })
  const base = `/admin/page-builder/section-builder?category=${category}&projectId=${projectId}`

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/page-builder/section-builder')}
          >
            ← All categories
          </Button>
          <h1 className="text-xl font-bold">{label} sections</h1>
        </div>
        <Button onClick={() => router.push(`${base}&new=1`)}>Create new</Button>
      </div>
      {!projectId || isLoading ? (
        <LoadingSpinner />
      ) : !blocks || blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved {label.toLowerCase()} sections yet — click “Create new”.
        </p>
      ) : (
        <div className="space-y-4">
          {blocks.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="pointer-events-none overflow-hidden bg-white" style={{ zoom: 0.6 }}>
                <ComposerProjectContext.Provider value={projectId}>
                  {renderComposedBlock(b.config)}
                </ComposerProjectContext.Provider>
              </div>
              <div className="flex items-center justify-between gap-2 border-t p-2">
                <span className="text-sm font-medium">
                  {b.name}
                  {b.isDefault ? ' · default' : ''}
                  {b.status === 'DRAFT' ? ' · draft' : ''}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`${base}&blockId=${b.id}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await duplicateCustomBlock(b.id, projectId)
                      refresh()
                    }}
                  >
                    Duplicate
                  </Button>
                  {!b.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await setDefaultCustomBlock(b.id, projectId)
                        refresh()
                      }}
                    >
                      Set default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${b.name}"?`)) return
                      await deleteCustomBlock(b.id, projectId)
                      refresh()
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
