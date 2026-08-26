'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Palette, Pipette, Shuffle } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import {
  useAdvanceStage,
  useBrandKit,
  usePatchBrandKit,
  useRetryStage,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { rampFromHex, srgbToOklch, hexToRgb } from '@/lib/oklch-ramp'
import {
  DAG_STAGES,
  type BrandKitPalette,
  type PaletteColor,
  type PaletteRole,
  type TemplateEngineRun,
} from '@/types/template-engine.types'

// Display labels match the prototype's naming (Primary/Secondary/Tertiary/
// Quaternary) — these map onto the backend's real field names
// (primary/secondary/accent/neutral, see BrandKitPalette) at the `role` key,
// the label is purely cosmetic.
const ROLES: { role: PaletteRole; label: string }[] = [
  { role: 'primary', label: 'Primary' },
  { role: 'secondary', label: 'Secondary' },
  { role: 'accent', label: 'Tertiary' },
  { role: 'neutral', label: 'Quaternary' },
]

function randomHex(): string {
  const n = Math.floor(Math.random() * 0xffffff)
  return '#' + n.toString(16).padStart(6, '0')
}

const RAMP_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']

const FALLBACK_HEX = '#888888'

function colorFromHex(hex: string): PaletteColor {
  const { ramp, anchorStep } = rampFromHex(hex)
  const oklch = srgbToOklch(...hexToRgb(hex))
  return { hex, oklch, confidence: 1, ramp, anchorStep }
}

