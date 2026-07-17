'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Next.js App Router error boundary — catches render/runtime errors thrown
// anywhere under /admin/media (e.g. a malformed API response) instead of
// crashing the whole admin shell.
export default function MediaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Media module error:', error)
  }, [error])

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-3 text-center px-4">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="font-medium">Something went wrong in the Media Library.</p>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
