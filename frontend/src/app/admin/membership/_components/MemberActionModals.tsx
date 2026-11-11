'use client'

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import api from '@/lib/axios'
import { rupees, toPaise, useAdminAction, usePlans, type Member } from '@/admin/hooks/useMembership'
import { NativeSelect, enumOptions } from './ui'
import { Row, Seg, ToggleRow } from './MemberUi'
import { addMonths, cap, dmy, isoDay } from './MemberFormat'

interface Props {
  member: Member
  onClose: () => void
}

/** Shared submit plumbing: POST members/:id/<path>, toast, close. Modals mount only while open so state resets. */
function useSubmit(member: Member, onClose: () => void) {
  const action = useAdminAction()
  return {
    action,
    run: (path: string, data: unknown, success: string, method?: 'post' | 'patch') =>
      action.mutate(
        { method, path: `members/${member.id}/${path}`, data },
        {
          onSuccess: () => {
            toast({ title: success })
            onClose()
          },
        }
      ),
  }
}

function Footer({
  onClose,
  cancel = 'Cancel',
  submit,
  onSubmit,
  pending,
  destructive,
  disabled,
}: {
  onClose: () => void
  cancel?: string
  submit: string
  onSubmit: () => void
  pending: boolean
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onClose}>
        {cancel}
      </Button>
      <Button
        variant={destructive ? 'destructive' : 'default'}
        onClick={onSubmit}
        disabled={pending || disabled}
      >
        {submit}
      </Button>
    </div>
  )
}

const who = (m: Member) => m.legal_name || m.full_name
const current = (m: Member) =>
  `${m.subscription?.plan?.name ?? 'No plan'}${m.subscription?.price ? ` · ${cap(m.subscription.price.interval)}` : ''}`

function Shell({
  title,
  description,
  onClose,
  footer,
  error,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  footer: ReactNode
  error: unknown
  children: ReactNode
}) {
  return (
    <Modal open onClose={onClose} title={title} description={description} footer={footer}>
      <div className="space-y-4">
        {children}
        {error ? <ErrorAlert error={error} /> : null}
      </div>
    </Modal>
  )
}

const EXTEND_STEPS = [
  { value: '1m', label: '+1 month', months: 1 },
  { value: '3m', label: '+3 months', months: 3 },
  { value: '1y', label: '+1 year', months: 12 },
  { value: 'custom', label: 'Custom', months: 0 },
]

export function ExtendModal({ member, onClose }: Props) {
  const { action, run } = useSubmit(member, onClose)
  const end = member.subscription?.ends_at ? new Date(member.subscription.ends_at) : new Date()
  const [step, setStep] = useState('3m')
  const [custom, setCustom] = useState(isoDay(addMonths(end, 3)))
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const months = EXTEND_STEPS.find((s) => s.value === step)?.months ?? 0
  const until = step === 'custom' ? custom : isoDay(addMonths(end, months))
  return (
    <Shell
      title="Extend membership"
      description={`${who(member)} · ${member.subscription?.plan?.name ?? ''} · valid till ${dmy(member.subscription?.ends_at)}`}
      onClose={onClose}
      error={action.error}
      footer={
        <Footer
          onClose={onClose}
          submit="Extend"
          pending={action.isPending}
          disabled={!until}
          onSubmit={() =>
            run('extend', { until, reason: reason || undefined, notify }, 'Membership extended')
          }
        />
      }
    >
      <Seg
        label="Extend by"
        value={step}
        onChange={(v) => {
          setStep(v)
        }}
        options={EXTEND_STEPS}
      />
      <FormField label="New end date">
        <Input
          type="date"
          value={until}
          onChange={(e) => {
            setStep('custom')
            setCustom(e.target.value)
          }}
        />
      </FormField>
      <FormField label="Reason">
        <Input
          placeholder="e.g. Compensation for event cancellation"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
      <ToggleRow label="Notify member by email" checked={notify} onChange={setNotify} />
    </Shell>
  )
}

interface Quote {
  credit?: number
  price?: number
  tax?: number
  total?: number
}

