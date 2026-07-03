import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  error: unknown
  className?: string
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (!error) return 'An unexpected error occurred'
  const e = error as { response?: { data?: { message?: string } }; message?: string }
  return e.response?.data?.message ?? e.message ?? 'An unexpected error occurred'
}

export function ErrorAlert({ error, className }: ErrorAlertProps) {
  if (!error) return null

  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
    </Alert>
  )
}
