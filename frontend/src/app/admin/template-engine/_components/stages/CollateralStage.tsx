'use client'

import { Layers, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdvanceStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

const ARTIFACTS = ['Visiting Card', 'Letterhead', 'T-shirt', 'ID Card']

export function CollateralStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'COLLATERAL')
  const advance = useAdvanceStage(run.id)

  const outputRef = stage?.outputRef as
    { renderIds?: string[]; downloadUrls?: string[] } | null | undefined

  return (
    <StageShell
      title="Collateral"
      description="Render branded collateral artifacts — visiting card, letterhead, t-shirt, and ID card — as PDF and Word exports. Parallel with guidelines and website."
      stage={stage ?? null}
      onRun={() => advance.mutate('COLLATERAL')}
      isRunning={advance.isPending}
    >
      <div className="space-y-3">
        {outputRef?.renderIds && outputRef.renderIds.length > 0 ? (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-primary" />
              {outputRef.renderIds.length} artifact{outputRef.renderIds.length !== 1 ? 's' : ''}{' '}
              rendered
            </div>
            {outputRef.downloadUrls?.map((url, i) => (
              <Button key={i} variant="outline" size="sm" asChild className="mr-2 mb-1">
                <a href={url} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-3.5 w-3.5" />
                  {ARTIFACTS[i] ?? `Artifact ${i + 1}`}
                </a>
              </Button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-w-sm">
            {ARTIFACTS.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                {name}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Collateral renders use credits (deducted inside the collateral module). Requires brand
          approval (stage 4).
        </p>
      </div>
    </StageShell>
  )
}
