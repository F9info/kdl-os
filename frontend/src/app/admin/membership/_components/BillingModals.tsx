'use client'

import { useState } from 'react'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { safeHref } from '@/frontend/lib/safe-href'
import { rupees, toPaise, type Invoice, type Payment } from '@/admin/hooks/useMembership'
import {
  BModal,
  DetailRow,
  ModalButtons,
  ModalError,
  Segmented,
  ToggleRow,
  fmtDate,
  fmtDateTime,
  useDo,
} from './BillingBits'
import { NativeSelect } from './ui'

/** Payment as the admin payment endpoints return it (extra fields are optional: see needs-A3). */
export type PaymentRow = Payment & {
  gateway_payment_id?: string | null
  gateway_order_id?: string | null
  verified_at?: string | null
  subscription?: {
    plan?: { name: string } | null
    price?: { interval: string; amount: number } | null
    is_renewal?: boolean
  } | null
  invoices?: Array<
    Pick<Invoice, 'id' | 'number' | 'subtotal' | 'tax_amount' | 'gst_rate' | 'total'>
  >
  provider?: { id: string; label: string; provider: string; type?: string } | null
  breakdown?: Array<{ label: string; amount: number }>
  webhook_events?: Array<{ key: string; created_at: string; status?: string }>
  proof_name?: string | null
  proof_size?: string | null
  proof_amount?: number | null
  paid_to?: string | null
  submitted_at?: string | null
  upi_id?: string | null
}

const PURPOSE = (p: PaymentRow) =>
  [
    p.subscription?.is_renewal ? 'Renewal' : 'New',
    p.subscription?.plan?.name,
    p.subscription?.price ? p.subscription.price.interval.toLowerCase().replace('_', ' ') : null,
  ]
    .filter(Boolean)
    .join(' · ')
export const purposeOf = PURPOSE

export function BulkConfirm({
  kind,
  count,
  pending,
  onClose,
  onConfirm,
}: {
  kind: 'approve' | 'reject' | null
  count: number
  pending?: boolean
  onClose: () => void
  onConfirm: (kind: 'approve' | 'reject', reason?: string) => void
}) {
  const [reason, setReason] = useState('')
  const reject = kind === 'reject'
  return (
    <BModal
      open={kind !== null}
      onClose={onClose}
      tone={reject ? 'bad' : 'good'}
      title={`${reject ? 'Reject' : 'Approve'} ${count} application${count === 1 ? '' : 's'}?`}
      sub={
        reject
          ? 'Paid applications are refunded in full and a credit note is issued.'
          : 'Each member is activated and gets a member number.'
      }
      footer={
        <ModalButtons
          onCancel={onClose}
          destructive={reject}
          pending={pending}
          disabled={reject && !reason.trim()}
          confirmLabel={reject ? 'Reject all' : 'Approve all'}
          onConfirm={() => kind && onConfirm(kind, reason.trim())}
        />
      }
    >
      {reject && (
        <FormField label="Reason (sent to applicants)" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      )}
    </BModal>
  )
}

