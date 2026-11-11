'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { addDays, addMonths, addYears } from 'date-fns'
import {
  rupees,
  useAdminItem,
  type Interval,
  type Member,
  type Payment,
  type Plan,
  type Price,
} from '@/admin/hooks/useMembership'
import {
  BModal,
  DetailRow,
  Initials,
  ModalButtons,
  ModalError,
  PayStatus,
  Section,
  SidePanel,
  ToggleRow,
  fmtDate,
  fmtDateTime,
  useDo,
} from './BillingBits'
import { NativeSelect, humanize } from './ui'

/** A waiting application = a PENDING_APPROVAL subscription with its member, plan, price and payments. */
export interface Application {
  id: string
  created_at: string
  member: Member
  plan?: Pick<Plan, 'name'> | null
  price?: Pick<Price, 'interval' | 'amount'> | null
  payments?: Array<
    Pick<Payment, 'id' | 'reference' | 'status' | 'amount'> & {
      provider?: { label: string } | null
      gateway_payment_id?: string | null
      invoice_number?: string | null
    }
  >
  fields?: Record<string, unknown>
  checks?: string[] // needs-A3: server-computed checks
}

export const planLine = (a: Application) =>
  [a.plan?.name, a.price ? humanize(a.price.interval) : null].filter(Boolean).join(' · ')

export const paymentOf = (a: Application) => a.payments?.[0] ?? null

function validTill(from: Date, interval?: Interval | null) {
  switch (interval) {
    case 'MONTHLY':
      return addDays(addMonths(from, 1), -1)
    case 'QUARTERLY':
      return addDays(addMonths(from, 3), -1)
    case 'HALF_YEARLY':
      return addDays(addMonths(from, 6), -1)
    case 'YEARLY':
      return addDays(addYears(from, 1), -1)
    default:
      return null
  }
}

export const REJECT_REASONS = [
  'Incomplete details',
  'Does not meet eligibility',
  'Duplicate application',
  'Could not verify documents',
  'Other',
]

export function ApproveModal({
  app,
  onClose,
  onDone,
}: {
  app: Application | null
  onClose: () => void
  onDone?: () => void
}) {
  const [note, setNote] = useState('')
  const [email, setEmail] = useState(true)
  const act = useDo()
  const pay = app ? paymentOf(app) : null
  const from = new Date()
  const till = validTill(from, app?.price?.interval)
  const close = () => {
    setNote('')
    act.reset()
    onClose()
  }
  return (
    <BModal
      open={app !== null}
      onClose={close}
      title="Approve membership?"
      sub={app ? `${app.member.full_name} · ${planLine(app)}` : undefined}
      footer={
        <ModalButtons
          onCancel={close}
          confirmLabel="Approve & activate"
          pending={act.pending}
          onConfirm={() =>
            app &&
            act.run(
              {
                path: `approvals/${app.id}/approve`,
                data: { note: note || undefined, send_email: email },
              },
              'Member approved',
              () => {
                close()
                onDone?.()
              }
            )
          }
        />
      }
    >
      <div className="rounded-lg border bg-muted/40 p-4">
        <DetailRow label="Member no. (auto)">Assigned on approval</DetailRow>
        <DetailRow label="Valid from">{fmtDate(from)}</DetailRow>
        <DetailRow label="Valid till">
          {till ? fmtDate(till) : app?.price?.interval === 'LIFETIME' ? 'Lifetime' : '—'}
        </DetailRow>
        {pay && (
          <DetailRow label="Payment">
            {rupees(pay.amount)} · {pay.provider?.label ?? '—'} · <PayStatus status={pay.status} />
          </DetailRow>
        )}
        {pay?.invoice_number && <DetailRow label="Invoice">{pay.invoice_number}</DetailRow>}
      </div>
      <FormField label="Note to member (optional)">
        <Textarea
          rows={2}
          placeholder="Welcome aboard!"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>
      <ToggleRow label="Send approval email & welcome kit" checked={email} onChange={setEmail} />
      <ModalError error={act.error} />
    </BModal>
  )
}

