'use client'

import { useEffect, useRef, useState } from 'react'
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
import type { TemplateEngineRun } from '@/types/template-engine.types'
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

export function WebsiteStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'WEBSITE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const skip = useSkipStage(run.id, run.projectId)
  const { data: brandKit } = useBrandKit(run.projectId)
  const patchTypography = usePatchTypography(run.projectId)
  const [openBrand, setOpenBrand] = useState<(typeof BRAND_CARDS)[number]['key'] | null>(null)
  const [webAppStep, setWebAppStep] = useState<'typography' | 'assemble'>('typography')

  const outputRef = stage?.outputRef as { pageIds?: Record<string, string> } | null | undefined
  const pageCount = outputRef?.pageIds ? Object.keys(outputRef.pageIds).length : 0

  function openWebApp() {
    setOpenBrand('webapp')
    // A prior visit's Next click already saved typography — skip straight to
    // the assemble view instead of re-showing a step that's already done.
    setWebAppStep(brandKit?.typography ? 'assemble' : 'typography')
  }

  return (
    <StageShell
      title="Website Assembly"
      description="Seed website pages from Puck component packs filtered by industry, using the approved brand kit as slot defaults. Pages are created in the page-builder engine."
      stage={stage ?? null}
      hideHeader
      hideRunButton={openBrand === null || webAppStep === 'typography'}
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

          {webAppStep === 'typography' ? (
            <WebAppTypographyStep
              typography={brandKit?.typography ?? null}
              isSaving={patchTypography.isPending}
              onNext={(typography) =>
                patchTypography.mutate(typography, { onSuccess: () => setWebAppStep('assemble') })
              }
            />
          ) : pageCount > 0 ? (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-primary" />
                {pageCount} page{pageCount !== 1 ? 's' : ''} assembled
              </div>
              <p className="text-xs text-muted-foreground">
                Pages are live in the page-builder engine. Direct editing is disabled while Studio
                is active — use the page-builder screen to preview.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/page-builder" target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Preview in page builder
                </a>
              </Button>
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

// Backend brand-kit/tokens.js reads typography.heading.family / .body.family
// as single values, not a list — despite the prototype's "pick one or more"
// checkbox wording, only one font per role is ever actually consumed. Tiles
// behave as an exclusive choice (selecting one deselects the rest) rather
// than a true multi-select, to stay honest about what gets saved.
function WebAppTypographyStep({
  typography,
  isSaving,
  onNext,
}: {
  typography: { heading: { family: string } | null; body: { family: string } | null } | null
  isSaving: boolean
  onNext: (typography: { heading: { family: string }; body: { family: string } }) => void
}) {
  const [heading, setHeading] = useState(typography?.heading?.family || HEADING_FONTS[0]!)
  const [body, setBody] = useState(typography?.body?.family || BODY_FONTS[0]!)
  const [headingOptions, setHeadingOptions] = useState<string[]>(() =>
    dedupePrepend(HEADING_FONTS, typography?.heading?.family)
  )
  const [bodyOptions, setBodyOptions] = useState<string[]>(() =>
    dedupePrepend(BODY_FONTS, typography?.body?.family)
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
        onSelect={setHeading}
        onAddGoogleFont={(name) => {
          setHeadingOptions((prev) => dedupePrepend(prev, name))
          setHeading(name)
        }}
        onUpload={(name, url) => {
          loadCustomFontFace(name, url)
          setHeadingOptions((prev) => dedupePrepend(prev, name))
          setHeading(name)
        }}
      />

      <FontRoleSection
        label="Body"
        options={bodyOptions}
        selected={body}
        onSelect={setBody}
        onAddGoogleFont={(name) => {
          setBodyOptions((prev) => dedupePrepend(prev, name))
          setBody(name)
        }}
        onUpload={(name, url) => {
          loadCustomFontFace(name, url)
          setBodyOptions((prev) => dedupePrepend(prev, name))
          setBody(name)
        }}
      />

      <div className="flex justify-end">
        <Button
          onClick={() => onNext({ heading: { family: heading }, body: { family: body } })}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Next'}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function dedupePrepend(options: string[], name: string | undefined | null): string[] {
  if (!name || options.includes(name)) return options
  return [name, ...options]
}

interface CustomFontRow {
  id: number
  value: string
}

function FontRoleSection({
  label,
  options,
  selected,
  onSelect,
  onAddGoogleFont,
  onUpload,
}: {
  label: string
  options: string[]
  selected: string
  onSelect: (name: string) => void
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
      <p className="text-xs font-medium text-muted-foreground">{label} — pick one (1 selected)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((name) => (
          <FontTile
            key={name}
            name={name}
            selected={name === selected}
            onSelect={() => onSelect(name)}
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
