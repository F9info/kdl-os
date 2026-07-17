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

  // Inject id + error aria attrs into the wrapped control so <label htmlFor> works
  // and Input/Textarea pick up their aria-[invalid=true] destructive styling.
  // Explicit props on the child always win over injected ones.
  const control = isValidElement<AriaInvalidProps>(children)
    ? cloneElement(children, {
        id: children.props.id ?? fieldId,
        ...(error && {
          'aria-invalid': children.props['aria-invalid'] ?? true,
          'aria-describedby': children.props['aria-describedby'] ?? errorId,
        }),
      })
    : children

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={fieldId}>
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
