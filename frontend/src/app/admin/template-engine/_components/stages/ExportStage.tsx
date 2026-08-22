'use client'

import { PackageCheck, Globe, FileText, Layers } from 'lucide-react'
import { useAdvanceStage, useRetryStage, useExportManifest } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function ExportStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'EXPORT')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)

  const isDone = stage?.status === 'DONE'
  const { data: manifest } = useExportManifest(isDone ? run.id : null, run.projectId)

  return (
    <StageShell
      title="Export"
      description="Produce the handoff manifest and download the guidelines + collateral archive. Theme and pages stay live in their engines — this is a read/aggregate operation."
      stage={stage ?? null}
      onRun={
        stage?.status === 'FAILED' ? () => retry.mutate('EXPORT') : () => advance.mutate('EXPORT')
      }
      isRunning={advance.isPending || retry.isPending}
    >
      {manifest ? (
        <div className="space-y-4 max-w-xl">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PackageCheck className="h-4 w-4 text-primary" />
              Export ready — run ID {manifest.runId.slice(0, 8)}…
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                {manifest.site.pageIds.length} assembled page
                {manifest.site.pageIds.length !== 1 ? 's' : ''} (live in page builder)
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                {manifest.guidelines?.renderId
                  ? `Brand guidelines PDF rendered (${manifest.guidelines.fileUrl ?? manifest.guidelines.renderId})`
                  : 'Brand guidelines stage skipped — no PDF'}
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" />
                {manifest.collateral?.renderIds?.length
                  ? `${manifest.collateral.renderIds.length} collateral artifact${
                      manifest.collateral.renderIds.length !== 1 ? 's' : ''
                    }`
                  : 'Collateral stage skipped — no artifacts'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <PackageCheck className="h-4 w-4 shrink-0" />
          <span>
            Export not yet complete. Requires preflight (stage 8) to pass first. Running export
            requires the <code className="text-xs">template-engine:export</code> permission.
          </span>
        </div>
      )}
    </StageShell>
  )
}
