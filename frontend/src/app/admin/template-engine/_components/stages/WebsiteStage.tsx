'use client'

import Link from 'next/link'
import { SiteStylesStep } from './SiteStylesStep'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  Download,
  FileText,
  ArrowRight,
  ExternalLink,
  Plus,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDetailPageTypes } from '@/admin/lib/detail-page-types'
import { useSiteHomeHref } from '@/admin/hooks/useSiteHomeHref'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { cn } from '@/lib/utils'
import { loadGoogleFont, loadCustomFontFace } from '@/admin/lib/load-google-font'
import { useFetchSiteLayout } from '@/admin/hooks/useSiteLayout'
import { useModules } from '@/admin/hooks/useModules'
import { visibleSurfaces, type SurfaceKey } from '@/admin/lib/website-surfaces'
import {
  useAdvanceStage,
  useBrandKit,
  useCreateSite,
  usePatchTypography,
  useRetryStage,
  useSkipStage,
} from '@/admin/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { WebsiteLayoutPreview } from '../WebsiteLayoutPreview'
import { NavPagesGrid } from './NavPagesGrid'
import { NavigationStep, type DetailPageType } from './NavigationStep'
import { readLocal, writeLocal } from '../../website-ui-state'
import type { BrandKitTypography, TemplateEngineRun } from '@/admin/types/template-engine.types'
import type { Media } from '@/types/media.types'

// Mirrors the design prototype's "Brands" grid (a card per brand surface —
// web app, admin app, visiting card, letterhead, t-shirt, ID card). Only
// "Web app" is wired up so far — per explicit instruction, ship one card's
// flow before adding the rest (roadmap row 4a; the other cards are rows 4b/4c,
// not yet spec'd). Unimplemented cards are intentionally omitted rather than
// shown disabled — nothing to click through to yet.
const SURFACE_CARD_CLASS =
  'rounded-lg border-2 border-primary bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10'
// Which of these show is decided by visibleSurfaces() (admin/lib/website-surfaces.ts): the enabled
// modules. `href` absent = opens the Web app flow in place. Forms and the static export live inside
// the Web app (see WebAppTools), not as cards.
const SURFACE_CARDS: Record<SurfaceKey, { name: string; href?: (projectId: string) => string }> = {
  webapp: { name: 'Web app' },
  landing: { name: 'Landing Pages', href: () => '/admin/landing-pages' },
  collateral: {
    name: 'Collateral',
    href: (projectId) => `/admin/template-engine/projects/${projectId}/collateral`,
  },
}

/**
 * What belongs to the Web app besides its pages: its forms (and their submissions), and the one-click
 * conversion to a static copy that can be hosted anywhere.
 */
function WebAppTools({ projectId }: { projectId: string }) {
  const { isEnabled } = useModules()
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" data-testid="webapp-tools">
      {isEnabled('forms') && (
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/forms" data-testid="webapp-forms-link">
            <FileText className="h-4 w-4" />
            Forms
          </Link>
        </Button>
      )}
      <Button asChild size="sm">
        <Link
          href={`/admin/static-website?projectId=${projectId}`}
          data-testid="convert-static-link"
        >
          <Download className="h-4 w-4" />
          Convert to Static Website
        </Link>
      </Button>
    </div>
  )
}

// Curated starter sets matching the prototype's Web app Typography screen.
const HEADING_FONTS = ['Poppins', 'Inter', 'Manrope', 'Space Grotesk']
const BODY_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Work Sans']

