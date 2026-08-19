'use client'

import { ClipboardCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { useAdvanceStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

interface PreflightResult {
  branch: string
  passed: boolean
  errors?: string[]
}

export function PreflightStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'PREFLIGHT')
  const advance = useAdvanceStage(run.id)

  const outputRef = stage?.outputRef as
    | { results?: PreflightResult[] }
    | null
    | undefined

  const results = outputRef?.results ?? []

  return (
    <StageShell
      title="Preflight"
      description="Pre-export checks aggregated from all pipeline branches. All branches must pass (or be explicitly skipped) before export is unlocked."
      stage={stage ?? null}
      onRun={() => advance.mutate('PREFLIGHT')}
      isRunning={advance.isPending}
    >
      {results.length > 0 ? (
        <div className="space-y-2 max-w-xl">
          {results.map((r) => (
            <div
              key={r.branch}
              className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
            >
              {r.passed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium capitalize">{r.branch}</p>
                {!r.passed && r.errors && (
                  <ul className="mt-1 space-y-0.5">
                    {r.errors.map((err, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {err}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <span>
            Preflight not yet run. All of stages 5–7 (guidelines, collateral, website) must be
            complete or skipped first.
          </span>
        </div>
      )}
    </StageShell>
  )
}
