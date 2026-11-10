'use client'

import { useMemo, type ReactNode, type SelectHTMLAttributes } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { rupees, useAdminAction, type ActionInput, type Plan } from '@/admin/hooks/useMembership'

export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')

type Variant = Parameters<typeof StatusBadge>[0]['variant']
const GOOD = ['ACTIVE', 'PAID', 'PUBLISHED', 'TRIALING']
const BAD = ['SUSPENDED', 'REJECTED', 'FAILED', 'CANCELLED', 'REFUNDED']
const WAIT = [
  'PENDING',
  'PENDING_PAYMENT',
  'PENDING_APPROVAL',
  'PAST_DUE',
  'AWAITING_PROOF',
  'UNDER_VERIFICATION',
  'DRAFT',
]

/** One mapping from any membership status string to the shared StatusBadge. */
export function StatusPill({ status }: { status: string }) {
  const variant: Variant = GOOD.includes(status)
    ? 'active'
    : BAD.includes(status)
      ? 'suspended'
      : WAIT.includes(status)
        ? 'pending'
        : 'inactive'
  return <StatusBadge variant={variant} label={humanize(status)} />
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: string; label: string }>
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            value === t.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function NativeSelect({
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
        className
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export const enumOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: humanize(v) }))

export function Card({
  title,
  children,
  action,
}: {
  title?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="mb-6 rounded-lg border bg-card p-5">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Searchable filter bar: a debounce-free controlled search + selects, all driven by the caller. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>
}

export function totalPages(total?: number, limit?: number) {
  return Math.max(1, Math.ceil((total ?? 0) / (limit || 20)))
}

// ---- Declarative action modal -------------------------------------------------------------

export interface ActionField {
  name: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'checkbox'
  options?: Array<{ value: string; label: string }>
  required?: boolean
  hint?: string
  defaultValue?: string | number | boolean
}

/**
 * One modal for every small member/payment/approval action (extend, suspend, refund, ...).
 * Fields are declared, the zod schema is derived from them, and the write goes through useAdminAction.
 */
export function ActionModal({
  open,
  onClose,
  title,
  description,
  fields,
  submitLabel = 'Confirm',
  destructive,
  request,
  success,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  fields: ActionField[]
  submitLabel?: string
  destructive?: boolean
  request: (values: Record<string, string | number | boolean>) => ActionInput
  success: string
}) {
  const action = useAdminAction()
  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          fields.map((f) => {
            const base =
              f.type === 'number'
                ? f.required
                  ? z.number({ message: `${f.label} is required` })
                  : z.number().optional()
                : f.type === 'checkbox'
                  ? z.boolean()
                  : f.required
                    ? z.string().min(1, `${f.label} is required`)
                    : z.string().optional()
            return [f.name, base]
          })
        )
      ),
    [fields]
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Record<string, string | number | boolean>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'checkbox' ? false : '')])
    ),
  })

  function close() {
    reset()
    action.reset()
    onClose()
  }

  function onSubmit(values: Record<string, string | number | boolean>) {
    const body = Object.fromEntries(
      Object.entries(values).filter(
        ([, v]) => v !== '' && !(typeof v === 'number' && Number.isNaN(v))
      )
    )
    action.mutate(request(body), {
      onSuccess: () => {
        toast({ title: success })
        close()
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleSubmit(onSubmit)}
            disabled={action.isPending}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {fields.map((f) => {
          const err = errors[f.name]?.message as string | undefined
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register(f.name)} /> {f.label}
              </label>
            )
          return (
            <FormField key={f.name} label={f.label} error={err} required={f.required} hint={f.hint}>
              {f.type === 'textarea' ? (
                <Textarea rows={3} {...register(f.name)} />
              ) : f.type === 'select' ? (
                <NativeSelect options={f.options ?? []} {...register(f.name)} />
              ) : f.type === 'number' ? (
                <Input type="number" step="any" {...register(f.name, { valueAsNumber: true })} />
              ) : (
                <Input type={f.type === 'date' ? 'date' : 'text'} {...register(f.name)} />
              )}
            </FormField>
          )
        })}
        {action.error && <ErrorAlert error={action.error} />}
      </form>
    </Modal>
  )
}

export function priceSummary(plan: Plan) {
  if (plan.is_free) return 'Free'
  const prices = (plan.prices ?? []).filter((p) => p.is_active)
  if (prices.length === 0) return '—'
  return prices.map((p) => `${rupees(p.amount)} / ${humanize(p.interval)}`).join(' · ')
}