export function RejectProofModal({
  payment,
  onClose,
}: {
  payment: PaymentRow | null
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const act = useDo()
  const close = () => {
    setReason('')
    act.reset()
    onClose()
  }
  return (
    <BModal
      open={payment !== null}
      onClose={close}
      tone="bad"
      title="Reject payment proof?"
      sub={payment ? `${payment.member?.full_name ?? ''} · ${rupees(payment.amount)}` : undefined}
      footer={
        <ModalButtons
          onCancel={close}
          destructive
          pending={act.pending}
          disabled={!reason.trim()}
          confirmLabel="Reject payment"
          onConfirm={() =>
            payment &&
            act.run(
              { path: `payments/${payment.id}/reject`, data: { reason: reason.trim() } },
              'Payment rejected',
              close
            )
          }
        />
      }
    >
      <FormField label="Reason (sent to the member)" required>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <ModalError error={act.error} />
    </BModal>
  )
}

export function VerifyModal({
  payment,
  onClose,
  onReject,
}: {
  payment: PaymentRow | null
  onClose: () => void
  onReject: (p: PaymentRow) => void
}) {
  const [matched, setMatched] = useState('yes')
  const [note, setNote] = useState('')
  const act = useDo()
  const p = payment
  const close = () => {
    setNote('')
    act.reset()
    onClose()
  }
  return (
    <BModal
      wide
      open={p !== null}
      onClose={close}
      tone="info"
      title={p ? `Verify bank transfer · ${rupees(p.amount)}` : 'Verify payment'}
      sub={
        p
          ? `${p.member?.full_name ?? ''} · ${PURPOSE(p)} · submitted ${fmtDateTime(p.submitted_at ?? p.created_at)}`
          : undefined
      }
      footer={
        p && (
          <div className="flex justify-end gap-2">
            <ModalButtons
              onCancel={() => onReject(p)}
              cancelLabel="Reject"
              confirmLabel="Confirm payment"
              pending={act.pending}
              disabled={matched === 'no'}
              onConfirm={() =>
                act.run(
                  {
                    path: `payments/${p.id}/verify`,
                    data: { matched: matched === 'yes', note: note || undefined },
                  },
                  'Payment verified',
                  close
                )
              }
            />
          </div>
        )
      }
    >
      {p && (
        <>
          <div className="rounded-lg border p-4">
            <DetailRow label="Payment reference">{p.reference}</DetailRow>
            <DetailRow label="UTR number">{p.utr ?? '—'}</DetailRow>
            <DetailRow label="Paid to">{p.paid_to ?? p.provider?.label ?? '—'}</DetailRow>
            <DetailRow label="Amount expected">{rupees(p.amount)}</DetailRow>
            <DetailRow label="Amount on proof">
              {p.proof_amount != null ? (
                <>
                  {rupees(p.proof_amount)} {p.proof_amount === p.amount ? '✓' : '(mismatch)'}
                </>
              ) : (
                '—'
              )}
            </DetailRow>
            <DetailRow label="Paid on">{fmtDate(p.paid_at ?? p.created_at)}</DetailRow>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">Proof uploaded</p>
              <p className="text-xs text-muted-foreground">
                {p.proof_url
                  ? [p.proof_name, p.proof_size].filter(Boolean).join(' · ') || 'Receipt attached'
                  : 'No proof attached — member gave a UTR only'}
              </p>
            </div>
            {p.proof_url && (
              <a
                href={safeHref(p.proof_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                View
              </a>
            )}
          </div>
          <FormField label="Matched in bank statement">
            <NativeSelect
              value={matched}
              onChange={(e) => setMatched(e.target.value)}
              options={[
                {
                  value: 'yes',
                  label: `Yes — ${fmtDate(p.paid_at ?? p.created_at)}, credit ${rupees(p.amount)}`,
                },
                { value: 'unchecked', label: 'Not checked yet' },
                { value: 'no', label: 'No — not in the statement' },
              ]}
            />
          </FormField>
          <FormField label="Note (optional)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Checked against SBI statement"
            />
          </FormField>
          <p className="text-xs text-muted-foreground">
            Confirming issues the GST invoice and, for plans that need approval, sends the
            application to the Approvals queue.
          </p>
          <ModalError error={act.error} />
        </>
      )}
    </BModal>
  )
}

const REFUND_REASONS = [
  'Goodwill — event cancelled',
  'Duplicate payment',
  'Member request',
  'Application rejected',
  'Other',
]

export function RefundModal({
  payment,
  onClose,
}: {
  payment: PaymentRow | null
  onClose: () => void
}) {
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState(REFUND_REASONS[0]!)
  const [cancel, setCancel] = useState(false)
  const act = useDo()
  const cancelAct = useDo()
  const p = payment
  const left = p ? p.amount - (p.refunded_amount ?? 0) : 0
  const partial = Number(amount)
  const invalid = mode === 'partial' && !(partial > 0 && toPaise(partial) <= left)
  const refundPaise = mode === 'full' ? left : toPaise(partial || 0)
  const close = () => {
    setAmount('')
    setMode('full')
    setCancel(false)
    act.reset()
    onClose()
  }
  return (
    <BModal
      open={p !== null}
      onClose={close}
      tone="bad"
      title="Refund payment"
      sub={
        p
          ? `${p.member?.full_name ?? ''} · ${p.gateway_payment_id ?? p.reference} · ${rupees(p.amount)}`
          : undefined
      }
      footer={
        <ModalButtons
          onCancel={close}
          destructive
          pending={act.pending}
          disabled={invalid || left <= 0}
          confirmLabel={`Refund ${rupees(refundPaise)}`}
          onConfirm={() =>
            p &&
            act.run(
              {
                path: `payments/${p.id}/refund`,
                data: {
                  ...(mode === 'partial' ? { amount: toPaise(partial) } : {}),
                  reason,
                  cancel_membership: cancel,
                },
              },
              'Refund issued',
              () => {
                if (cancel && p.member)
                  cancelAct.run(
                    { path: `members/${p.member.id}/cancel`, data: { reason, immediately: true } },
                    'Membership cancelled'
                  )
                close()
              }
            )
          }
        />
      }
    >
      <Segmented
        label="Refund type"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'full', label: 'Full' },
          { value: 'partial', label: 'Partial' },
        ]}
      />
      <FormField
        label="Refund amount (INR)"
        error={invalid && mode === 'partial' ? `Enter an amount up to ${rupees(left)}` : undefined}
      >
        <Input
          type="number"
          step="any"
          disabled={mode === 'full'}
          value={mode === 'full' ? String(left / 100) : amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </FormField>
      <FormField label="Reason">
        <NativeSelect
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REFUND_REASONS.map((r) => ({ value: r, label: r }))}
        />
      </FormField>
      <div className="rounded-lg border bg-muted/40 p-3">
        <DetailRow label="Refund to">Original method ({p?.provider?.label ?? '—'})</DetailRow>
        <DetailRow label="Credit note">Issued automatically</DetailRow>
        <DetailRow label="Membership">{cancel ? 'Will be cancelled' : 'Stays active'}</DetailRow>
      </div>
      <ToggleRow label="Also cancel membership" checked={cancel} onChange={setCancel} />
      <ModalError error={act.error} />
    </BModal>
  )
}

