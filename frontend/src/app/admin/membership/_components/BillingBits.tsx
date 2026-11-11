'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { cn, formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, type ActionInput } from '@/admin/hooks/useMembership'

/** Shared building blocks for the Billing / Providers / Settings admin screens (one place, no copies). */

export const fmtDate = (d?: string | Date | null) => (d ? formatDate(d, 'dd MMM yyyy') : '—')
export const fmtDateTime = (d?: string | Date | null) =>
  d ? formatDate(d, 'dd MMM yyyy, h:mm a') : '—'

/** "Just now", "4 days" as in the mockup's Waiting column. */
export function waiting(d?: string | null) {
  if (!d) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (mins < 60) return 'Just now'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'

export function Initials({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary',
        className
      )}
    >
      {initials(name)}
    </span>
  )
}

export function PersonCell({ name, sub }: { name?: string | null; sub?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <Initials name={name} />
      <div className="min-w-0">
        <p className="truncate font-medium">{name ?? '—'}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Pill filter tabs ("All / Waiting for verification · 1 / Failed / Refunded"). */
export function Chips({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: string; label: string; count?: number }>
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            value === t.key
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
          {t.count !== undefined && ` · ${t.count}`}
        </button>
      ))}
    </div>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

/** A labelled switch row ("Send approval email & welcome kit"). */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="text-sm">
        <p>{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  )
}

/** Segmented single choice (Full | Partial, Credit note | Void, Test | Live). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-3 py-1 text-sm',
            value === o.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The mockup's confirm modal: tone icon header, body, right-aligned buttons. */
export function BModal({
  open,
  onClose,
  title,
  sub,
  tone = 'good',
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  tone?: 'good' | 'bad' | 'info'
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn('flex max-h-[90vh] flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'mt-1 h-9 w-9 shrink-0 rounded-full',
                tone === 'good' && 'bg-green-100 dark:bg-green-900/30',
                tone === 'bad' && 'bg-red-100 dark:bg-red-900/30',
                tone === 'info' && 'bg-primary/10'
              )}
            />
            <div>
              <DialogTitle>{title}</DialogTitle>
              {sub ? <DialogDescription>{sub}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

/** Right-hand detail drawer (approval detail, payment detail). */
export function SidePanel({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent size="lg" className="w-full max-w-lg">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{title}</SheetTitle>
          {sub ? (
            <SheetDescription>{sub}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <SheetFooter className="border-t p-4">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}

/** One mutation with a toast: `const { run, pending, error } = useDo()`. */
export function useDo() {
  const action = useAdminAction()
  return {
    pending: action.isPending,
    error: action.error,
    reset: action.reset,
    run: (input: ActionInput, ok: string, then?: (data: unknown) => void) =>
      action.mutate(input, {
        onSuccess: (d) => {
          toast({ title: ok })
          then?.(d)
        },
      }),
  }
}

export function ModalError({ error }: { error: unknown }) {
  return error ? <ErrorAlert error={error} /> : null
}

export function ModalButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  destructive,
  pending,
  disabled,
  cancelLabel = 'Cancel',
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  destructive?: boolean
  pending?: boolean
  disabled?: boolean
  cancelLabel?: string
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        variant={destructive ? 'destructive' : 'default'}
        onClick={onConfirm}
        disabled={pending || disabled}
      >
        {confirmLabel}
      </Button>
    </div>
  )
}

const PAY_LABEL: Record<string, string> = {
  PAID: 'Captured',
  UNDER_VERIFICATION: 'Waiting for verification',
  AWAITING_PROOF: 'Awaiting proof',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
}
const PAY_VARIANT: Record<string, 'active' | 'pending' | 'suspended' | 'inactive'> = {
  PAID: 'active',
  UNDER_VERIFICATION: 'pending',
  AWAITING_PROOF: 'pending',
  PENDING: 'pending',
  FAILED: 'suspended',
  REJECTED: 'suspended',
  REFUNDED: 'inactive',
}
export const payLabel = (s: string) => PAY_LABEL[s] ?? s
export function PayStatus({ status }: { status: string }) {
  return <StatusBadge variant={PAY_VARIANT[status] ?? 'inactive'} label={payLabel(status)} />
}

export const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque / DD',
  CASH: 'Cash',
  UPI: 'UPI',
  OTHER: 'Other',
}

/** Client-side CSV download (Tally / GSTR-1 exports until the API streams them). */
export function downloadCsv(name: string, rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
