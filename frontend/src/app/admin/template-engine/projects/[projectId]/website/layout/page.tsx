'use client'

import { useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAdvanceStage, useTemplateEngineRuns } from '@/hooks/useTemplateEngine'
import { useWebsiteBrandContext } from '@/hooks/useWebsiteBrandContext'
import { construction } from '@/app/admin/page-builder/packs/construction'
import { ComposerProjectContext } from '@/app/admin/page-builder/packs/composer/atoms'
import { renderComposedBlock } from '@/app/admin/page-builder/packs/composer/render-composed-block'
import {
  listCustomBlocks,
  type CustomBlockRecord,
} from '@/app/admin/page-builder/packs/composer/custom-blocks-store'
import { cn } from '@/lib/utils'
import {
  footerOverrides,
  headerFooterOverrides,
  mergeLayoutSelection,
  readLocal,
  topHeaderOverrides,
  websiteLayoutStorageKey,
  writeLocal,
  type BrandContext,
  type LayoutSelection,
  type SectionState,
  type Variant,
} from '@/lib/website-layout-overrides'

// Non-null: these three block types are fixed parts of the general/
// construction packs, not looked up dynamically. Cast to a plain
// (props) => ReactNode — Puck's own PuckComponent type requires a `puck`
// context field these components don't actually read (confirmed by
// reading each render body), same premise the page-builder's own
// liveThumb() relies on to call a component's render() outside the editor.
type BlockRender = (props: Record<string, unknown>) => ReactNode
const TOP_HEADER_CONFIG = construction.components.ConstructionTopBar!
const HEADER_CONFIG = construction.components.ConstructionHeader!
const FOOTER_CONFIG = construction.components.ConstructionFooter!

const VARIANTS: Variant[] = ['1', '2', '3', '4']

// Shrinks a component's own real render to a given scale. Uses CSS `zoom`
// rather than `transform: scale()` — transform only shrinks the paint, not
// the layout box, so the wrapper needed a guessed fixed pixel height that
// was wrong for every section (either cropped or left a big blank gap
// below shorter content — "why height this much"). `zoom` actually
// resizes the box to fit the scaled content, so no height guess is needed
// and every variant (whatever its real height) fits exactly.
function RenderPreview({
  render,
  props,
  scale,
  background = 'bg-white',
}: {
  render: (p: Record<string, unknown>) => ReactNode
  props: Record<string, unknown>
  scale: number
  background?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-md border', background)} style={{ zoom: scale }}>
      {render(props)}
    </div>
  )
}

const TOP_HEADER_LABELS: Record<Variant, string> = {
  '1': 'Contact + links + socials',
  '2': 'Announcement + social + language',
  '3': 'Tagline + CTA button',
  '4': 'Support items + login/signup',
}

const HEADER_LABELS: Record<Variant, string> = {
  '1': 'Classic, transparent over hero',
  '2': 'Diagonal banner (socials) + phone badge',
  '3': 'Solid color bar, login + grid menu',
  '4': 'Phone/email badges, search + CTA',
}

// All 4 Footer designs are built (each of the 4 reference designs is a
// structurally different footer, not just a restyle of one skeleton like
// Header's 4 designs were).
const FOOTER_LABELS: Record<Variant, string> = {
  '1': '4-column, showroom + regd. office',
  '2': 'Colorful blocks — about + quick links + contact',
  '3': 'White logo bar, dark link columns + big phone',
  '4': 'Dark curve, 4 link columns + newsletter signup',
}

function sectionConfig(
  section: 'topHeader' | 'header' | 'footer',
  brand: BrandContext,
  projectId: string
) {
  if (section === 'topHeader') {
    return {
      title: 'Top header',
      description: 'Utility bar above the main navigation (contact info, promo, socials).',
      render: TOP_HEADER_CONFIG.render as BlockRender,
      props: (variant: Variant) => ({
        ...TOP_HEADER_CONFIG.defaultProps,
        ...topHeaderOverrides(brand),
        variant,
      }),
      label: (variant: Variant) => `Design ${variant} — ${TOP_HEADER_LABELS[variant]}`,
      tileScale: 0.9,
    }
  }
  if (section === 'header') {
    return {
      title: 'Header',
      description: 'Logo, main navigation and call-to-action.',
      render: HEADER_CONFIG.render as BlockRender,
      props: (variant: Variant) => ({
        ...HEADER_CONFIG.defaultProps,
        ...headerFooterOverrides(brand),
        variant,
        // Design 1's transparent/floating style uses `position: fixed`
        // outside the Puck editor (it's meant to overlay a hero on the real
        // page) — fixed would escape this picker's tile entirely and pin
        // itself to the browser viewport. `puck.isEditing` makes it use
        // `sticky` instead, same as it already does inside the real editor
        // canvas. `metadata.projectId` is what lets the header fetch the
        // project's real live nav tree instead of falling back to
        // defaultProps' frozen sample links (previously missing here —
        // every design tile showed the same stale placeholder nav
        // regardless of the project's actual Selected Navigation).
        puck: { isEditing: true, metadata: { projectId } },
      }),
      label: (variant: Variant) => `Design ${variant} — ${HEADER_LABELS[variant]}`,
      tileScale: 0.9,
      // Design 1 is `transparent` + light (white) text — meant to float
      // over a dark/photo hero on the real page. A plain white tile
      // background made the text/nav invisible (white-on-white — reported:
      // "where is nav??"). A dark backdrop stands in for the hero so it's
      // actually legible; Designs 2-4 paint their own opaque background
      // over this regardless, so it's safe for all four.
      previewBackground: 'bg-gradient-to-br from-slate-900 to-slate-800',
    }
  }
  return {
    title: 'Footer',
    description: 'Site-wide footer shown at the bottom of every page.',
    render: FOOTER_CONFIG.render as BlockRender,
    props: (variant: Variant) => ({
      ...FOOTER_CONFIG.defaultProps,
      ...footerOverrides(brand),
      variant,
      // Same fix as Header above — without this the footer preview falls
      // back to defaultProps' frozen sample links instead of the project's
      // real live footer menu.
      puck: { isEditing: true, metadata: { projectId } },
    }),
    label: (variant: Variant) => `Design ${variant} — ${FOOTER_LABELS[variant]}`,
    tileScale: 0.55,
  }
}