const VOID_REASONS = ['Refund on rejection', 'Wrong billing details', 'Duplicate invoice', 'Other']

export function VoidModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [mode, setMode] = useState<'credit' | 'void'>('credit')
  const [reason, setReason] = useState(VOID_REASONS[0]!)
  const act = useDo()
  const close = () => {
    act.reset()
    onClose()
  }
  return (
    <BModal
      open={invoice !== null}
      onClose={close}
      tone="bad"
      title="Void invoice / issue credit note"
      sub={invoice ? `${invoice.number} · ${rupees(invoice.total)}` : undefined}
      footer={
        <ModalButtons
          onCancel={close}
          destructive
          pending={act.pending}
          confirmLabel={mode === 'credit' ? 'Issue credit note' : 'Void invoice'}
          onConfirm={() =>
            invoice &&
            act.run(
              { path: `invoices/${invoice.id}/void`, data: { reason, mode } },
              'Credit note issued',
              close
            )
          }
        />
      }
    >
      <Segmented
        label="Action"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'credit', label: 'Credit note (recommended)' },
          { value: 'void', label: 'Void (same day only)' },
        ]}
      />
      <FormField label="Credit amount">
        <Input disabled value={invoice ? `${rupees(invoice.total)} (full)` : ''} readOnly />
      </FormField>
      <FormField label="Reason">
        <NativeSelect
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={VOID_REASONS.map((r) => ({ value: r, label: r }))}
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Invoices are never deleted. A credit note is issued and linked to this invoice.
      </p>
      <ModalError error={act.error} />
    </BModal>
  )
}
