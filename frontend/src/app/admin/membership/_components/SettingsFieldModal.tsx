'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useAdminAction, type FieldDef, type FieldGroup } from '@/admin/hooks/useMembership'
import { fieldFormSchema, type FieldFormValues } from '../_billing-schemas'
import { BModal, ModalError, Segmented, ToggleRow } from './BillingBits'
import { NativeSelect } from './ui'

export const TYPE_LABEL: Record<string, string> = {
  TEXT: 'Text',
  TEXTAREA: 'Long text',
  NUMBER: 'Number',
  SELECT: 'Select',
  MULTISELECT: 'Multi-select',
  DATE: 'Date',
  BOOLEAN: 'Yes / No',
  EMAIL: 'Email',
  PHONE: 'Phone',
  URL: 'URL',
  FILE: 'File upload',
  GSTIN: 'GSTIN',
  PAN: 'PAN',
  PINCODE: 'Pincode',
}

type Extra = FieldDef & {
  validation?: { help_text?: string; check_format?: boolean; lookup_name?: boolean } | null
  show_when?: { key: string; op?: 'equals' | 'not_equals'; value?: string } | null
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)

/** Rule column text for a field. */
export function ruleText(f: Extra, all: FieldDef[]) {
  const parts: string[] = []
  if (f.validation?.check_format) parts.push(f.type === 'GSTIN' ? 'Format + checksum' : 'Format')
  if (f.validation?.lookup_name) parts.push('fetch legal name')
  if (f.is_unique) parts.push('Unique')
  if (f.show_when?.key) {
    const other = all.find((x) => x.key === f.show_when!.key)?.label ?? f.show_when.key
    parts.push(
      `Shown when ${other} ${f.show_when.op === 'not_equals' ? 'is not' : 'is'} "${f.show_when.value ?? ''}"`
    )
  }
  return parts.join(' · ') || '—'
}

export function FieldModal({
  group,
  field,
  onClose,
  onDelete,
}: {
  group: FieldGroup
  field: FieldDef | 'new' | null
  onClose: () => void
  onDelete: (f: FieldDef) => void
}) {
  const action = useAdminAction()
  const editing = field && field !== 'new' ? (field as Extra) : null
  const [keyTouched, setKeyTouched] = useState(false)
  const others = (group.fields ?? []).filter((f) => f.id !== editing?.id)
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FieldFormValues>({
    resolver: zodResolver(fieldFormSchema),
    values: {
      label: editing?.label ?? '',
      key: editing?.key ?? '',
      type: editing?.type ?? 'TEXT',
      options: (editing?.options ?? []).join('\n'),
      help_text: editing?.validation?.help_text ?? '',
      show_when_key: editing?.show_when?.key ?? '',
      show_when_value: editing?.show_when?.value ?? '',
      visibility: editing?.visibility ?? 'EDIT',
      required: editing?.required ?? false,
      check_format:
        editing?.validation?.check_format ?? ['GSTIN', 'PAN'].includes(editing?.type ?? ''),
      lookup_name: editing?.validation?.lookup_name ?? false,
      is_unique: editing?.is_unique ?? false,
    },
  })
  const type = watch('type')
  const showWhen = watch('show_when_key')
  const close = () => {
    setKeyTouched(false)
    action.reset()
    onClose()
  }
  const onSubmit = (v: FieldFormValues) => {
    const data = {
      key: v.key,
      label: v.label,
      type: v.type,
      options: ['SELECT', 'MULTISELECT'].includes(v.type)
        ? (v.options ?? '')
            .split(/[\n,]/)
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
      required: v.required,
      is_unique: v.is_unique,
      visibility: v.visibility,
      validation: {
        help_text: v.help_text || undefined,
        check_format: v.check_format || undefined,
        lookup_name: v.lookup_name || undefined,
      },
      show_when: v.show_when_key
        ? { key: v.show_when_key, op: 'not_equals' as const, value: v.show_when_value ?? '' }
        : null,
    }
    action.mutate(
      editing
        ? { method: 'patch', path: `fields/${editing.id}`, data }
        : { path: `field-groups/${group.id}/fields`, data },
      {
        onSuccess: () => {
          toast({ title: 'Field saved' })
          close()
        },
      }
    )
  }
  const submit = handleSubmit(onSubmit)
  const labelReg = register('label')
  return (
    <BModal
      wide
      open={field !== null}
      onClose={close}
      tone="info"
      title={editing ? `Edit field · ${editing.label}` : 'Add field'}
      sub={`${group.name} pack`}
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {editing && (
              <Button
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => onDelete(editing)}
              >
                Delete field
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={action.isPending}>
              Save field
            </Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Label" error={errors.label?.message} required>
            <Input
              {...labelReg}
              onChange={(e) => {
                void labelReg.onChange(e)
                if (!editing && !keyTouched) setValue('key', slug(e.target.value))
              }}
            />
          </FormField>
          <FormField
            label="Key"
            error={errors.key?.message}
            hint="Used in CSV, exports and the API"
          >
            <Input
              {...register('key')}
              readOnly={Boolean(editing)}
              onChange={(e) => {
                setKeyTouched(true)
                void register('key').onChange(e)
              }}
            />
          </FormField>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Field type</p>
          <div role="radiogroup" aria-label="Field type" className="flex flex-wrap gap-2">
            {Object.entries(TYPE_LABEL).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={type === k}
                onClick={() => setValue('type', k)}
                className={cn(
                  'rounded-md border px-3 py-1 text-sm',
                  type === k
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {['SELECT', 'MULTISELECT'].includes(type) && (
          <FormField label="Options" hint="One per line">
            <Textarea rows={4} {...register('options')} />
          </FormField>
        )}
        <FormField label="Help text">
          <Input
            placeholder="15-character GST number — we fill your company name from it"
            {...register('help_text')}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Show only when…">
            <NativeSelect
              aria-label="Show only when"
              placeholder="Always show"
              options={others.map((f) => ({ value: f.key, label: f.label }))}
              {...register('show_when_key')}
            />
          </FormField>
          {showWhen && (
            <FormField label="is not">
              <Input
                placeholder="Unregistered / sole proprietor"
                {...register('show_when_value')}
              />
            </FormField>
          )}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Member can</p>
          <Controller
            control={control}
            name="visibility"
            render={({ field: f }) => (
              <Segmented
                label="Member can"
                value={f.value}
                onChange={f.onChange}
                options={[
                  { value: 'EDIT', label: 'Edit' },
                  { value: 'VIEW', label: 'View' },
                  { value: 'HIDDEN', label: 'Not see' },
                ]}
              />
            )}
          />
        </div>
        {(
          [
            ['required', 'Required'],
            ['check_format', 'Check format and checksum'],
            ...(type === 'GSTIN' ? [['lookup_name', 'Look up legal name on GST portal']] : []),
            ['is_unique', 'Unique across members'],
          ] as const
        ).map(([k, label]) => (
          <Controller
            key={k}
            control={control}
            name={k as 'required'}
            render={({ field: f }) => (
              <ToggleRow label={label} checked={Boolean(f.value)} onChange={f.onChange} />
            )}
          />
        ))}
        <ModalError error={action.error} />
      </form>
    </BModal>
  )
}
