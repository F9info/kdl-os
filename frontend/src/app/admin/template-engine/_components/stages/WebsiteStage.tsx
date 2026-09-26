'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Globe,
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import {
  MAX_DEPTH as NAV_MAX_DEPTH,
  moveNode as moveNavNode,
  flattenForApi as flattenNavForApi,
  type DropZone as NavDropZone,
  type MenuItemNode as NavNode,
} from '@/app/admin/menus/_tree'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { cn } from '@/lib/utils'
import { loadGoogleFont, loadCustomFontFace } from '@/lib/load-google-font'
import { websiteLayoutStorageKey, mergeLayoutSelection } from '@/lib/website-layout-overrides'
import {
  useAdvanceStage,
  useBrandKit,
  usePatchTypography,
  useRetryStage,
  useSkipStage,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { WebsiteLayoutPreview } from '../WebsiteLayoutPreview'
import type { BrandKitTypography, TemplateEngineRun } from '@/types/template-engine.types'
import type { Media } from '@/types/media.types'

// Mirrors the design prototype's "Brands" grid (a card per brand surface —
// web app, admin app, visiting card, letterhead, t-shirt, ID card). Only
// "Web app" is wired up so far — per explicit instruction, ship one card's
// flow before adding the rest (roadmap row 4a; the other cards are rows 4b/4c,
// not yet spec'd). Unimplemented cards are intentionally omitted rather than
// shown disabled — nothing to click through to yet.
const BRAND_CARDS = [{ key: 'webapp', name: 'Web app' }] as const

// Curated starter sets matching the prototype's Web app Typography screen.
const HEADING_FONTS = ['Poppins', 'Inter', 'Manrope', 'Space Grotesk']
const BODY_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Work Sans']

// Web app step progress (which step you're on, type-scale edits, nav page
// picks) is session-local — none of it round-trips through the brand kit —
// so a refresh used to drop you back at the Brands grid mid-flow. Persisting
// it to localStorage, scoped per project, keeps you on the same step/edits
// across a refresh without adding backend/schema work for state that's
// still just in-progress UI, not saved brand data.
function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // best-effort — a private window or full storage shouldn't break the UI
  }
}