export function ChangePlanModal({ member, onClose }: Props) {
  const { action, run } = useSubmit(member, onClose)
  const { data: plans } = usePlans()
  const [planId, setPlanId] = useState('')
  const [apply, setApply] = useState<'now' | 'renewal'>('now')
  const [settle, setSettle] = useState<'pay_link' | 'offline' | 'waive'>('pay_link')
  const plan = plans?.items.find((p) => p.id === planId)
  const interval =
    plan?.prices?.find((p) => p.is_active && p.interval === member.subscription?.price?.interval)
      ?.interval ?? plan?.prices?.find((p) => p.is_active)?.interval
  // Pro-rata quote is a server calculation (needs-A2); the dialog still works without it.
  const quote = useQuery({
    queryKey: ['membership', 'quote', member.id, planId, interval],
    queryFn: () =>
      api
        .get(`/membership/admin/members/${member.id}/change-plan/quote`, {
          params: { plan_id: planId, interval },
        })
        .then((r) => r.data.data as Quote),
    enabled: Boolean(planId && apply === 'now'),
    retry: false,
  })
  const price = plan?.prices?.find((p) => p.interval === interval)
  const q = quote.data
  return (
    <Shell
      title="Change plan"
      description={`${who(member)} · currently ${current(member)}`}
      onClose={onClose}
      error={action.error}
      footer={
        <Footer
          onClose={onClose}
          submit="Change plan"
          pending={action.isPending}
          disabled={!planId}
          onSubmit={() =>
            run(
              'change-plan',
              {
                plan_id: planId,
                interval,
                apply,
                settlement: apply === 'now' ? settle : undefined,
              },
              'Plan changed'
            )
          }
        />
      }
    >
      <FormField label="New plan" required>
        <NativeSelect
          aria-label="New plan"
          placeholder="Choose…"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          options={(plans?.items ?? [])
            .filter((p) => p.id !== member.subscription?.plan_id)
            .map((p) => ({ value: p.id, label: p.name }))}
        />
      </FormField>
      <Seg
        label="When"
        value={apply}
        onChange={setApply}
        options={[
          { value: 'now', label: 'Apply now' },
          {
            value: 'renewal',
            label: `At renewal${member.subscription?.ends_at ? ` (${dmy(member.subscription.ends_at)})` : ''}`,
          },
        ]}
      />
      {apply === 'now' && planId && (
        <div className="rounded-md border p-3">
          {q?.credit !== undefined && (
            <Row label="Credit for unused time">− {rupees(q.credit)}</Row>
          )}
          <Row label="New plan price">{rupees(q?.price ?? price?.amount)}</Row>
          {q?.tax !== undefined && <Row label="GST">{rupees(q.tax)}</Row>}
          {q?.total !== undefined && <Row label="Amount due">{rupees(q.total)}</Row>}
        </div>
      )}
      {apply === 'now' && (
        <Seg
          label="Settlement"
          value={settle}
          onChange={setSettle}
          options={[
            { value: 'pay_link', label: 'Send pay link' },
            { value: 'offline', label: 'Record offline payment' },
            { value: 'waive', label: 'Waive' },
          ]}
        />
      )}
    </Shell>
  )
}

const PURPOSES = ['New', 'Renewal', 'Upgrade', 'Other']
const METHODS = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'OTHER']

