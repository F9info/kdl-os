'use client'

import { Sparkles, CreditCard } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useAdvanceStage, useRetryStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

interface CreditsBalance {
  balance: number
  currency: string
}

export function InferenceStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'INFERENCE')
  const advance = useAdvanceStage(run.id)
  const retry = useRetryStage(run.id)

  const { data: credits } = useQuery({
    queryKey: ['credits', 'balance', run.projectId],
    queryFn: () =>
      api
        .get<{ success: boolean; data: CreditsBalance }>(
          `/credits/projects/${run.projectId}/balance`
        )
        .then((r) => r.data.data)
        .catch(() => null),
    staleTime: 30_000,
  })

  const outputRef = stage?.outputRef as
    { inferenceVersion?: number; typographyPair?: string } | null | undefined

  return (
    <StageShell
      title="Brand Inference"
      description="AI-powered typography pairing, tone analysis, and brand strategy copy — driven by the extracted palette and intake details."
      stage={stage ?? null}
      onRun={
        stage?.status === 'FAILED'
          ? () => retry.mutate('INFERENCE')
          : () => advance.mutate('INFERENCE')
      }
      isRunning={advance.isPending || retry.isPending}
    >
      <div className="space-y-4">
        {credits != null && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              Project balance:{' '}
              <span className="font-medium text-foreground">{credits.balance}</span>{' '}
              {credits.currency}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Display only — not a gate</span>
          </div>
        )}

        {outputRef?.inferenceVersion != null ? (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Inference complete (v{outputRef.inferenceVersion})
            </div>
            {outputRef.typographyPair && (
              <p className="text-xs text-muted-foreground">
                Typography pair: <span className="font-medium">{outputRef.typographyPair}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Full inference output (tone, strategy, typography) is available in the brand-kit
              module.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Inference not yet run. This is the paid stage — credit hold is applied inside the
              brand-kit module when the stage runs.
            </span>
          </div>
        )}
      </div>
    </StageShell>
  )
}
