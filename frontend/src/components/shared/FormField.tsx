import React, { useId } from 'react'
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

export function FormField({ label, error, required, children, hint, className }: FormFieldProps) {
  const uid = useId()
  const fieldId = `field-${uid}`
  const errorId = `error-${uid}`
  const hintId = `hint-${uid}`

  let child = children
  if (React.Children.count(children) === 1 && React.isValidElement(children)) {
    const existingAriaDescribedBy = (children.props as Record<string, unknown>)[
      'aria-describedby'
    ] as string | undefined
    const ariaDescribedBy = error
      ? [existingAriaDescribedBy, errorId].filter(Boolean).join(' ')
      : hint
        ? [existingAriaDescribedBy, hintId].filter(Boolean).join(' ')
        : existingAriaDescribedBy

    child = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      id: (children.props as Record<string, unknown>).id ?? fieldId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': ariaDescribedBy || undefined,
    })
  }

  const resolvedChildId = React.isValidElement(children)
    ? (((children.props as Record<string, unknown>).id as string | undefined) ?? fieldId)
    : fieldId

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={resolvedChildId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {child}
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