// Section Builder — the existing standalone custom-block composer — is
// where "Create new" hands off to design something outside the 4 fixed
// presets, same as the earlier "Create new" ask pointed at (KDL's own
// ADD A SECTION flow), rather than duplicating that composer here.
const SECTION_BUILDER_HREF = '/admin/page-builder/section-builder'
// Section Builder category each layout slot's saved blocks are filed under.
const SECTION_CATEGORY = { topHeader: 'top-bar', header: 'header', footer: 'footer' } as const

function SectionPicker({
  section,
  state,
  onChange,
  brand,
  editPageId,
  projectId,
}: {
  section: 'topHeader' | 'header' | 'footer'
  state: SectionState
  onChange: (next: SectionState) => void
  brand: BrandContext
  editPageId: string | undefined
  projectId: string
}) {
  const cfg = sectionConfig(section, brand, projectId)
  const [viewingVariant, setViewingVariant] = useState<Variant | null>(null)
  const [viewingCustom, setViewingCustom] = useState<CustomBlockRecord | null>(null)
  const category = SECTION_CATEGORY[section]
  const { data: customBlocks } = useQuery({
    queryKey: ['custom-blocks', projectId, category],
    queryFn: () => listCustomBlocks(projectId, category),
  })
  const returnTo = encodeURIComponent(`/admin/template-engine/projects/${projectId}/website/layout`)
  const builderHref = (extra: string) =>
    `${SECTION_BUILDER_HREF}?category=${category}&projectId=${projectId}&returnTo=${returnTo}${extra}`
  const editHref = editPageId
    ? `/admin/template-engine/edit/${editPageId}?projectId=${projectId}`
    : undefined

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{cfg.title}</h3>
          <p className="text-xs text-muted-foreground">{cfg.description}</p>
        </div>
        <Switch
          checked={state.enabled}
          onCheckedChange={(enabled) => onChange({ ...state, enabled })}
        />
      </div>
      {state.enabled && (
        <div className="space-y-3">
          {VARIANTS.map((variant) => (
            <div
              key={variant}
              className={cn(
                'relative overflow-hidden rounded-md border',
                state.variant === variant && 'ring-2 ring-primary'
              )}
            >
              {state.variant === variant && (
                <CheckCircle2 className="absolute right-1.5 top-1.5 z-10 h-5 w-5 rounded-full bg-white text-green-600" />
              )}
              <button
                type="button"
                aria-label={cfg.label(variant)}
                onClick={() => onChange({ ...state, variant })}
                className="block w-full text-left transition-colors hover:opacity-80"
              >
                <RenderPreview
                  render={cfg.render}
                  props={cfg.props(variant)}
                  scale={cfg.tileScale}
                  background={cfg.previewBackground}
                />
              </button>
              <div className="flex items-center justify-center gap-1 border-t bg-muted/30 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setViewingVariant(variant)}
                >
                  View
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={!editHref}
                  asChild={!!editHref}
                >
                  {editHref ? (
                    <a href={editHref} target="_blank" rel="noreferrer">
                      Edit
                    </a>
                  ) : (
                    <span>Edit</span>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  asChild
                >
                  <a href={builderHref('&new=1')}>Create new</a>
                </Button>
              </div>
            </div>
          ))}
          {(customBlocks ?? []).map((b) => {
            const id = `custom:${b.id}` as const
            return (
              <div
                key={b.id}
                className={cn(
                  'relative overflow-hidden rounded-md border',
                  state.variant === id && 'ring-2 ring-primary'
                )}
              >
                {state.variant === id && (
                  <CheckCircle2 className="absolute right-1.5 top-1.5 z-10 h-5 w-5 rounded-full bg-white text-green-600" />
                )}
                <button
                  type="button"
                  aria-label={b.name}
                  onClick={() => onChange({ ...state, variant: id })}
                  className="block w-full text-left transition-colors hover:opacity-80"
                >
                  <div
                    className="pointer-events-none overflow-hidden bg-white"
                    style={{ zoom: cfg.tileScale }}
                  >
                    <ComposerProjectContext.Provider value={projectId}>
                      {renderComposedBlock(b.config)}
                    </ComposerProjectContext.Provider>
                  </div>
                </button>
                <div className="flex items-center justify-center gap-1 border-t bg-muted/30 p-1">
                  <span className="mr-2 text-xs text-muted-foreground">Custom · {b.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setViewingCustom(b)}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    asChild
                  >
                    <a href={builderHref(`&blockId=${b.id}`)}>Edit</a>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={viewingCustom !== null}
        onOpenChange={(open) => !open && setViewingCustom(null)}
      >
        <DialogContent className="w-[95vw] max-w-[1600px]">
          <DialogHeader>
            <DialogTitle>
              {cfg.title} — {viewingCustom?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingCustom && (
            <div className="overflow-hidden rounded-md border bg-white">
              <ComposerProjectContext.Provider value={projectId}>
                {renderComposedBlock(viewingCustom.config)}
              </ComposerProjectContext.Provider>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewingVariant !== null}
        onOpenChange={(open) => !open && setViewingVariant(null)}
      >
        <DialogContent className="w-[95vw] max-w-[1600px]">
          <DialogHeader>
            <DialogTitle>
              {cfg.title} {viewingVariant ? `— ${cfg.label(viewingVariant)}` : ''}
            </DialogTitle>
          </DialogHeader>
          {viewingVariant && (
            <RenderPreview
              render={cfg.render}
              props={cfg.props(viewingVariant)}
              scale={1}
              background={cfg.previewBackground}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function WebsiteLayoutPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: runs, isLoading } = useTemplateEngineRuns(projectId)
  const run = runs?.[0]
  const advance = useAdvanceStage(run?.id ?? '', projectId)
  const storageKey = websiteLayoutStorageKey(projectId)
  const [selection, setSelection] = useState<LayoutSelection>(() =>
    mergeLayoutSelection(readLocal<Partial<LayoutSelection>>(storageKey, {}))
  )

  const brand = useWebsiteBrandContext(projectId)

  // Real assembled-page ids for the "Edit" button, same outputRef shape
  // WebsiteStage.tsx reads (pageKeyToId) — empty until the Website stage
  // has actually produced pages at least once. "Edit" opens the real page
  // editor pre-loaded on one representative page — header/footer/
  // top-header are per-page block instances, not a shared global template,
  // so there's no single page-independent place to edit.
  const websiteStage = run?.stages.find((s) => s.stage === 'WEBSITE')
  const outputRef = websiteStage?.outputRef as
    { pageKeyToId?: Record<string, string> } | null | undefined
  const editPageId = outputRef?.pageKeyToId?.home ?? Object.values(outputRef?.pageKeyToId ?? {})[0]

  const backHref = `/admin/template-engine/projects/${projectId}/website`

  function handleCreate() {
    writeLocal(storageKey, selection)
    const navigationPages = readLocal<string[]>(`te-website-ui:${projectId}:navigation`, [])
    advance.mutate(
      { stage: 'WEBSITE', body: { navigationPages, layout: selection } },
      { onSuccess: () => router.push(backHref) }
    )
  }

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="w-full space-y-4 p-6">
      <Button type="button" variant="ghost" size="sm" asChild className="gap-1.5 px-2">
        <a href={backHref}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Pages
        </a>
      </Button>

      <div>
        <h2 className="text-lg font-semibold">Layout</h2>
        <p className="text-sm text-muted-foreground">
          Pick a design for each section, then create the layout to apply it to every assembled
          page.
        </p>
      </div>

      <div className="space-y-3">
        <SectionPicker
          section="topHeader"
          state={selection.topHeader}
          onChange={(topHeader) => setSelection({ ...selection, topHeader })}
          brand={brand}
          editPageId={editPageId}
          projectId={projectId}
        />
        <SectionPicker
          section="header"
          state={selection.header}
          onChange={(header) => setSelection({ ...selection, header })}
          brand={brand}
          editPageId={editPageId}
          projectId={projectId}
        />
        <SectionPicker
          section="footer"
          state={selection.footer}
          onChange={(footer) => setSelection({ ...selection, footer })}
          brand={brand}
          editPageId={editPageId}
          projectId={projectId}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleCreate} disabled={advance.isPending || !run}>
          {advance.isPending ? 'Creating…' : 'Create layout'}
        </Button>
      </div>
    </div>
  )
}