export function WebsiteStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'WEBSITE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const skip = useSkipStage(run.id, run.projectId)
  const { data: brandKit } = useBrandKit(run.projectId)
  const patchTypography = usePatchTypography(run.projectId)
  const uiStateKey = `te-website-ui:${run.projectId}`
  const [openBrand, setOpenBrand] = useState<(typeof BRAND_CARDS)[number]['key'] | null>(
    () =>
      readLocal(uiStateKey, { openBrand: null as (typeof BRAND_CARDS)[number]['key'] | null })
        .openBrand
  )
  const [webAppStep, setWebAppStep] = useState<
    'typography' | 'fontSettings' | 'navigation' | 'assemble'
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
  const pageCount = outputRef?.pageIds?.length ?? pages.length
  // Sector detail pages (Showrooms, Hotel, Hospital…) are real assembled
  // pages too — each one auto-created and linked via the Sectors module
  // (backend/src/modules/sectors/) — but live in their own table, not
  // outputRef.pageKeyToId, so they need their own fetch to show up
  // alongside Home/About/Contact in this same grid rather than being
  // invisible from this screen (only reachable via the separate
  // /admin/sectors page otherwise).
  const { data: sectorPages } = useQuery({
    queryKey: ['sectors-for-pages-grid', run.projectId],
    queryFn: () =>
      api.get('/sectors', { params: { project_id: run.projectId } }).then(
        (r) =>
          r.data.data.items as {
            id: string
            name: string
            detail_page_id: string | null
          }[]
      ),
  })
  // Page slugs are deterministic (`te-{runId}-{key}`, set by the website
  // driver — see template-engine/drivers/index.js's `seedPages`), so the
  // real public Home URL can be computed here with no extra fetch. Prefers
  // the "home" key; falls back to whatever page exists first for a run
  // that genuinely has no Home page.
  const demoHomeKey = pages.find(([key]) => key === 'home')?.[0] ?? pages[0]?.[0]
  const demoSiteHref = demoHomeKey ? `/p/te-${run.id}-${demoHomeKey}` : null
  // Older runs (before navigationPages existed) have no pageKeyToTitle —
  // every key was its title lowercased then, so capitalizing the key alone
  // still matches ('home' -> 'Home').
  function pageLabel(key: string) {
    return outputRef?.pageKeyToTitle?.[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
  }

  function openWebApp() {
    setOpenBrand('webapp')
    setWebAppStep('typography')
  }

  // Navigation writes its selection straight to localStorage (no API call
  // of its own) — read it here, the one place that actually triggers page
  // generation, so a run builds the pages the user picked instead of always
  // the default Home/About/Contact set.
  function runWebsiteAssembly() {
    const navigationPages = readLocal<string[]>(`te-website-ui:${run.projectId}:navigation`, [])
    // Without this, a page only ever touched through Navigation (not the
    // dedicated Website Layout page) never gets a header/footer design
    // applied at all — it's built from the seeder's raw, unbranded
    // NavBar/Footer instead of the project's actual chosen
    // ConstructionHeader/Footer, and looks like a different site. Reading
    // the same stored selection the Layout page itself uses keeps every
    // page in sync with whatever design is actually configured.
    const layout = mergeLayoutSelection(readLocal(websiteLayoutStorageKey(run.projectId), {}))
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
              Your brand surfaces. Click a card to open it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BRAND_CARDS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={openWebApp}
                className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="text-sm font-semibold">{b.name}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
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
              onNext={(typography) =>
                patchTypography.mutate(typography, {
                  onSuccess: (updatedKit) => {
                    setSavedTypography(updatedKit.typography)
                    setWebAppStep('fontSettings')
                  },
                })
              }
            />
          ) : webAppStep === 'fontSettings' ? (
            <FontSettingsStep
              projectId={run.projectId}
              typography={savedTypography ?? brandKit?.typography ?? null}
              onBack={() => setWebAppStep('typography')}
              onNext={() => setWebAppStep('navigation')}
            />
          ) : webAppStep === 'navigation' ? (
            <NavigationStep
              projectId={run.projectId}
              runId={run.id}
              onBack={() => setWebAppStep('fontSettings')}
              onNext={() => {
                pendingRegenRef.current = true
                setWebAppStep('assemble')
              }}
            />
          ) : pageCount > 0 ? (
            <div className="space-y-3">
              <LayoutSettingsPanel
                projectId={run.projectId}
                editHref={`/admin/template-engine/projects/${run.projectId}/website/layout`}
                detailPageTypes={[
                  {
                    label: 'Sector detail',
                    count: sectorPages?.length ?? 0,
                    href: `/admin/sectors?projectId=${run.projectId}`,
                  },
                ]}
              />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Web app · Pages</h3>
                  <p className="text-sm text-muted-foreground">
                    {advance.isPending
                      ? 'Updating pages for your latest selection…'
                      : `${pageCount} page${pageCount !== 1 ? 's' : ''} assembled in the page-builder engine. Open a page to edit it, or view all pages to step through the whole site.`}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map(([key, id]) => (
                  <div key={id} className="overflow-hidden rounded-lg border bg-card">
                    <div className="h-1.5 bg-gradient-to-r from-primary to-secondary" />
                    <div className="flex min-h-[110px] flex-col gap-2 p-4">
                      <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Page
                      </span>
                      <b className="text-sm">{pageLabel(key)}</b>
                      <Button size="sm" asChild className="mt-auto w-fit">
                        <a
                          href={`/admin/template-engine/edit/${id}?projectId=${run.projectId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Globe className="h-4 w-4 shrink-0" />
              <span>
                No pages assembled yet. Requires brand approval (stage 4) and the relevant component
                pack for your industry.
              </span>
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
  onNext: (typography: {
    heading: { family: string; families: string[] }
    body: { family: string; families: string[] }
  }) => void
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

  return (
    <div className="rounded-lg border bg-card p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Web app</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Digital
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Pick the heading and body fonts for this surface, then continue with Next.
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

      <div className="flex justify-end">
        <Button
          onClick={() =>
            onNext({
              heading: { family: heading[0]!, families: heading },
              body: { family: body[0]!, families: body },
            })
          }
          disabled={isSaving || heading.length === 0 || body.length === 0}
        >
          {isSaving ? 'Saving…' : 'Next'}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
}: {
  projectId: string
  typography: {
    heading: { family: string; families?: string[] } | null
    body: { family: string; families?: string[] } | null
  } | null
  onBack: () => void
  onNext: () => void
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
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={onNext}>
              Next
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
  detailPageTypes?: { label: string; count: number; href: string }[]
}) {
  const availableDetailTypes = detailPageTypes.filter((t) => t.count > 0)

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
      {availableDetailTypes.map((t) => (
        <a
          key={t.label}
          href={t.href}
          className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          Layout {t.label} ({t.count})
        </a>
      ))}
      <WebsiteLayoutPreview projectId={projectId} />
    </div>
  )
}

// Mirrors the design prototype's Navigation step page suggestions.
const SUGGESTED_PAGES = [
  'Home',
  'About',
  'Services',
  'Service detail',
  'Products',
  'Product detail',
  'Pricing',
  'Portfolio',
  'Portfolio detail',
  'Blog',
  'Blog detail',
  'Team',
  'Team member',
  'Careers',
  'Job detail',
  'Gallery',
  'Testimonials',
  'Contact',
  'FAQ',
  'Privacy Policy',
  'Terms',
  'Admin panel',
  'Settings',
]

// Same "header" Menu the Menus admin module (`/admin/menus`) and
// `ConstructionHeader` read at render time — editing navigation in this
// wizard step IS editing the live site's real nav, not a separate local
// draft. (A previous version of this step only wrote a flat list to
// localStorage and never touched the real Menu/MenuItem tables, so
// changes made here never appeared on the actual header.)
const NAV_MENU_KEY = 'header'
const NAV_MENU_NAME = 'Header Navigation'

interface WizardMenu {
  id: string
  project_id: string | null
  key: string
  name: string
  items: NavNode[]
}

function navFindByLabel(nodes: NavNode[], label: string): NavNode | null {
  for (const n of nodes) {
    if (n.label === label) return n
    const found = navFindByLabel(n.children, label)
    if (found) return found
  }
  return null
}

function navContainsLabel(nodes: NavNode[], label: string): boolean {
  return navFindByLabel(nodes, label) !== null
}

/** Depth-first labels, for the flat `navigationPages: string[]` the backend scaffolding contract expects — nesting here is real-Menu-only. */
function navFlattenLabels(nodes: NavNode[]): string[] {
  return nodes.flatMap((n) => [n.label, ...navFlattenLabels(n.children)])
}

// Mirrors backend/src/shared/utils/slug.js's `slugify` exactly — the
// website driver derives every assembled page's slug this way
// (`te-{runId}-{key}`), so a menu item created here for a page name needs
// the identical algorithm to link to the real page instead of a dead `#`.
function slugifyLikeBackend(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function NavigationStep({
  projectId,
  runId,
  onBack,
  onNext,
}: {
  projectId: string
  runId: string
  onBack: () => void
  onNext: () => void
}) {
  const storageKey = `te-website-ui:${projectId}:navigation`
  const queryClient = useQueryClient()
  const menuQueryKey = ['menu', projectId, NAV_MENU_KEY]

  const { data: menu } = useQuery({
    queryKey: menuQueryKey,
    queryFn: () =>
      api
        .post('/menus/ensure', { project_id: projectId, key: NAV_MENU_KEY, name: NAV_MENU_NAME })
        .then((r) => r.data.data.menu as WizardMenu),
    enabled: Boolean(projectId),
  })

  // Local, editable copy of the tree — drag-and-drop mutates this
  // instantly for a responsive feel, `dirty` stops a background refetch
  // from clobbering an in-flight edit before its own mutation resolves.
  const [tree, setTree] = useState<NavNode[]>([])
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (menu && !dirty) setTree(menu.items)
  }, [menu, dirty])

  const invalidate = () => {
    setDirty(false)
    queryClient.invalidateQueries({ queryKey: menuQueryKey })
    // `useHeaderMenuTree` (ConstructionHeader, WebsiteLayoutPreview,
    // useLayoutChrome) reads this same Menu under its own cache key —
    // without invalidating it too, those previews keep showing whatever
    // they last fetched until an unrelated remount happens to refire it.
    queryClient.invalidateQueries({ queryKey: ['menu-public-header', projectId] })
  }

  const createItemMutation = useMutation({
    mutationFn: (body: { label: string; order: number }) =>
      api.post(`/menus/${menu!.id}/items`, {
        ...body,
        link_type: 'custom',
        // Doesn't account for the resolveSeedPages dedup suffix
        // (`-2`, `-3`, ...) the backend applies when the same label
        // appears twice in one run — rare, and worth a wrong link over
        // the complexity of replicating that counter here.
        url: `/p/te-${runId}-${slugifyLikeBackend(body.label) || 'page'}`,
      }),
    onSuccess: invalidate,
  })
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/items/${id}`),
    onSuccess: invalidate,
  })
  const saveOrderMutation = useMutation({
    mutationFn: (nodes: NavNode[]) =>
      api.patch(`/menus/${menu!.id}/items/reorder`, { items: flattenNavForApi(nodes) }),
    onSuccess: invalidate,
  })

  const [customName, setCustomName] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: NavDropZone } | null>(null)
  const selectedLabels = navFlattenLabels(tree)
  const extras = selectedLabels.filter((n) => !SUGGESTED_PAGES.includes(n))
  // No optimistic local update on add/remove/reorder below — every change
  // only ever reflects in `tree` once the server round-trip actually
  // completes and refetches. Without this, clicking a pill then reloading
  // (or clicking Next) before that request finishes silently drops the
  // change — it was never saved, but nothing on screen said so. This is
  // the one thing to actually watch/disable against, not a cosmetic spinner.
  const isSavingNav =
    createItemMutation.isPending || deleteItemMutation.isPending || saveOrderMutation.isPending

  // Disabling the in-app Back/Next/pill buttons stops navigating away
  // mid-save, but not an actual browser refresh/tab-close — that's a real
  // way to lose an add/remove/reorder that hasn't finished its round trip
  // yet, and is exactly what was reported ("added a page, refreshed, it
  // was gone"). The native confirm dialog is the only way to warn against
  // that specific case.
  useEffect(() => {
    if (!isSavingNav) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isSavingNav])

  // navigationPages still has to be a flat string[] for the site-scaffolding
  // driver's existing contract (which page rows get created) — that's
  // separate from, and unaffected by, the real Menu's nesting above.
  useEffect(() => {
    writeLocal(storageKey, selectedLabels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, tree])

  function togglePage(name: string) {
    if (!menu) return
    const existing = navFindByLabel(tree, name)
    setDirty(true)
    if (existing) deleteItemMutation.mutate(existing.id)
    else createItemMutation.mutate({ label: name, order: tree.length })
  }

  function addCustomPage() {
    const name = customName.trim()
    if (!name || !menu || navContainsLabel(tree, name)) return
    setDirty(true)
    createItemMutation.mutate({ label: name, order: tree.length })
    setCustomName('')
  }

  function removeNavNode(id: string) {
    setDirty(true)
    deleteItemMutation.mutate(id)
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function rowDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    const zone: NavDropZone = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
    setDropTarget({ id, zone })
  }

  function handleDrop(targetId: string, zone: NavDropZone) {
    if (!dragId) return
    const moved = moveNavNode(tree, dragId, targetId, zone)
    if (moved) {
      setTree(moved)
      setDirty(true)
      saveOrderMutation.mutate(moved)
    }
    setDragId(null)
    setDropTarget(null)
  }

  function renderNavRow(node: NavNode, depth: number) {
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.has(node.id)
    const isDropBefore = dropTarget?.id === node.id && dropTarget.zone === 'before'
    const isDropAfter = dropTarget?.id === node.id && dropTarget.zone === 'after'
    const isDropInside = dropTarget?.id === node.id && dropTarget.zone === 'inside'
    return (
      <div key={node.id}>
        {isDropBefore && <div className="mx-2 h-0.5 rounded bg-primary" />}
        <div
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragOver={(e) => rowDragOver(e, node.id)}
          onDragLeave={() => setDropTarget((t) => (t?.id === node.id ? null : t))}
          onDrop={() => handleDrop(node.id, dropTarget?.zone ?? 'after')}
          onDragEnd={() => {
            setDragId(null)
            setDropTarget(null)
          }}
          style={{ marginLeft: (depth - 1) * 24 }}
          className={cn(
            'flex items-center gap-1.5 rounded-md bg-primary py-1.5 pl-2 pr-1.5 text-xs font-semibold text-primary-foreground',
            isDropInside && 'ring-2 ring-primary ring-offset-1',
            dragId === node.id && 'opacity-40'
          )}
        >
          <button
            type="button"
            onClick={() => toggleCollapse(node.id)}
            className={cn('shrink-0', !hasChildren && 'invisible')}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab opacity-70" />
          <span className="flex-1 truncate">{node.label}</span>
          <button
            type="button"
            aria-label={`Remove ${node.label}`}
            onClick={() => removeNavNode(node.id)}
            className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/25 leading-none"
          >
            ✕
          </button>
        </div>
        {isDropAfter && <div className="mx-2 h-0.5 rounded bg-primary" />}
        {hasChildren && !isCollapsed && (
          <div className="space-y-1.5 pt-1.5">
            {node.children.map((c) => renderNavRow(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={isSavingNav}
        className="gap-1.5 px-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to type scale
      </Button>

      <div>
        <h3 className="text-base font-semibold">Web app · Navigation</h3>
        <p className="text-sm text-muted-foreground">
          Choose the pages this platform&apos;s navigation should include, or add your own.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Pages</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {selectedLabels.length} selected
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Common pages — tap to add</p>
          <div className="flex flex-wrap gap-2">
            {[...SUGGESTED_PAGES, ...extras].map((name) => {
              const on = selectedLabels.includes(name)
              return (
                <button
                  key={name}
                  type="button"
                  disabled={isSavingNav}
                  onClick={() => togglePage(name)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    on ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                  )}
                >
                  <span className="text-[11px]">{on ? '✓' : '+'}</span>
                  {name}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Input
              placeholder="Add a custom page (e.g. Case studies)"
              value={customName}
              disabled={isSavingNav}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomPage()}
            />
            <Button type="button" onClick={addCustomPage} disabled={isSavingNav}>
              Add
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Selected navigation</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                isSavingNav ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
              )}
            >
              {isSavingNav ? 'Saving…' : 'Live'}
            </span>
          </div>
          {isSavingNav && (
            <p className="text-xs text-amber-700">
              Saving your change — don&apos;t refresh or leave this step yet.
            </p>
          )}
          {tree.length > 0 ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                Drag a page onto another to nest it (up to {NAV_MAX_DEPTH} levels); drag to the
                top/bottom edge of a row to reorder instead.
              </p>
              <div className="space-y-1.5">{tree.map((n) => renderNavRow(n, 1))}</div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pages yet — pick from the list or add your own.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onNext} disabled={isSavingNav}>
          Next
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
