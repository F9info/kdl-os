'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center px-4">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="font-medium">Something went wrong.</p>
      <p className="text-sm text-muted-foreground max-w-md">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
