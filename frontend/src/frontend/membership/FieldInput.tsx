'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/FormField'
import type { FormField as FieldDef } from './types'

export function optionsOf(o: unknown): { value: string; label: string }[] {
  if (!Array.isArray(o)) return []
  return o.map((x) =>
    typeof x === 'object' && x
      ? {
          value: String((x as { value?: unknown }).value ?? ''),
          label: String((x as { label?: unknown }).label ?? (x as { value?: unknown }).value ?? ''),
        }
      : { value: String(x), label: String(x) }
  )
}

interface Props {
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  error?: string
}

/** Renders one profile field from its API definition (type, options, required). */
export function FieldInput({ field, value, onChange, error }: Props) {
  const str = value == null ? '' : String(value)
  let control: React.ReactNode
  switch (field.type) {
    case 'TEXTAREA':
      control = <Textarea value={str} onChange={(e) => onChange(e.target.value)} />
      break
    case 'SELECT':
      control = (
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          {optionsOf(field.options).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
      break
    case 'BOOLEAN':
      control = (
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
      break
    default: {
      const type =
        { NUMBER: 'number', DATE: 'date', EMAIL: 'email', PHONE: 'tel', URL: 'url' }[field.type] ??
        'text'
      control = <Input type={type} value={str} onChange={(e) => onChange(e.target.value)} />
    }
  }
  return (
    <FormField label={field.label} required={field.required} error={error}>
      {control}
    </FormField>
  )
}

/** Required fields of the packs that are still empty: key -> message. */
export function missingRequired(
  groups: { fields: FieldDef[] }[],
  values: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const g of groups)
    for (const f of g.fields)
      if (
        f.required &&
        (values[f.key] === undefined || values[f.key] === '' || values[f.key] === false)
      )
        out[f.key] = `${f.label} is required`
  return out
}