// Web app step progress (which step you're on, type-scale edits, nav page
// picks) is session-local — none of it round-trips through the brand kit —
// so a refresh used to drop you back at the Brands grid mid-flow. Persisting
// it to localStorage, scoped per project, keeps you on the same step/edits
// across a refresh without adding backend/schema work for state that's
// still just in-progress UI, not saved brand data.
export function WebsiteStage({ run }: { run: TemplateEngineRun }) {
  const { isEnabled } = useModules()
  const surfaces = visibleSurfaces({ landingEnabled: isEnabled('landing') })
  const stage = run.stages.find((s) => s.stage === 'WEBSITE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const skip = useSkipStage(run.id, run.projectId)
  const createSite = useCreateSite(run.projectId)
  const { data: brandKit } = useBrandKit(run.projectId)
  const patchTypography = usePatchTypography(run.projectId)
  const uiStateKey = `te-website-ui:${run.projectId}`
  // The only in-place flow is the Web app one; the other cards are links.
  const [openBrand, setOpenBrand] = useState<'webapp' | null>(
    () => readLocal(uiStateKey, { openBrand: null as 'webapp' | null }).openBrand
  )
  const [webAppStep, setWebAppStep] = useState<
    'typography' | 'fontSettings' | 'styles' | 'navigation' | 'layouts' | 'assemble'
  >(() => readLocal(uiStateKey, { webAppStep: 'typography' as const }).webAppStep)
  // Snapshot of what Typography's Next just saved — read straight from the
  // mutation result instead of waiting on brandKit's invalidate-refetch, so
  // Font settings' family options are correct on the very next render.
  const [savedTypography, setSavedTypography] = useState<BrandKitTypography | null>(null)

  useEffect(() => {
    writeLocal(uiStateKey, { openBrand, webAppStep })
  }, [uiStateKey, openBrand, webAppStep])

  const outputRef = stage?.outputRef as
    | {
        pageIds?: string[]
        pageKeyToId?: Record<string, string>
        pageKeyToTitle?: Record<string, string>
      }
    | null
    | undefined
  const pages = Object.entries(outputRef?.pageKeyToId ?? {})
  // Every registered Details Page type (Sectors, Work, ... — see
  // backend/src/shared/detail-pages/registry.js) reports itself here: real
  // per-entity assembled pages that live in their own table, not
  // outputRef.pageKeyToId, plus everything the Layout pill + nav-sync need
  // (count, entities, hrefs). Adding a new type never touches this file —
  // it just starts showing up in this list.
  const { data: detailPageTypes } = useQuery({
    queryKey: ['detail-page-types', run.projectId],
    queryFn: () => fetchDetailPageTypes<DetailPageType>(run.projectId),
  })
  // Live menu labels (header + footer): a plain "X Detail" nav-page pill is shown only while a
  // menu item with that label exists — the menu is the source of truth for detail layouts.
  const { data: menuLabels } = useQuery({
    queryKey: ['detail-menu-labels', run.projectId],
    queryFn: async () => {
      type Node = { label: string; children?: Node[] }
      const labels = new Set<string>()
      const walk = (items: Node[] = []) =>
        items.forEach((i) => {
          labels.add(i.label.trim().toLowerCase())
          walk(i.children)
        })
      for (const key of ['header', 'footer']) {
        const r = await api.post('/menus/ensure', { project_id: run.projectId, key, name: key })
        walk(r.data.data.menu.items)
      }
      return labels
    },
  })
  // Page slugs are deterministic (`te-{runId}-{key}`, set by the website
  // driver — see template-engine/drivers/index.js's `seedPages`), so the
  // real public Home URL can be computed here with no extra fetch. Prefers
  // the "home" key; falls back to whatever page exists first for a run
  // that genuinely has no Home page.
  const demoSiteHref = useSiteHomeHref(outputRef?.pageKeyToId)
  // Older runs (before navigationPages existed) have no pageKeyToTitle —
  // every key was its title lowercased then, so capitalizing the key alone
  // still matches ('home' -> 'Home').
  function pageLabel(key: string) {
    return outputRef?.pageKeyToTitle?.[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
  }

  // A custom nav page named "<Something> Detail" (e.g. "Work detail") has no
  // real per-entry module behind it like Sectors does — it's one single
  // assembled page — but it still gets its own Layout pill next to "Layout
  // Sector detail", just pointing straight at that one page's own editor
  // instead of a list of many.
  // Same-titled pages ("Service Detail" x2) share one pill; its badge is how many there are.
  const customDetailPageTypes = Object.values(
    pages
      .filter(([key]) => /\bdetail$/i.test(pageLabel(key)))
      .reduce<
        Record<
          string,
          {
            label: string
            count: number
            sectionHref: string
            listHref: string
          }
        >
      >((acc, [key, id]) => {
        const label = pageLabel(key)
        const editHref = `/admin/template-engine/edit/${id}?projectId=${run.projectId}`
        // Pill -> section builder of the first page; numbered badge -> /admin/<slug> pages table.
        acc[label] = acc[label]
          ? { ...acc[label], count: acc[label].count + 1 }
          : {
              label,
              count: 1,
              sectionHref: editHref,
              listHref: `/admin/${label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')}?projectId=${run.projectId}`,
            }
        return acc
      }, {})
  )

  function openWebApp() {
    // Fire-and-continue: the folder is (re)generated in the background while
    // the user moves on to Typography.
    createSite.mutate()
    setOpenBrand('webapp')
    setWebAppStep('typography')
  }

  // Navigation writes its selection straight to localStorage (no API call
  // of its own) — read it here, the one place that actually triggers page
  // generation, so a run builds the pages the user picked instead of always
  // the default Home/About/Contact set.
  const fetchSiteLayout = useFetchSiteLayout()
  async function runWebsiteAssembly() {
    const navigationPages = readLocal<string[]>(`te-website-ui:${run.projectId}:navigation`, [])
    // Without this, a page only ever touched through Navigation (not the
    // dedicated Website Layout page) never gets a header/footer design
    // applied at all — it's built from the seeder's raw, unbranded
    // NavBar/Footer instead of the project's actual chosen
    // ConstructionHeader/Footer, and looks like a different site. Reading
    // the same saved selection the Layout page itself uses keeps every
    // page in sync with whatever design is actually configured. Read fresh from the
    // server: sending defaults here would overwrite the saved design on every page.
    const layout = await fetchSiteLayout(run.projectId)
    advance.mutate({ stage: 'WEBSITE', body: { navigationPages, layout } })
  }

  // Set right before Navigation's "Next" moves webAppStep to 'assemble' —
  // clicking Next should itself (re)build the pages for whatever's
  // currently selected, not just navigate to a screen with its own
  // possibly-disabled Complete button (StageShell disables Run once
  // status is DONE, which every re-run after the first hits). Guarded so a
  // plain page reload or back-and-forth while already on 'assemble'
  // doesn't re-trigger — generation is idempotent but not free.
  const pendingRegenRef = useRef(false)
  useEffect(() => {
    if (webAppStep === 'assemble' && pendingRegenRef.current) {
      pendingRegenRef.current = false
      runWebsiteAssembly()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webAppStep])

  return (
    <StageShell
      title="Website Assembly"
      description="Seed website pages from Puck component packs filtered by industry, using the approved brand kit as slot defaults. Pages are created in the page-builder engine."
      stage={stage ?? null}
      hideHeader
      hideRunButton={openBrand === null || webAppStep !== 'assemble'}
      onRun={stage?.status === 'FAILED' ? () => retry.mutate('WEBSITE') : runWebsiteAssembly}
      onSkip={() => skip.mutate('WEBSITE')}
      isRunning={advance.isPending || retry.isPending}
    >
      {openBrand === null ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">Brands</h3>
            <p className="text-sm text-muted-foreground">
              Your web app, landing pages and collateral. Click a card to open it. Forms and
              &ldquo;Convert to Static Website&rdquo; are inside the Web app.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {surfaces.map((key) => {
              const card = SURFACE_CARDS[key]
              const body = (
                <>
                  <div className="text-sm font-semibold">{card.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                    Active · Open <ArrowRight className="h-3 w-3" />
                  </div>
                </>
              )
              const href = card.href?.(run.projectId)
              return href ? (
                <Link key={key} href={href} className={SURFACE_CARD_CLASS}>
                  {body}
                </Link>
              ) : (
                <button key={key} type="button" onClick={openWebApp} className={SURFACE_CARD_CLASS}>
                  {body}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <WebAppTools projectId={run.projectId} />
          {webAppStep === 'typography' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenBrand(null)}
              className="gap-1.5 px-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Brands
            </Button>
          ) : webAppStep === 'assemble' ? (
            // The Pages grid is downstream of the page selection made in
            // Navigation — "back" here should let a user revise that
            // selection, not exit the whole Web app flow back to Brands.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setWebAppStep('navigation')}
              className="gap-1.5 px-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Navigation
            </Button>
          ) : null}

          {webAppStep === 'typography' ? (
            <WebAppTypographyStep
              typography={brandKit?.typography ?? null}
              isSaving={patchTypography.isPending}
              onNext={(typography, then) =>
                patchTypography.mutate(typography, {
                  onSuccess: (updatedKit) => {
                    setSavedTypography(updatedKit.typography)
                    if (then) setWebAppStep(then) // Save alone stays here; the other buttons move on
                  },
                })
              }
            />
          ) : webAppStep === 'fontSettings' ? (
            <FontSettingsStep
              projectId={run.projectId}
              typography={savedTypography ?? brandKit?.typography ?? null}
              onBack={() => setWebAppStep('typography')}
              onNext={() => setWebAppStep('styles')}
              onSkip={() => setWebAppStep('navigation')}
            />
          ) : webAppStep === 'styles' ? (
            <SiteStylesStep
              onBack={() => setWebAppStep('fontSettings')}
              onNext={() => setWebAppStep('navigation')}
            />
          ) : webAppStep === 'layouts' ? (
            <LayoutSettingsPanel
              projectId={run.projectId}
              editHref={`/admin/template-engine/projects/${run.projectId}/website/layout`}
              detailPageTypes={[
                ...(detailPageTypes ?? []).map((t) => ({
                  ...t,
                  onDelete: t.deletable
                    ? () =>
                        api.delete(`/detail-page-types/${t.typeKey}`, {
                          params: { project_id: run.projectId },
                        })
                    : undefined,
                  entries: t.entities.map((e) => ({
                    name: e.name,
                    href: `/admin/template-engine/edit/${e.detail_page_id}?projectId=${run.projectId}`,
                    publicHref: e.publicPath,
                  })),
                })),
                ...customDetailPageTypes
                  .filter(
                    (c) =>
                      menuLabels?.has(c.label.trim().toLowerCase()) &&
                      !(detailPageTypes ?? []).some(
                        (t) => t.label.toLowerCase() === c.label.toLowerCase()
                      )
                  )
                  .map((c) => ({
                    ...c,
                    onDelete: () =>
                      Promise.all(
                        pages
                          .filter(([k]) => pageLabel(k) === c.label)
                          .map(([, id]) => api.delete(`/page-builder/${id}`))
                      ),
                  })),
              ]}
            />
          ) : webAppStep === 'navigation' ? (
            <NavigationStep
              projectId={run.projectId}
              runId={run.id}
              onBack={() => setWebAppStep('styles')}
              onLayouts={() => setWebAppStep('layouts')}
              onNext={() => {
                pendingRegenRef.current = true
                setWebAppStep('assemble')
              }}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Website · Pages</h3>
                  <p className="text-sm text-muted-foreground">
                    {advance.isPending
                      ? 'Updating pages for your latest selection…'
                      : 'One page for every Navigation item, plus Home. Open a page to edit it.'}
                  </p>
                </div>
                {demoSiteHref && (
                  <Button size="sm" asChild>
                    <a href={demoSiteHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Demo all pages
                    </a>
                  </Button>
                )}
              </div>
              <NavPagesGrid projectId={run.projectId} homeId={outputRef?.pageKeyToId?.home} />
            </div>
          )}
        </div>
      )}
    </StageShell>
  )
}

// True multi-select, matching the prototype's "pick one or more" tiles.
// Backend brand-kit/tokens.js only ever reads a single typography.heading
// .family / .body.family though, so on save the first selected font becomes
// `family` (the live CSS token) and the full selection is kept as `families`
// for reference — see BrandKitTypography.
function WebAppTypographyStep({
  typography,
  isSaving,
  onNext,
}: {
  typography: {
    heading: { family: string; families?: string[] } | null
    body: { family: string; families?: string[] } | null
  } | null
  isSaving: boolean
  /** Saves the fonts; `then` is where to go once they are saved (nowhere = stay on this step). */
  onNext: (
    typography: {
      heading: { family: string; families: string[] }
      body: { family: string; families: string[] }
    },
    then?: 'fontSettings' | 'navigation'
  ) => void
}) {
  const [heading, setHeading] = useState<string[]>(() =>
    seedSelection(typography?.heading, HEADING_FONTS)
  )
  const [body, setBody] = useState<string[]>(() => seedSelection(typography?.body, BODY_FONTS))
  const [headingOptions, setHeadingOptions] = useState<string[]>(() =>
    dedupePrependAll(HEADING_FONTS, typography?.heading?.families ?? [])
  )
  const [bodyOptions, setBodyOptions] = useState<string[]>(() =>
    dedupePrependAll(BODY_FONTS, typography?.body?.families ?? [])
  )
  const cannotSave = isSaving || heading.length === 0 || body.length === 0
  const save = (then?: 'fontSettings' | 'navigation') =>
    onNext(
      {
        heading: { family: heading[0]!, families: heading },
        body: { family: body[0]!, families: body },
      },
      then
    )

  return (
    <div className="rounded-lg border bg-card p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Website</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Digital
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Pick the heading and body fonts for this surface, then Save.
      </p>

      <FontRoleSection
        label="Heading"
        options={headingOptions}
        selected={heading}
        onToggle={(name) => setHeading((prev) => toggleSelection(prev, name))}
        onAddGoogleFont={(name) => {
          setHeadingOptions((prev) => dedupePrepend(prev, name))
          setHeading((prev) => (prev.includes(name) ? prev : [...prev, name]))
        }}
        onUpload={(name, url) => {
          loadCustomFontFace(name, url)
          setHeadingOptions((prev) => dedupePrepend(prev, name))
          setHeading((prev) => (prev.includes(name) ? prev : [...prev, name]))
        }}
      />

      <FontRoleSection
        label="Body"
        options={bodyOptions}
        selected={body}
        onToggle={(name) => setBody((prev) => toggleSelection(prev, name))}
        onAddGoogleFont={(name) => {
          setBodyOptions((prev) => dedupePrepend(prev, name))
          setBody((prev) => (prev.includes(name) ? prev : [...prev, name]))
        }}
        onUpload={(name, url) => {
          loadCustomFontFace(name, url)
          setBodyOptions((prev) => dedupePrepend(prev, name))
          setBody((prev) => (prev.includes(name) ? prev : [...prev, name]))
        }}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Each button saves the fonts first, then moves on, so a choice is never lost. */}
        <Button
          variant="outline"
          onClick={() => save()}
          disabled={cannotSave}
          data-testid="typography-save"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={() => save('navigation')}
          disabled={cannotSave}
          data-testid="typography-skip"
        >
          Skip to Navigation
        </Button>
        <Button
          onClick={() => save('fontSettings')}
          disabled={cannotSave}
          data-testid="typography-next"
        >
          Next: Typography
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function seedSelection(
  role: { family: string; families?: string[] } | null | undefined,
  fallback: string[]
): string[] {
  if (role?.families?.length) return role.families
  if (role?.family) return [role.family]
  return [fallback[0]!]
}

// A tile can never be unchecked down to zero — at least one font per role
// must stay selected so Next always has something to save.
function toggleSelection(selected: string[], name: string): string[] {
  if (selected.includes(name)) {
    return selected.length > 1 ? selected.filter((n) => n !== name) : selected
  }
  return [...selected, name]
}

function dedupePrepend(options: string[], name: string | undefined | null): string[] {
  if (!name || options.includes(name)) return options
  return [name, ...options]
}

function dedupePrependAll(options: string[], names: string[]): string[] {
  return names.reduceRight((acc, name) => dedupePrepend(acc, name), options)
}

interface CustomFontRow {
  id: number
  value: string
}

function FontRoleSection({
  label,
  options,
  selected,
  onToggle,
  onAddGoogleFont,
  onUpload,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (name: string) => void
  onAddGoogleFont: (name: string) => void
  onUpload: (name: string, url: string) => void
}) {
  const [rows, setRows] = useState<CustomFontRow[]>([{ id: 0, value: '' }])
  const nextRowId = useRef(1)
  const [pickerRowId, setPickerRowId] = useState<number | null>(null)

  function updateRow(id: number, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)))
  }

  function commitRow(id: number) {
    const name = rows.find((r) => r.id === id)?.value.trim()
    if (!name) return
    onAddGoogleFont(name)
    updateRow(id, '')
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {label} — pick one or more ({selected.length} selected)
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((name) => (
          <FontTile
            key={name}
            name={name}
            selected={selected.includes(name)}
            onSelect={() => onToggle(name)}
          />
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              placeholder="Google Font name (e.g. Roboto)"
              value={row.value}
              onChange={(e) => updateRow(row.id, e.target.value)}
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => commitRow(row.id)}>
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerRowId(row.id)}
            >
              <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove font row"
              onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
              className="shrink-0 px-2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((prev) => [...prev, { id: nextRowId.current++, value: '' }])}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Add row
      </Button>

      {pickerRowId !== null && (
        <MediaPicker
          open
          onClose={() => setPickerRowId(null)}
          onSelect={(media: Media[]) => {
            const m = media[0]
            if (m?.url) {
              const derived = (
                m.original_name ||
                (m.url.split(/[?#]/)[0] ?? '').split('/').pop() ||
                'Custom font'
              ).replace(/\.[^.]+$/, '')
              onUpload(derived, m.url)
            }
            setPickerRowId(null)
          }}
        />
      )}
    </div>
  )
}

function FontTile({
  name,
  selected,
  onSelect,
}: {
  name: string
  selected: boolean
  onSelect: () => void
}) {
  useEffect(() => {
    loadGoogleFont(name)
  }, [name])

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'hover:bg-accent'
      )}
    >
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={selected} readOnly className="pointer-events-none" />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="mt-1.5 text-lg" style={{ fontFamily: `'${name}', sans-serif` }}>
        Aa Bb Cc
      </div>
    </button>
  )
}

type TypeScaleKind =
  'heading' | 'lead' | 'body' | 'small' | 'nav' | 'button' | 'link' | 'quote' | 'overline'

interface TypeScaleRow {
  tag: string
  kind: TypeScaleKind
  size: string
  weight: number
  lineHeight: string
  letterSpacing: string
  family: string
}

// Mirrors the design prototype's default type scale — one row per typographic
// role, not just the six heading levels.
const DEFAULT_TYPE_SCALE: Omit<TypeScaleRow, 'family'>[] = [
  {
    tag: 'H1',
    kind: 'heading',
    size: '40px',
    weight: 800,
    lineHeight: '1.2',
    letterSpacing: '-0.5px',
  },
  {
    tag: 'H2',
    kind: 'heading',
    size: '32px',
    weight: 800,
    lineHeight: '1.2',
    letterSpacing: '-0.3px',
  },
  {
    tag: 'H3',
    kind: 'heading',
    size: '28px',
    weight: 700,
    lineHeight: '1.25',
    letterSpacing: '0px',
  },
  {
    tag: 'H4',
    kind: 'heading',
    size: '24px',
    weight: 700,
    lineHeight: '1.3',
    letterSpacing: '0px',
  },
  {
    tag: 'H5',
    kind: 'heading',
    size: '20px',
    weight: 700,
    lineHeight: '1.35',
    letterSpacing: '0px',
  },
  {
    tag: 'H6',
    kind: 'heading',
    size: '16px',
    weight: 700,
    lineHeight: '1.4',
    letterSpacing: '0px',
  },
  {
    tag: 'Lead paragraph',
    kind: 'lead',
    size: '20px',
    weight: 400,
    lineHeight: '1.6',
    letterSpacing: '0px',
  },
  { tag: 'Body', kind: 'body', size: '16px', weight: 400, lineHeight: '1.6', letterSpacing: '0px' },
  {
    tag: 'Small / caption',
    kind: 'small',
    size: '13px',
    weight: 400,
    lineHeight: '1.5',
    letterSpacing: '0px',
  },
  {
    tag: 'Nav link',
    kind: 'nav',
    size: '15px',
    weight: 600,
    lineHeight: '1.4',
    letterSpacing: '0.2px',
  },
  {
    tag: 'Button',
    kind: 'button',
    size: '15px',
    weight: 700,
    lineHeight: '1',
    letterSpacing: '0.3px',
  },
  { tag: 'Link', kind: 'link', size: '16px', weight: 600, lineHeight: '1.6', letterSpacing: '0px' },
  {
    tag: 'Blockquote',
    kind: 'quote',
    size: '20px',
    weight: 400,
    lineHeight: '1.5',
    letterSpacing: '0px',
  },
  {
    tag: 'Overline / label',
    kind: 'overline',
    size: '11px',
    weight: 700,
    lineHeight: '1.4',
    letterSpacing: '1.5px',
  },
]

const WEIGHT_OPTIONS = [300, 400, 500, 600, 700, 800, 900]
const WEIGHT_NAMES: Record<number, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extrabold',
  900: 'Black',
}
const DIM_UNITS = ['px', 'em', 'rem', '%']
const LINE_HEIGHT_UNITS = ['', 'px', 'em', 'rem', '%']

function splitDim(value: string): { num: string; unit: string } {
  const m = value.trim().match(/^(-?[\d.]+)\s*(px|em|rem|%)?$/)
  return m ? { num: m[1]!, unit: m[2] ?? '' } : { num: value, unit: '' }
}

function selectClass() {
  return 'w-full min-w-[80px] rounded-md border bg-background px-2 py-1.5 text-xs'
}

// Family, weight, and unit selects deliberately use plain <select> — a dense
// 14-row table of shadcn Select triggers/content/items would be much more
// code than this table needs.
function DimField({
  value,
  units,
  onChange,
}: {
  value: string
  units: string[]
  onChange: (next: string) => void
}) {
  const { num, unit } = splitDim(value)
  const activeUnit = units.includes(unit) ? unit : units[0]!
  return (
    <div className="flex gap-1">
      <Input
        value={num}
        onChange={(e) => onChange(`${e.target.value}${activeUnit}`)}
        className="h-8 min-w-[52px] px-2 text-xs"
      />
      <select
        value={activeUnit}
        onChange={(e) => onChange(`${num}${e.target.value}`)}
        className={selectClass()}
      >
        {units.map((u) => (
          <option key={u || 'none'} value={u}>
            {u || '—'}
          </option>
        ))}
      </select>
    </div>
  )
}

function specimenStyle(r: TypeScaleRow): CSSProperties {
  return {
    fontFamily: `'${r.family}', Inter, sans-serif`,
    fontSize: r.size,
    lineHeight: r.lineHeight,
    letterSpacing: r.letterSpacing,
    fontWeight: r.weight,
  }
}

function TypeScaleSpecimen({ r }: { r: TypeScaleRow }) {
  const style = specimenStyle(r)
  switch (r.kind) {
    case 'nav':
      return (
        <div style={style} className="flex gap-4 text-primary">
          <span>Home</span>
          <span>About</span>
          <span>Services</span>
          <span>Contact</span>
        </div>
      )
    case 'button':
      return (
        <span
          style={style}
          className="inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          Get started
        </span>
      )
    case 'link':
      return (
        <span style={style} className="text-primary underline">
          Read more about us
        </span>
      )
    case 'overline':
      return (
        <div style={style} className="uppercase text-secondary-foreground">
          Section label
        </div>
      )
    case 'quote':
      return (
        <div style={style} className="border-l-2 border-primary pl-3">
          &ldquo;Design is intelligence made visible.&rdquo;
        </div>
      )
    case 'lead':
      return (
        <div style={style} className="text-muted-foreground">
          A short leading paragraph that introduces the section that follows it.
        </div>
      )
    case 'body':
      return (
        <div style={style}>
          The quick brown fox jumps over the lazy dog while the sun sets behind the distant hills.
        </div>
      )
    case 'small':
      return (
        <div style={style} className="text-muted-foreground">
          Caption · last updated a few moments ago
        </div>
      )
    default:
      return <div style={style}>{r.tag} — The quick brown fox</div>
  }
}

function FontSettingsStep({
  projectId,
  typography,
  onBack,
  onNext,
  onSkip,
}: {
  projectId: string
  typography: {
    heading: { family: string; families?: string[] } | null
    body: { family: string; families?: string[] } | null
  } | null
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const storageKey = `te-website-ui:${projectId}:typeScale`
  const headingOptions = typography?.heading?.families?.length
    ? [...new Set(typography.heading.families)]
    : typography?.heading?.family
      ? [typography.heading.family]
      : ['Inter']
  const bodyOptions = typography?.body?.families?.length
    ? [...new Set(typography.body.families)]
    : typography?.body?.family
      ? [typography.body.family]
      : ['Inter']
  // H1–H6 only ever offer the fonts picked for Heading in Typography; every
  // other role (body, nav, button, ...) only offers the fonts picked for Body.
  const optionsForKind = (kind: TypeScaleKind) =>
    kind === 'heading' ? headingOptions : bodyOptions
  const fontOptions = [...new Set([...headingOptions, ...bodyOptions])]

  const [rows, setRows] = useState<TypeScaleRow[]>(() =>
    readLocal(
      storageKey,
      DEFAULT_TYPE_SCALE.map((r) => ({
        ...r,
        family: r.kind === 'heading' ? headingOptions[0]! : bodyOptions[0]!,
      }))
    )
  )

  useEffect(() => {
    fontOptions.forEach(loadGoogleFont)
    // Only re-run when the set of selectable fonts actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontOptions.join('|')])

  useEffect(() => {
    writeLocal(storageKey, rows)
  }, [storageKey, rows])

  // Rows already autosave above; Save writes them explicitly and confirms, staying on this step.
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setSaved(false)
  }, [rows])
  function saveRows() {
    writeLocal(storageKey, rows)
    setSaved(true)
  }

  function updateRow(i: number, patch: Partial<TypeScaleRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5 px-2">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Typography
      </Button>

      <div>
        <h3 className="text-base font-semibold">Font settings</h3>
        <p className="text-sm text-muted-foreground">
          Fine-tune the type scale for this platform using the fonts you chose in Typography.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Type scale</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Editable
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-2 py-1.5">Element</th>
                  <th className="px-2 py-1.5">Font size</th>
                  <th className="px-2 py-1.5">Family</th>
                  <th className="px-2 py-1.5">Weight</th>
                  <th className="px-2 py-1.5">Line height</th>
                  <th className="px-2 py-1.5">Letter spacing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.tag} className="border-t">
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium">{r.tag}</td>
                    <td className="px-2 py-1.5">
                      <DimField
                        value={r.size}
                        units={DIM_UNITS}
                        onChange={(size) => updateRow(i, { size })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.family}
                        onChange={(e) => updateRow(i, { family: e.target.value })}
                        className={selectClass()}
                      >
                        {[...new Set([...optionsForKind(r.kind), r.family])].map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.weight}
                        onChange={(e) => updateRow(i, { weight: Number(e.target.value) })}
                        className={selectClass()}
                      >
                        {[...new Set([...WEIGHT_OPTIONS, r.weight])]
                          .sort((a, b) => a - b)
                          .map((w) => (
                            <option key={w} value={w}>
                              {w} {WEIGHT_NAMES[w] ?? ''}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <DimField
                        value={r.lineHeight}
                        units={LINE_HEIGHT_UNITS}
                        onChange={(lineHeight) => updateRow(i, { lineHeight })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DimField
                        value={r.letterSpacing}
                        units={DIM_UNITS}
                        onChange={(letterSpacing) => updateRow(i, { letterSpacing })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={saveRows}
              data-testid="fontsettings-save"
            >
              {saved ? 'Saved' : 'Save'}
            </Button>
            {/* The type-scale rows autosave, so moving on needs no extra save. */}
            <Button
              type="button"
              variant="outline"
              onClick={onSkip}
              data-testid="fontsettings-skip"
            >
              Skip to Navigation
            </Button>
            <Button type="button" onClick={onNext} data-testid="fontsettings-next">
              Next: Buttons and form fields
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Examples</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Live
            </span>
          </div>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.tag} className={cn('space-y-1 pb-3', i < rows.length - 1 && 'border-b')}>
                <p className="text-xs text-muted-foreground">
                  {r.tag} · {r.size} · {r.family}
                </p>
                <TypeScaleSpecimen r={r} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// `detailPageTypes` — content types with many real entries (Sectors today; Services/Products/
// Portfolio/Blog/Jobs once those get their own module) each get one button here, not one card
// per entry — the entries themselves are managed on their own admin screen (e.g. /admin/sectors).
// A type with zero entries is hidden rather than shown as a dead/empty button.
function LayoutSettingsPanel({
  projectId,
  editHref,
  detailPageTypes = [],
}: {
  projectId: string
  editHref: string
  detailPageTypes?: {
    label: string
    count: number
    sectionHref: string
    listHref: string
    // href = section-builder editor; publicHref = the entry's live page at its real slug.
    entries?: { name: string; href: string; publicHref?: string }[]
    // Present only for deletable types: removes the type, all its pages and their menu links.
    onDelete?: () => Promise<unknown>
  }[]
}) {
  const availableDetailTypes = detailPageTypes.filter((t) => t.count > 0)
  const queryClient = useQueryClient()

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4 text-center">
      <div>
        <h3 className="text-sm font-semibold">Layout settings</h3>
        <p className="text-xs text-muted-foreground">
          Toggle the header/footer and pick a design for every assembled page.
        </p>
      </div>
      <Button size="sm" asChild>
        <a href={editHref}>Create/Edit layout</a>
      </Button>
      <div className="flex flex-wrap items-start justify-center gap-3">
        {availableDetailTypes.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-1.5">
            <div className="relative inline-block">
              {/* Pill -> Section Builder of the shared layout; badge -> manage entries. */}
              <a
                href={t.sectionHref}
                className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Layout {t.label}
              </a>
              {t.onDelete ? (
                <button
                  type="button"
                  title={`Delete ${t.label} and its ${t.count} pages`}
                  aria-label={`Delete ${t.label}`}
                  className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] leading-none text-destructive-foreground"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Delete "${t.label}" with all ${t.count} pages? This also removes its menu links.`
                      )
                    )
                      return
                    await t.onDelete?.()
                    queryClient.invalidateQueries()
                  }}
                >
                  ×
                </button>
              ) : null}
              <a
                href={t.listHref}
                title={`${t.count} ${t.label} pages`}
                className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
              >
                {t.count}
              </a>
            </div>
            {/* One numbered link per page: edit its own content; "view" opens its slug URL. */}
            <div className="flex flex-wrap justify-center gap-1">
              {(t.entries ?? []).map((e, i) => (
                <span
                  key={e.href}
                  className="inline-flex items-center overflow-hidden rounded border text-[10px]"
                >
                  <a
                    href={e.href}
                    title={`Edit ${e.name}`}
                    className="px-1.5 py-0.5 hover:bg-gray-100"
                  >
                    {i + 1}
                  </a>
                  {e.publicHref ? (
                    <a
                      href={e.publicHref}
                      target="_blank"
                      rel="noreferrer"
                      title={e.publicHref}
                      className="border-l px-1 py-0.5 hover:bg-gray-100"
                    >
                      ↗
                    </a>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <WebsiteLayoutPreview projectId={projectId} />
    </div>
  )
}
