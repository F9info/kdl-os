import * as React from 'react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface LoadingStateProps {
  /** 'spinner' for short/unknown-shape waits, 'skeleton' when the eventual
   *  content's shape is known — see components/ui/STATE_KIT.md. */
  variant?: 'spinner' | 'skeleton'
  label?: string
  /** Number of skeleton lines rendered in 'skeleton' variant. */
  rows?: number
  className?: string
}

export function LoadingState({
  variant = 'spinner',
  label = 'Loading…',
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div role="status" aria-live="polite" className={cn('space-y-2', className)}>
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" aria-hidden="true" />
        ))}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}
    >
      <LoadingSpinner size="md" ariaHidden />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
