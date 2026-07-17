import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, getErrorMessage } from '@/lib/utils'

export interface ErrorStateProps {
  title?: string
  /** Overrides the message derived from `error` when set. */
  description?: string
  error?: unknown
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * Use for a query/mutation that failed (block-level, not inline form
 * validation — ErrorAlert still owns that). Pass `error` (axios error, Error,
 * or string) and it extracts the message the same way ErrorAlert does.
 * See components/ui/STATE_KIT.md.
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  const message = description ?? getErrorMessage(error)
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-4 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message && <p className="text-sm text-muted-foreground max-w-sm">{message}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
