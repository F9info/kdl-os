'use client'

import { useState } from 'react'
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useAdvanceStage,
  useRetryStage,
  useBrandKit,
  useApproveBrandKit,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function ApprovalStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'APPROVAL')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const { data: brandKit, isLoading: kitLoading } = useBrandKit(run.projectId)
  const approveBrandKit = useApproveBrandKit(run.projectId)

  const [ackedIds, setAckedIds] = useState<string[]>([])

  const outputRef = stage?.outputRef as
    { approvedAt?: string; brandKitVersion?: number; tokensWrittenAt?: string } | null | undefined

  const tokensWritten = !!outputRef?.tokensWrittenAt
  const stageApproved = !!outputRef?.approvedAt

  const adjustments = brandKit?.contrast_report?.adjustments ?? []
  const allAcked = adjustments.length === 0 || adjustments.every((a) => ackedIds.includes(a.id))

  const palette = brandKit?.palette?.colors

  function toggleAck(id: string) {
    setAckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleApprove() {
    if (stage?.status === 'FAILED') {
      retry.mutate('APPROVAL')
      return
    }
    try {
      await approveBrandKit.mutateAsync(ackedIds)
      advance.mutate('APPROVAL')
    } catch {
      // error surfaced via toast in hook
    }
  }

  const approveDisabled =
    advance.isPending ||
    retry.isPending ||
    approveBrandKit.isPending ||
    stageApproved ||
    (!allAcked && stage?.status !== 'FAILED')

  return (
    <StageShell
      title="Brand Approval"
      description="Review the inferred brand and approve it. On approval, the orchestrator reads brand-kit tokens and writes them to the theme engine — making the brand live."
      stage={stage ?? null}
      hideRunButton
    >
      <div className="space-y-4 max-w-xl">
        {stageApproved && (
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

        {!stageApproved && (
          <>
            {/* Palette preview */}
            {kitLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading brand kit…
              </div>
            ) : palette ? (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Brand palette
                </p>
                <div className="flex flex-wrap gap-3">
                  {(['primary', 'secondary', 'accent', 'neutral'] as const).map((role) => {
                    const color = palette[role]
                    if (!color) return null
                    return (
                      <div key={role} className="flex items-center gap-2">
                        <span
                          className="h-6 w-6 rounded border shadow-sm shrink-0"
                          style={{ backgroundColor: color.hex }}
                          title={color.hex}
                        />
                        <div>
                          <p className="text-xs font-medium capitalize">{role}</p>
                          <p className="text-xs font-mono text-muted-foreground">{color.hex}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Contrast report */}
            {!kitLoading && adjustments.length > 0 && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm font-medium">Contrast adjustments ({adjustments.length})</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  These colours fail WCAG AA as text on their surface. The derived token (shown
                  below) will be used in their place. Acknowledge each to enable approval.
                </p>
                <div className="space-y-2">
                  {adjustments.map((adj) => {
                    const acked = ackedIds.includes(adj.id)
                    return (
                      <label
                        key={adj.id}
                        aria-label={`Acknowledge: ${adj.reason}`}
                        className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-muted/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={acked}
                          onChange={() => toggleAck(adj.id)}
                          className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-block h-4 w-4 rounded border shrink-0"
                              style={{ backgroundColor: adj.original }}
                              title={`Original: ${adj.original}`}
                            />
                            <span className="text-xs font-mono text-muted-foreground">
                              {adj.original}
                            </span>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span
                              className="inline-block h-4 w-4 rounded border shrink-0"
                              style={{ backgroundColor: adj.derived }}
                              title={`Derived: ${adj.derived}`}
                            />
                            <span className="text-xs font-mono text-muted-foreground">
                              {adj.derived}
                            </span>
                            <span className="text-xs text-muted-foreground">({adj.tokenName})</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{adj.reason}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {allAcked && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    All adjustments acknowledged
                  </div>
                )}
              </div>
            )}

            {!kitLoading && adjustments.length === 0 && brandKit?.contrast_report && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                All colour pairs pass WCAG AA — no adjustments needed.
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleApprove}
                disabled={approveDisabled}
                size="sm"
                className="gap-2"
              >
                {approveBrandKit.isPending || advance.isPending || retry.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {stage?.status === 'FAILED'
                  ? 'Retry approval'
                  : approveBrandKit.isPending
                    ? 'Approving kit…'
                    : advance.isPending
                      ? 'Advancing…'
                      : 'Approve brand'}
              </Button>
              {!allAcked && adjustments.length > 0 && stage?.status !== 'FAILED' && (
                <span className="text-xs text-muted-foreground">
                  Acknowledge all contrast adjustments to continue
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </StageShell>
  )
}
