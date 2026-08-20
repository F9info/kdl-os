'use client'

import { ShieldCheck, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdvanceStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function ApprovalStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'APPROVAL')
  const advance = useAdvanceStage(run.id, run.projectId)

  const outputRef = stage?.outputRef as
    { approvedAt?: string; brandKitVersion?: number; tokensWrittenAt?: string } | null | undefined

  const tokensWritten = !!outputRef?.tokensWrittenAt
  const approved = !!outputRef?.approvedAt

  return (
    <StageShell
      title="Brand Approval"
      description="Review the inferred brand and approve it. On approval, the orchestrator reads brand-kit tokens and writes them to the theme engine — making the brand live."
      stage={stage ?? null}
      hideRunButton
    >
      <div className="space-y-4 max-w-xl">
        {approved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
              <ShieldCheck className="h-4 w-4" />
              Brand approved (kit v{outputRef?.brandKitVersion})
            </div>
            {tokensWritten ? (
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                Theme tokens written to the theme engine.
              </p>
            ) : (
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                Writing theme tokens…
              </p>
            )}
          </div>
        )}

        {!approved && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                The brand kit tokens (typography, colours, spacing) from stage 3 will be written to
                the theme engine on your approval.
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              This is the only human-judgment gate. After approval, stages 5–7 run in parallel and
              cannot be undone without restarting the run.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={() => advance.mutate('APPROVAL')}
            disabled={advance.isPending || approved}
            size="sm"
            className="gap-2"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {approved ? 'Approved' : 'Approve brand'}
          </Button>
          {advance.isError && (
            <span className="text-xs text-destructive">
              {(advance.error as Error)?.message ?? 'Approval failed'}
            </span>
          )}
        </div>
      </div>
    </StageShell>
  )
}
