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
  id?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
  'aria-describedby'?: string
}

export function FormField({ label, error, required, children, hint, className }: FormFieldProps) {
  const fieldId = useId()
  const errorId = useId()
  const hintId = useId()

  // Inject id + aria attrs into the wrapped control so <label htmlFor> works
  // and Input/Textarea pick up their aria-[invalid=true] destructive styling.
  // Explicit props on the child always win over injected ones.
  const existingDescribedBy = isValidElement<AriaInvalidProps>(children)
    ? children.props['aria-describedby']
    : undefined

  const ariaDescribedBy = error
    ? [existingDescribedBy, errorId].filter(Boolean).join(' ') || undefined
    : hint
      ? [existingDescribedBy, hintId].filter(Boolean).join(' ') || undefined
      : existingDescribedBy

  const control = isValidElement<AriaInvalidProps>(children)
    ? cloneElement(children, {
        id: children.props.id ?? fieldId,
        'aria-describedby': ariaDescribedBy,
        ...(error && {
          'aria-invalid': children.props['aria-invalid'] ?? true,
        }),
      })
    : children

  const resolvedChildId = isValidElement<AriaInvalidProps>(children)
    ? (children.props.id ?? fieldId)
    : fieldId

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={resolvedChildId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
