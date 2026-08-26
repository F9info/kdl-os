'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  ExternalLink,
  Plus,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { cn } from '@/lib/utils'
import { loadGoogleFont, loadCustomFontFace } from '@/lib/load-google-font'
import {
  useAdvanceStage,
  useBrandKit,
  usePatchTypography,
  useRetryStage,
  useSkipStage,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
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
    { pageIds?: string[]; pageKeyToId?: Record<string, string> } | null | undefined
  const pages = Object.entries(outputRef?.pageKeyToId ?? {})
  const pageCount = outputRef?.pageIds?.length ?? pages.length

  function openWebApp() {
    setOpenBrand('webapp')
    setWebAppStep('typography')
  }

  return (
    <StageShell
      title="Website Assembly"
      description="Seed website pages from Puck component packs filtered by industry, using the approved brand kit as slot defaults. Pages are created in the page-builder engine."
      stage={stage ?? null}
      hideHeader
      hideRunButton={openBrand === null || webAppStep !== 'assemble'}
      onRun={
        stage?.status === 'FAILED' ? () => retry.mutate('WEBSITE') : () => advance.mutate('WEBSITE')
      }
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
          {webAppStep !== 'fontSettings' && webAppStep !== 'navigation' && (
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
          )}

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
              onBack={() => setWebAppStep('fontSettings')}
              onNext={() => setWebAppStep('assemble')}
            />
          ) : pageCount > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Web app · Pages</h3>
                  <p className="text-sm text-muted-foreground">
                    {pageCount} page{pageCount !== 1 ? 's' : ''} assembled in the page-builder
                    engine. Direct editing is disabled while Studio is active — open a page to
                    preview it.
                  </p>
                </div>
                <Button size="sm" asChild>
                  <a
                    href={`/admin/page-builder/site?ids=${pages.map(([, id]) => id).join(',')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View all pages
                  </a>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map(([key, id]) => (
                  <div key={id} className="overflow-hidden rounded-lg border bg-card">
                    <div className="h-1.5 bg-gradient-to-r from-primary to-secondary" />
                    <div className="flex min-h-[110px] flex-col gap-2 p-4">
                      <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Page
                      </span>
                      <b className="text-sm">{key.charAt(0).toUpperCase() + key.slice(1)}</b>
                      <Button size="sm" asChild className="mt-auto w-fit">
                        <a href={`/admin/page-builder/${id}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Open page
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

function NavigationStep({
  projectId,
  onBack,
  onNext,
}: {
  projectId: string
  onBack: () => void
  onNext: () => void
}) {
  const storageKey = `te-website-ui:${projectId}:navigation`
  const [selected, setSelected] = useState<string[]>(() => readLocal(storageKey, [] as string[]))
  const [customName, setCustomName] = useState('')
  const extras = selected.filter((n) => !SUGGESTED_PAGES.includes(n))

  useEffect(() => {
    writeLocal(storageKey, selected)
  }, [storageKey, selected])

  function togglePage(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  function addCustomPage() {
    const name = customName.trim()
    if (!name || selected.includes(name)) return
    setSelected((prev) => [...prev, name])
    setCustomName('')
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5 px-2">
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
              {selected.length} selected
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Common pages — tap to add</p>
          <div className="flex flex-wrap gap-2">
            {[...SUGGESTED_PAGES, ...extras].map((name) => {
              const on = selected.includes(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => togglePage(name)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors',
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
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomPage()}
            />
            <Button type="button" onClick={addCustomPage}>
              Add
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Selected navigation</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Live
            </span>
          </div>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary py-1.5 pl-3 pr-1.5 text-xs font-semibold text-primary-foreground"
                >
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => togglePage(name)}
                    className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/25 leading-none"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pages yet — pick from the list or add your own.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Next
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