export function RejectModal({
  app,
  onClose,
  onDone,
}: {
  app: Application | null
  onClose: () => void
  onDone?: () => void
}) {
  const [reason, setReason] = useState(REJECT_REASONS[0]!)
  const [message, setMessage] = useState('')
  const act = useDo()
  const pay = app ? paymentOf(app) : null
  const refundable = pay?.status === 'PAID'
  const close = () => {
    setMessage('')
    act.reset()
    onClose()
  }
  return (
    <BModal
      open={app !== null}
      onClose={close}
      tone="bad"
      title="Reject application?"
      sub={
        app
          ? `${app.member.full_name} · ${planLine(app)}${pay ? ` · paid ${rupees(pay.amount)}` : ''}`
          : undefined
      }
      footer={
        <ModalButtons
          onCancel={close}
          destructive
          confirmLabel={refundable ? 'Reject & refund' : 'Reject'}
          pending={act.pending}
          onConfirm={() =>
            app &&
            act.run(
              {
                path: `approvals/${app.id}/reject`,
                data: { reason, message: message || undefined, refund: refundable },
              },
              'Application rejected',
              () => {
                close()
                onDone?.()
              }
            )
          }
        />
      }
    >
      <FormField label="Reason (sent to applicant)">
        <NativeSelect
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REJECT_REASONS.map((r) => ({ value: r, label: r }))}
        />
      </FormField>
      <FormField label="Message">
        <Textarea
          rows={3}
          placeholder="Please re-apply with your organisation details."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </FormField>
      {refundable && pay && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
          <p className="font-semibold">Full refund {rupees(pay.amount)}</p>
          <p className="text-xs text-muted-foreground">
            Refunded to the original method · credit note issued automatically
          </p>
        </div>
      )}
      <ModalError error={act.error} />
    </BModal>
  )
}

/** Right-hand drawer with the application's answers, payment and checks. */
export function ApprovalDrawer({
  id,
  onClose,
  onApprove,
  onReject,
}: {
  id: string | null
  onClose: () => void
  onApprove: (a: Application) => void
  onReject: (a: Application) => void
}) {
  const { data: a, isLoading } = useAdminItem<Application>(id ? `approvals/${id}` : null)
  const pay = a ? paymentOf(a) : null
  const m = a?.member
  const answers: Array<[string, unknown]> = a
    ? [
        ['Organisation', m?.legal_name],
        ['City / State', [m?.city, m?.state].filter(Boolean).join(', ') || null],
        ['Date of birth', m?.dob ? fmtDate(m.dob) : null],
        ['GSTIN', m?.gstin],
        ...Object.entries(a.fields ?? {}).map(
          ([k, v]) => [humanize(k).replace(/_/g, ' '), v] as [string, unknown]
        ),
      ]
    : []
  return (
    <SidePanel
      open={id !== null}
      onClose={onClose}
      title={a ? `Application · ${m?.full_name}` : 'Application'}
      sub={a ? `${planLine(a)} · applied ${fmtDateTime(a.created_at)}` : undefined}
      footer={
        a && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-destructive text-destructive"
              onClick={() => onReject(a)}
            >
              Reject
            </Button>
            <Button onClick={() => onApprove(a)}>Approve</Button>
          </div>
        )
      }
    >
      {isLoading || !a ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3">
            <Initials name={m?.full_name} className="h-10 w-10" />
            <div className="flex-1">
              <p className="font-semibold">{m?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {m?.email}
                {m?.mobile ? ` · ${m.mobile}` : ''}
              </p>
            </div>
            {pay && <PayStatus status={pay.status} />}
          </div>
          <Section title="Answers">
            {answers.map(([k, v]) => (
              <DetailRow key={k} label={k}>
                {v === null || v === undefined || v === '' ? '—' : String(v)}
              </DetailRow>
            ))}
          </Section>
          <Section title="Payment">
            <DetailRow label="Amount">{pay ? rupees(pay.amount) : '—'}</DetailRow>
            <DetailRow label="Method">{pay?.provider?.label ?? '—'}</DetailRow>
            <DetailRow label="Payment ID">
              {pay?.gateway_payment_id ?? pay?.reference ?? '—'}
            </DetailRow>
            <DetailRow label="Invoice">{pay?.invoice_number ?? '—'}</DetailRow>
          </Section>
          {(a.checks ?? []).length > 0 && (
            <Section title="Checks">
              <ul className="space-y-1 pt-1 text-sm">
                {a.checks!.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" /> {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </SidePanel>
  )
}
