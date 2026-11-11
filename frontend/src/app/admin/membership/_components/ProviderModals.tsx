'use client'

import { Check, X } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { BModal, DetailRow, ModalButtons } from './BillingBits'
import { PICKER_ORDER, PROVIDER_PRESETS } from './providerPresets'

export interface TestResult {
  ok: boolean
  label?: string
  message?: string
  mode?: string
  checks?: Array<{ label: string; ok: boolean; detail?: string }>
}

const REGION = { INDIA: 'India', OUTSIDE_INDIA: 'Outside India', ALL: 'Everywhere' } as const

/** "Publish X?" with the checkout preview the member will see. */
export function ProviderPublishModal({
  open,
  onClose,
  onConfirm,
  label,
  description,
  mode,
  regions,
  planNames,
  position,
  color,
  letter,
  error,
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  label: string
  description?: string
  mode: string
  regions: keyof typeof REGION
  planNames: string[]
  position?: number
  color?: string
  letter?: string
  error?: unknown
  pending?: boolean
}) {
  return (
    <BModal
      open={open}
      onClose={onClose}
      title={`Publish "${label}"?`}
      sub={`Members ${regions === 'ALL' ? 'everywhere' : regions === 'INDIA' ? 'in India' : 'outside India'} will see "${label}" at checkout`}
      footer={
        <ModalButtons
          onCancel={onClose}
          confirmLabel="Publish"
          pending={pending}
          onConfirm={onConfirm}
        />
      }
    >
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="mb-2 text-xs text-muted-foreground">
          Checkout preview · {REGION[regions]} · {planNames[0] ?? 'Any plan'}
        </p>
        <div className="flex items-center gap-3 rounded-md border bg-background p-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
            style={{ background: color ?? '#64748b' }}
          >
            {letter ?? label.slice(0, 1)}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{label}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>
      <div>
        <DetailRow label="Mode">{mode === 'LIVE' ? 'Live' : 'Test'}</DetailRow>
        {position != null && <DetailRow label="Position">{position}</DetailRow>}
        <DetailRow label="Plans">{planNames.length ? planNames.join(', ') : 'All plans'}</DetailRow>
      </div>
      {error ? <ErrorAlert error={error} /> : null}
    </BModal>
  )
}

export function ProviderTestModal({
  result,
  onClose,
  onPublish,
  canPublish,
}: {
  result: TestResult | null
  onClose: () => void
  onPublish: () => void
  canPublish: boolean
}) {
  return (
    <BModal
      open={result !== null}
      onClose={onClose}
      tone={result?.ok ? 'good' : 'bad'}
      title={result?.ok ? 'Connection successful' : 'Connection failed'}
      sub={
        result
          ? `${result.label ?? ''}${result.mode ? ` · ${result.mode.toLowerCase()} mode` : ''}`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {result?.ok && canPublish && <Button onClick={onPublish}>Publish now</Button>}
        </div>
      }
    >
      {result?.message && <p className="text-sm">{result.message}</p>}
      {(result?.checks ?? []).map((c) => (
        <DetailRow key={c.label} label={c.label}>
          <span className="inline-flex items-center gap-1">
            {c.ok ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
            {c.detail}
          </span>
        </DetailRow>
      ))}
      {result?.ok && (
        <p className="text-xs text-muted-foreground">
          Switch to Live mode and publish when you are ready.
        </p>
      )}
    </BModal>
  )
}

export function ProviderDeleteModal({
  provider,
  payments,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  provider: { label: string; status: string; mode: string } | null
  payments: number
  onClose: () => void
  onConfirm: () => void
  pending?: boolean
  error?: unknown
}) {
  return (
    <BModal
      open={provider !== null}
      onClose={onClose}
      tone="bad"
      title={`Delete "${provider?.label ?? ''}"?`}
      sub="This provider was never used — it can be deleted permanently. Its keys are erased."
      footer={
        <ModalButtons
          onCancel={onClose}
          destructive
          pending={pending}
          confirmLabel="Delete provider"
          onConfirm={onConfirm}
        />
      }
    >
      <div className="rounded-lg border p-3">
        <DetailRow label="Status">{provider?.status}</DetailRow>
        <DetailRow label="Payments">{payments}</DetailRow>
        <DetailRow label="Mode">{provider?.mode}</DetailRow>
      </div>
      <p className="text-xs text-muted-foreground">
        Providers that have payments can&apos;t be deleted — use Archive to hide them and keep
        refunds and invoices working.
      </p>
      {error ? <ErrorAlert error={error} /> : null}
    </BModal>
  )
}

export function ProviderArchiveModal({
  label,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  label: string | null
  onClose: () => void
  onConfirm: () => void
  pending?: boolean
  error?: unknown
}) {
  return (
    <BModal
      open={label !== null}
      onClose={onClose}
      tone="bad"
      title={`Archive "${label ?? ''}"?`}
      sub="Members stop seeing it at checkout. Past payments keep their history, refunds and invoices keep working."
      footer={
        <ModalButtons
          onCancel={onClose}
          destructive
          pending={pending}
          confirmLabel="Archive"
          onConfirm={onConfirm}
        />
      }
    >
      {error ? <ErrorAlert error={error} /> : null}
    </BModal>
  )
}

/** "Add payment method": pick a provider; the same provider can be added twice. */
export function ProviderPicker({
  open,
  onClose,
  added,
  value,
  onChange,
  onContinue,
}: {
  open: boolean
  onClose: () => void
  added: string[]
  value: string
  onChange: (key: string) => void
  onContinue: () => void
}) {
  return (
    <BModal
      wide
      open={open}
      onClose={onClose}
      tone="info"
      title="Add payment method"
      sub="Pick a provider. You can add the same provider twice (e.g. two Razorpay accounts)."
      footer={
        <ModalButtons
          onCancel={onClose}
          disabled={!value}
          confirmLabel={value ? `Continue with ${PROVIDER_PRESETS[value]?.label}` : 'Continue'}
          onConfirm={onContinue}
        />
      }
    >
      <div role="radiogroup" aria-label="Provider" className="grid gap-2 sm:grid-cols-2">
        {PICKER_ORDER.map((key) => {
          const p = PROVIDER_PRESETS[key]!
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              onClick={() => onChange(key)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left ${value === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: p.color }}
              >
                {p.letter}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.tag}</span>
              </span>
              {added.includes(key) && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Added
                </span>
              )}
            </button>
          )
        })}
      </div>
    </BModal>
  )
}
