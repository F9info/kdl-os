import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean
  /** Set when an ancestor already owns the aria-live/status announcement
   *  (e.g. LoadingState) so the spinner doesn't announce a second, redundant
   *  "Loading" region. */
  ariaHidden?: boolean
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
}

export function LoadingSpinner({ size = 'md', fullPage = false, ariaHidden = false }: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={cn(
        'animate-spin rounded-full border-muted border-t-primary',
        sizeClasses[size]
      )}
      role={ariaHidden ? undefined : 'status'}
      aria-hidden={ariaHidden || undefined}
      aria-label={ariaHidden ? undefined : 'Loading'}
    />
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}
