'use client'

import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdvanceStage, useRetryStage, useSkipStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function GuidelinesStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'GUIDELINES')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const skip = useSkipStage(run.id, run.projectId)

  const outputRef = stage?.outputRef as
    { renderId?: string; downloadUrl?: string } | null | undefined

  return (
    <StageShell
      title="Brand Guidelines"
      description="Generate the brand-guidelines PDF from the approved brand kit. Parallel with collateral and website assembly."
      stage={stage ?? null}
      onRun={
        stage?.status === 'FAILED'
          ? () => retry.mutate('GUIDELINES')
          : () => advance.mutate('GUIDELINES')
      }
      onSkip={() => skip.mutate('GUIDELINES')}
      isRunning={advance.isPending || retry.isPending}
    >
      {outputRef?.renderId ? (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-primary" />
            Brand guidelines rendered
          </div>
          {outputRef.downloadUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={outputRef.downloadUrl} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-3.5 w-3.5" />
                Download PDF
              </a>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          <span>Brand guidelines PDF not yet generated. Requires brand approval (stage 4).</span>
        </div>
      )}
    </StageShell>
  )
}
