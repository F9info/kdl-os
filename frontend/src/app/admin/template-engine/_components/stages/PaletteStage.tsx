'use client'

import { Palette } from 'lucide-react'
import { useAdvanceStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function PaletteStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'PALETTE')
  const advance = useAdvanceStage(run.id)

  const outputRef = stage?.outputRef as
    { paletteVersion?: number; swatchCount?: number } | null | undefined

  return (
    <StageShell
      title="Palette Extraction"
      description="Deterministic colour extraction from the uploaded logo — dominant colours, OKLCH ramps, and contrast ratios. No AI involved; this is algorithmic."
      stage={stage ?? null}
      onRun={() => advance.mutate('PALETTE')}
      isRunning={advance.isPending}
    >
      {outputRef?.paletteVersion != null ? (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-primary" />
            Extracted palette (v{outputRef.paletteVersion})
          </div>
          {outputRef.swatchCount != null && (
            <p className="text-xs text-muted-foreground">
              {outputRef.swatchCount} colour swatches extracted. Full palette available in the
              brand-kit module.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Palette className="h-4 w-4 shrink-0" />
          <span>
            Palette not yet extracted. Run this stage after Intake is complete and a logo is
            uploaded.
          </span>
        </div>
      )}
    </StageShell>
  )
}