export function RecordPaymentModal({ member, onClose }: Props) {
  const { action, run } = useSubmit(member, onClose)
  const { data: plans } = usePlans()
  const sub = member.subscription
  const [purpose, setPurpose] = useState('Renewal')
  const [pp, setPp] = useState(sub ? `${sub.plan_id}|${sub.price?.interval ?? ''}` : '')
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [utr, setUtr] = useState('')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(isoDay(new Date()))
  const [invoice, setInvoice] = useState(true)
  const [email, setEmail] = useState(true)
  const [error, setError] = useState('')
  const options = (plans?.items ?? []).flatMap((p) =>
    (p.prices ?? [])
      .filter((x) => x.is_active)
      .map((x) => ({ value: `${p.id}|${x.interval}`, label: `${p.name} · ${cap(x.interval)}` }))
  )
  function submit() {
    const n = Number(amount)
    if (!amount || !(n > 0)) return setError('Enter the amount received')
    setError('')
    const [plan_id, interval] = pp.split('|')
    run(
      'record-payment',
      {
        amount: toPaise(n),
        method,
        utr: utr || undefined,
        plan_id: plan_id || undefined,
        interval: interval || undefined,
        purpose: purpose.toLowerCase(),
        paid_on: paidOn || undefined,
        issue_invoice: invoice,
        notify: email,
      },
      'Payment recorded'
    )
  }
  return (
    <Shell
      title="Record payment"
      description={`${who(member)} · offline payment`}
      onClose={onClose}
      error={action.error}
      footer={
        <Footer
          onClose={onClose}
          submit="Record payment"
          pending={action.isPending}
          onSubmit={submit}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Purpose">
          <NativeSelect
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            options={PURPOSES.map((p) => ({ value: p, label: p }))}
          />
        </FormField>
        <FormField label="Plan & period">
          <NativeSelect
            placeholder="—"
            value={pp}
            onChange={(e) => setPp(e.target.value)}
            options={options}
          />
        </FormField>
        <FormField label="Method">
          <NativeSelect
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            options={enumOptions(METHODS)}
          />
        </FormField>
        <FormField label="Reference / UTR">
          <Input value={utr} onChange={(e) => setUtr(e.target.value)} />
        </FormField>
        <FormField label="Amount received (₹)" error={error} required>
          <Input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Paid on">
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </FormField>
      </div>
      <ToggleRow label="Issue GST invoice" checked={invoice} onChange={setInvoice} />
      <ToggleRow label="Email receipt to member" checked={email} onChange={setEmail} />
    </Shell>
  )
}

const SUSPEND_REASONS = ['Policy violation', 'Non-payment', 'Member request', 'Other']

export function SuspendModal({ member, onClose }: Props) {
  const { action, run } = useSubmit(member, onClose)
  const suspended = member.subscription?.status === 'SUSPENDED'
  const [category, setCategory] = useState(SUSPEND_REASONS[0])
  const [details, setDetails] = useState('')
  const [until, setUntil] = useState<'reactivated' | 'date'>('reactivated')
  const [date, setDate] = useState('')
  const [pause, setPause] = useState(false)
  const [notify, setNotify] = useState(true)
  if (suspended)
    return (
      <Shell
        title="Reactivate membership"
        description="Access is restored immediately."
        onClose={onClose}
        error={action.error}
        footer={
          <Footer
            onClose={onClose}
            submit="Reactivate"
            pending={action.isPending}
            onSubmit={() => run('reactivate', {}, 'Member reactivated')}
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          {member.subscription?.suspended_reason
            ? `Suspended: ${member.subscription.suspended_reason}`
            : 'This membership is suspended.'}
        </p>
      </Shell>
    )
  return (
    <Shell
      title="Suspend membership"
      description="Access to members-only content stops immediately"
      onClose={onClose}
      error={action.error}
      footer={
        <Footer
          onClose={onClose}
          submit="Suspend"
          destructive
          pending={action.isPending}
          disabled={until === 'date' && !date}
          onSubmit={() =>
            run(
              'suspend',
              {
                reason: details ? `${category}: ${details}` : category,
                until: until === 'date' ? date : undefined,
                pause_clock: pause,
                notify,
              },
              'Member suspended'
            )
          }
        />
      }
    >
      <FormField label="Reason">
        <NativeSelect
          aria-label="Reason"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={SUSPEND_REASONS.map((r) => ({ value: r, label: r }))}
        />
      </FormField>
      <FormField label="Details (internal)">
        <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
      </FormField>
      <Seg
        label="Duration"
        value={until}
        onChange={setUntil}
        options={[
          { value: 'reactivated', label: 'Until reactivated' },
          { value: 'date', label: 'Until a date' },
        ]}
      />
      {until === 'date' && (
        <FormField label="Until" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      )}
      <ToggleRow
        label="Pause validity clock"
        hint="Days are not lost while suspended"
        checked={pause}
        onChange={setPause}
      />
      <ToggleRow label="Notify member" checked={notify} onChange={setNotify} />
    </Shell>
  )
}

const CANCEL_REASONS = ['Member request', 'Non-payment', 'Duplicate membership', 'Other']

export function CancelModal({ member, onClose }: Props) {
  const { action, run } = useSubmit(member, onClose)
  const [when, setWhen] = useState<'period_end' | 'now'>('period_end')
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [refund, setRefund] = useState<'none' | 'pro_rata' | 'full'>('none')
  const [notify, setNotify] = useState(true)
  const end = member.subscription?.ends_at
  return (
    <Shell
      title="Cancel membership"
      description={`${who(member)} · ${current(member)}`}
      onClose={onClose}
      error={action.error}
      footer={
        <Footer
          onClose={onClose}
          cancel="Keep membership"
          submit="Cancel membership"
          destructive
          pending={action.isPending}
          onSubmit={() =>
            run(
              'cancel',
              { reason, immediately: when === 'now', refund, notify },
              'Membership cancelled'
            )
          }
        />
      }
    >
      <p className="text-sm font-medium">When</p>
      <Seg
        label="When"
        value={when}
        onChange={setWhen}
        options={[
          { value: 'period_end', label: `At period end${end ? ` (${dmy(end)})` : ''}` },
          { value: 'now', label: 'Immediately' },
        ]}
      />
      <FormField label="Reason">
        <NativeSelect
          aria-label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
        />
      </FormField>
      <p className="text-sm font-medium">Refund</p>
      <Seg
        label="Refund"
        value={refund}
        onChange={setRefund}
        options={[
          { value: 'none', label: 'No refund' },
          { value: 'pro_rata', label: 'Pro-rata' },
          { value: 'full', label: 'Full' },
        ]}
      />
      <ToggleRow label="Notify member" checked={notify} onChange={setNotify} />
    </Shell>
  )
}
