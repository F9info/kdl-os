import { cloneElement, isValidElement, useId } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  hint?: string
  className?: string
}

interface AriaInvalidProps {
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
  'aria-describedby'?: string
}

export function FormField({ label, error, required, children, hint, className }: FormFieldProps) {
  const errorId = useId()

  // When error is set, mark the single wrapped control invalid so Input/Textarea
  // pick up their aria-[invalid=true] destructive styling. Explicit aria props on
  // the child win over the injected ones.
  const control =
    error && isValidElement<AriaInvalidProps>(children)
      ? cloneElement(children, {
          'aria-invalid': children.props['aria-invalid'] ?? true,
          'aria-describedby': children.props['aria-describedby'] ?? errorId,
        })
      : children

  return (
    <div className={cn('space-y-2', className)}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {control}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