export function PaletteStage({ run }: { run: TemplateEngineRun }) {
  const router = useRouter()
  const stage = run.stages.find((s) => s.stage === 'PALETTE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const { data: brandKit } = useBrandKit(run.projectId)
  const patchPalette = usePatchBrandKit(run.projectId)

  const hasLogo = !!brandKit?.logo_media_id
  const { data: logoMedia } = useQuery({
    queryKey: ['media', brandKit?.logo_media_id],
    queryFn: () =>
      api
        .get(`/media/${brandKit!.logo_media_id}`)
        .then((r) => r.data.data.media as { url: string | null }),
    enabled: hasLogo,
  })

  const [edits, setEdits] = useState<Record<PaletteRole, PaletteColor> | null>(null)
  const [pickingRole, setPickingRole] = useState<PaletteRole | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const hasPalette = !!brandKit?.palette
  const extractionFailed = stage?.status === 'FAILED'

  // Seed local edit state from the extracted (or previously saved) palette.
  // Null roles (common for single-color logos) default to a neutral grey.
  // Also re-seeds from the real palette if a Retry (see below) succeeds after
  // the random-fallback branch already populated `edits`.
  const usedFallbackColorsRef = useRef(false)
  useEffect(() => {
    if (!brandKit?.palette) return
    if (edits && !usedFallbackColorsRef.current) return
    const seeded = {} as Record<PaletteRole, PaletteColor>
    for (const { role } of ROLES) {
      seeded[role] = brandKit.palette.colors[role] ?? colorFromHex(FALLBACK_HEX)
    }
    usedFallbackColorsRef.current = false
    setEdits(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandKit?.palette])

  // Two flows: the API extraction succeeds -> real sampled colours (above).
  // The API is unavailable/fails -> don't dead-end on an error; seed random
  // starter colours instead so the user can still build a palette via the
  // logo picker / randomize / manual hex entry below.
  useEffect(() => {
    if (!hasLogo || brandKit?.palette || edits || !extractionFailed) return
    const seeded = {} as Record<PaletteRole, PaletteColor>
    for (const { role } of ROLES) {
      seeded[role] = colorFromHex(randomHex())
    }
    usedFallbackColorsRef.current = true
    setEdits(seeded)
  }, [hasLogo, brandKit?.palette, edits, extractionFailed])

  // Auto-trigger extraction — no manual "Extract palette" click required.
  // Runs once per distinct logo while there's no palette yet. A FAILED stage
  // is never auto-retried — that always needs an explicit Retry click (see
  // the fallback banner below) so a persistently-bad logo doesn't refire on
  // every mount.
  const triggeredForLogoRef = useRef<string | null>(null)
  useEffect(() => {
    if (!hasLogo || hasPalette || extractionFailed) return
    if (advance.isPending) return
    const logoId = brandKit?.logo_media_id ?? null
    if (triggeredForLogoRef.current === logoId) return
    triggeredForLogoRef.current = logoId
    advance.mutate('PALETTE')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLogo, hasPalette, brandKit?.logo_media_id, extractionFailed])

  const isApproved = brandKit?.status === 'approved'

  function updateHex(role: PaletteRole, hex: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      // still let the user type freely; only regenerate once it's a valid 6-digit hex
      setEdits((prev) => (prev ? { ...prev, [role]: { ...prev[role], hex } } : prev))
      return
    }
    setEdits((prev) => (prev ? { ...prev, [role]: colorFromHex(hex) } : prev))
  }

  function startPicking(role: PaletteRole) {
    if (!hasLogo) return
    setPickingRole(role)
  }

  function handleLogoClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!pickingRole || !imgRef.current || !canvasRef.current) return
    const img = imgRef.current
    const canvas = canvasRef.current
    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)

    try {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
      const hex = '#' + [r!, g!, b!].map((v) => v.toString(16).padStart(2, '0')).join('')
      updateHex(pickingRole, hex)
    } catch {
      toast({
        title: 'Could not sample this image',
        description: 'Cross-origin image — type the hex value directly instead.',
        variant: 'destructive',
      })
    } finally {
      setPickingRole(null)
    }
  }

  function goToNextStage() {
    // The Studio nav only surfaces Overview/Color Palette/Brands (KDL-558) —
    // jump straight to Brands (WEBSITE) rather than the DAG's literal next
    // stage (Brand Inference), which has no visible tab. This only changes
    // where the browser navigates; it doesn't skip or auto-run the hidden
    // Inference/Approval/Guidelines/Collateral stages server-side — their
    // real gates (e.g. Brand Approval's human review) still apply wherever
    // they already did.
    const websiteDef = DAG_STAGES.find((s) => s.stage === 'WEBSITE')
    if (websiteDef)
      router.push(`/admin/template-engine/projects/${run.projectId}/${websiteDef.slug}`)
  }

  function handleSubmit() {
    if (!edits) return
    const palette: BrandKitPalette = {
      schemaVersion: brandKit?.palette?.schemaVersion ?? 1,
      // Random-fallback colours were never sampled from the logo — mark them
      // low confidence rather than inheriting a stale value.
      paletteConfidence: brandKit?.palette?.paletteConfidence ?? 'low',
      colors: edits,
    }
    patchPalette.mutate(palette, { onSuccess: goToNextStage })
  }

  return (
    <StageShell
      title="Palette Extraction"
      description="Deterministic colour extraction from the uploaded logo — dominant colours, OKLCH ramps, and contrast ratios. No AI involved; this is algorithmic."
      stage={stage ?? null}
      hideRunButton
    >
      <div className="space-y-4 w-full">
        {/* "Your logo" — always visible once a logo exists, independent of
            extraction status, so the user can see what will be (or was)
            sampled before/after clicking Extract. Click while "Pick from
            logo" is active (post-extraction only) to sample a pixel. */}
        {hasLogo && (
          <div className="rounded-lg border bg-card px-6 py-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Your logo</h3>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Source
              </span>
            </div>
            <div className="flex items-center gap-4">
              {logoMedia?.url && (
                // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO URL, and we need raw pixel access via canvas
                <img
                  ref={imgRef}
                  src={logoMedia.url}
                  alt="Brand logo"
                  crossOrigin="anonymous"
                  onClick={handleLogoClick}
                  className={`h-24 w-24 rounded-md border bg-white object-contain p-2 ${pickingRole ? 'cursor-crosshair ring-2 ring-primary' : ''}`}
                />
              )}
              <p className="text-xs text-muted-foreground max-w-sm">
                {pickingRole
                  ? `Click anywhere on the logo to sample a colour for ${ROLES.find((r) => r.role === pickingRole)?.label}.`
                  : hasPalette
                    ? 'The four colours below were sampled from this logo. To grab an exact colour, click "Pick from logo" on any group, then click anywhere on the logo.'
                    : 'This image is what palette extraction samples pixels from to build your colour groups.'}
              </p>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {!hasPalette && !(extractionFailed && edits) ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Palette className="h-4 w-4 shrink-0" />
              <span>
                {hasLogo
                  ? // Replacing the logo on Intake resets the brand kit to draft and clears the
                    // previously-extracted palette server-side (brand-kit/service.js uploadLogo) —
                    // this stage's DAG status can still read DONE from an earlier logo, but
                    // StageShell's own Run button disables once a stage is DONE. So this stage
                    // auto-triggers its own extraction instead of relying on StageShell's Run
                    // button, to stay working after a logo replace.
                    'Extracting palette from your logo…'
                  : 'Upload a logo on the Overview stage first — extraction needs one.'}
              </span>
            </div>
          </div>
        ) : (
          <>
            {isApproved && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                This brand kit is already approved — reopen it from the Brand Approval stage to edit
                the palette.
              </div>
            )}

            {!hasPalette && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <span>
                  Automatic extraction failed for this logo — showing random starter colours
                  instead. Edit them, use &quot;Pick from logo&quot;, or retry extraction.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate('PALETTE')}
                  className="shrink-0"
                >
                  {retry.isPending ? 'Retrying…' : 'Retry extraction'}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {edits &&
                ROLES.map(({ role, label }) => {
                  const color = edits[role]
                  return (
                    <div key={role} className="rounded-lg border bg-card px-6 py-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-sm border"
                            style={{ backgroundColor: color.hex }}
                          />
                          <h3 className="text-sm font-medium">{label}</h3>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-mono font-medium text-muted-foreground">
                          {color.hex.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={`${label} colour picker`}
                          value={/^#[0-9a-fA-F]{6}$/.test(color.hex) ? color.hex : FALLBACK_HEX}
                          disabled={isApproved}
                          onChange={(e) => updateHex(role, e.target.value)}
                          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border p-0.5 disabled:cursor-not-allowed"
                        />
                        <Input
                          aria-label={`${label} hex value`}
                          value={color.hex}
                          disabled={isApproved}
                          onChange={(e) => updateHex(role, e.target.value)}
                          className="font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isApproved || !hasLogo}
                          onClick={() => startPicking(role)}
                          className="shrink-0 gap-1.5"
                        >
                          <Pipette className="h-3.5 w-3.5" />
                          Pick from logo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isApproved}
                          onClick={() => updateHex(role, randomHex())}
                          className="shrink-0 gap-1.5"
                        >
                          <Shuffle className="h-3.5 w-3.5" />
                          Randomize
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Base colour — editing it regenerates the ramp below.
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {RAMP_STEPS.map((step) => (
                          <div key={step} className="flex flex-col items-center gap-1">
                            <span
                              className="h-10 w-10 rounded border"
                              style={{ backgroundColor: color.ramp[step] }}
                            />
                            <span className="text-[10px] text-muted-foreground">{step}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {color.ramp[step]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>

            <div className="rounded-lg border bg-card px-6 py-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Submit palette</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saves your edits and moves on to Brand Inference.
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={isApproved || patchPalette.isPending}>
                {patchPalette.isPending ? 'Saving…' : 'Next'}
              </Button>
            </div>
          </>
        )}
      </div>
    </StageShell>
  )
}
