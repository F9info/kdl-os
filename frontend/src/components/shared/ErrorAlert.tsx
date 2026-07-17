import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn, getErrorMessage } from '@/lib/utils'

export { getErrorMessage }

interface ErrorAlertProps {
  error: unknown
  className?: string
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
