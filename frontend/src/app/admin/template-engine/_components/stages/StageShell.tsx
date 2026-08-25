'use client'

import { CheckCircle2, AlertCircle, Loader2, Clock, Play, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TemplateEngineStage } from '@/types/template-engine.types'

interface StageShellProps {
  title: string
  description: string
  stage: TemplateEngineStage | null
  children?: React.ReactNode
  onRun?: () => void
  onSkip?: () => void
  isRunning?: boolean
  hideRunButton?: boolean
  runDisabled?: boolean
  // Hides the title/description/status-badge row — for stages whose own
  // content already covers that (e.g. WebsiteStage's "Brands" heading).
  hideHeader?: boolean
}

export function StageShell({
  title,
  description,
  stage,
  children,
  onRun,
  onSkip,
  isRunning,
  hideRunButton,
  runDisabled,
  hideHeader,
}: StageShellProps) {
  const status = stage?.status ?? 'PENDING'
  const errorCode = stage?.errorCode ?? null

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <StageBadge status={status} />
        </div>
      )}

      {errorCode && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Stage failed: {errorCode}
            </p>
            {errorCode === 'INSUFFICIENT_CREDITS' && (
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                Your project balance is too low for this operation. Top up credits and try again.
              </p>
            )}
          </div>
        </div>
      )}

      {children}

      {!hideRunButton && (
        <div className="flex items-center gap-3 pt-2">
          {onRun && (
            <Button
              onClick={onRun}
              disabled={isRunning || runDisabled || status === 'DONE' || status === 'RUNNING'}
              size="sm"
            >
              {isRunning || status === 'RUNNING' ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Running…
                </>
              ) : status === 'DONE' ? (
                <>
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                  Complete
                </>
              ) : status === 'FAILED' ? (
                <>
                  <Play className="mr-2 h-3.5 w-3.5" />
                  Retry
                </>
              ) : (
                <>
                  <Play className="mr-2 h-3.5 w-3.5" />
                  Run stage
                </>
              )}
            </Button>
          )}
          {onSkip && status === 'FAILED' && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <SkipForward className="mr-2 h-3.5 w-3.5" />
              Skip
            </Button>
          )}
          {stage?.startedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stage.completedAt
                ? `Completed ${formatRelative(stage.completedAt)}`
                : `Started ${formatRelative(stage.startedAt)}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function StageBadge({ status }: { status: TemplateEngineStage['status'] }) {
  const config: Record<
    TemplateEngineStage['status'],
    { label: string; className: string; icon: React.ReactNode }
  > = {
    PENDING: {
      label: 'Pending',
      className: 'bg-muted text-muted-foreground',
      icon: <Clock className="h-3 w-3" />,
    },
    RUNNING: {
      label: 'Running',
      className: 'bg-primary/10 text-primary',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    AWAITING_INPUT: {
      label: 'Needs attention',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    DONE: {
      label: 'Done',
      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    FAILED: {
      label: 'Failed',
      className: 'bg-destructive/10 text-destructive',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    SKIPPED: {
      label: 'Skipped',
      className: 'bg-muted text-muted-foreground',
      icon: <SkipForward className="h-3 w-3" />,
    },
  }

  const { label, className, icon } = config[status] ?? config.PENDING

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        className
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
