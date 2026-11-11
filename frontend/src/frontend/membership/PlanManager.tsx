'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { post, useMe, usePlans } from './api'
import { INTERVAL_LABEL, INTERVAL_TITLE, dateText, money, priceFor, priceTotals } from './format'
import type { Interval, Plan } from './types'

const REASONS = [
  'Too expensive',
  'Not using it enough',
  'Missing features I need',
  'Moving away',
  'Other',
]
const Card = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <section aria-label={label} className="space-y-4 rounded-xl border bg-card p-6">
    {children}
  </section>
)

/** Switch-at-renewal (downgrade) confirmation: what changes and what is lost. */
function Downgrade({
  from,
  to,
  interval,
  endsAt,
  onClose,
}: {
  from: Plan
  to: Plan
  interval: Interval
  endsAt?: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: () => post('/membership/me/change-plan', { plan_slug: to.slug, interval }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['membership'] })
      onClose()
    },
  })
  const pf = priceFor(from, interval)
  const pt = priceFor(to, interval)
  const lost = (from.benefits ?? []).filter(
    (b) => !(to.benefits ?? []).some((x) => x.text === b.text)
  )
  return (
    <Card label="Switch plan">
      <h2 className="text-xl font-semibold">Switch to {to.name} at renewal</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">Now</p>
          <p className="font-semibold">
            {from.name}
            {pf ? ` · ${money(pf.amount)}/${INTERVAL_LABEL[interval]}` : ''}
          </p>
          <p className="text-muted-foreground">until {dateText(endsAt)}</p>
        </div>
        <div className="rounded-lg border border-primary p-3 text-sm">
          <p className="text-muted-foreground">At renewal</p>
          <p className="font-semibold">
            {to.name}
            {pt ? ` · ${money(pt.amount)}/${INTERVAL_LABEL[interval]}` : ''}
          </p>
          {pt && <p className="text-muted-foreground">{money(priceTotals(pt).total)} incl. GST</p>}
        </div>
      </div>
      {lost.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">You will lose at renewal:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {lost.map((b, i) => (
              <li key={i}>{b.text}</li>
            ))}
          </ul>
        </div>
      )}
      {m.error ? <ErrorAlert error={m.error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onClose}>
          Keep {from.name}
        </Button>
        <Button disabled={m.isPending} onClick={() => m.mutate()}>
          Schedule switch to {to.name}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        No refund for the current period. You can undo this any time before {dateText(endsAt)}.
      </p>
    </Card>
  )
}

/** 3-step cancel flow: why -> retention offer + what happens -> scheduled. */
function Cancel({
  current,
  alt,
  interval,
  endsAt,
  onClose,
  onSwitch,
}: {
  current: Plan
  alt?: Plan
  interval?: Interval
  endsAt?: string | null
  onClose: () => void
  onSwitch: (p: Plan) => void
}) {
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: () =>
      post('/membership/me/cancel', {
        reason: [reason, detail].filter(Boolean).join(': ') || undefined,
        immediately: false,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['membership'] })
      setStep(3)
    },
  })
  const resume = useMutation({
    mutationFn: () => post('/membership/me/resume', {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['membership'] })
      onClose()
    },
  })
  const pc = interval ? priceFor(current, interval) : undefined
  const pa = alt && interval ? priceFor(alt, interval) : undefined
  const saving = pc && pa ? pc.amount - pa.amount : 0
  return (
    <Card label="Cancel membership">
      <p className="text-sm text-muted-foreground">Step {step} of 3</p>
      {step === 1 && (
        <>
          <h2 className="text-xl font-semibold">Sorry to see you go - why are you leaving?</h2>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          <Textarea
            aria-label="Anything else?"
            placeholder="Anything else? Tell us how we can improve… (optional)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Keep membership
            </Button>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="text-xl font-semibold">Before you cancel…</h2>
          {alt && saving > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
              <div>
                <p className="font-semibold">
                  Switch to {alt.name} and save {money(saving)} / {INTERVAL_LABEL[interval!]}
                </p>
                <p className="text-muted-foreground">Keep the resource library and discounts.</p>
              </div>
              <Button size="sm" onClick={() => onSwitch(alt)}>
                Switch
              </Button>
            </div>
          )}
          <div className="text-sm">
            <p className="font-medium">If you cancel:</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>
                You keep {current.name}
                {endsAt ? ` until ${dateText(endsAt)}` : ''}
              </li>
              <li>No further charges</li>
              <li>Your invoices and history stay in your account</li>
            </ul>
          </div>
          {m.error ? <ErrorAlert error={m.error} /> : null}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Keep membership
            </Button>
            <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>
              Confirm cancellation
            </Button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h2 className="text-xl font-semibold">Your cancellation is scheduled</h2>
          <p className="text-sm text-muted-foreground">
            {current.name} stays active until {dateText(endsAt)}. We&apos;ve emailed you a
            confirmation.
          </p>
          {resume.error ? <ErrorAlert error={resume.error} /> : null}
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/membership/account">Back to my membership</Link>
            </Button>
            <Button disabled={resume.isPending} onClick={() => resume.mutate()}>
              Resume membership
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

export function PlanManager() {
  const router = useRouter()
  const qc = useQueryClient()
  const search = useSearchParams()
  const { data: me } = useMe()
  const { data: plans = [] } = usePlans()
  const [cancelling, setCancelling] = useState(search.get('cancel') === '1')
  const [down, setDown] = useState<Plan | null>(null)
  const sub = me?.subscription
  const current = me?.plan
  const interval = (sub?.price?.interval ?? current?.prices?.[0]?.interval) as Interval | undefined

  const goCheckout = (plan: Plan, i: Interval) =>
    router.push(`/membership/checkout?plan=${plan.slug}&interval=${i}`)
  const renew = useMutation({
    mutationFn: () => post('/membership/me/renew', {}),
    onSuccess: () => current && interval && goCheckout(current, interval),
  })
  const change = useMutation({
    mutationFn: (p: Plan) =>
      post<{ next?: string }>('/membership/me/change-plan', { plan_slug: p.slug, interval }),
    onSuccess: async (res, p) => {
      if (res?.next === 'checkout' && interval) return goCheckout(p, interval)
      await qc.invalidateQueries({ queryKey: ['membership'] })
    },
  })
  if (!me || !current || !sub) return <p className="text-sm">You have no plan yet.</p>
  const pending = plans.find((p) => p.id === sub.pending_plan_id)
  const cheaper = plans
    .filter((p) => (p.tier ?? 0) < (current.tier ?? 0) && !p.is_free)
    .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0]
  const close = () => {
    setCancelling(false)
    setDown(null)
  }
  if (cancelling)
    return (
      <Cancel
        current={current}
        alt={cheaper}
        interval={interval}
        endsAt={sub.ends_at}
        onClose={close}
        onSwitch={(p) => (setCancelling(false), setDown(p))}
      />
    )
  if (down && interval)
    return (
      <Downgrade
        from={current}
        to={down}
        interval={interval}
        endsAt={sub.ends_at}
        onClose={close}
      />
    )

  return (
    <div className="space-y-6">
      {pending && (
        <p role="status" className="rounded-xl border bg-muted/40 p-4 text-sm">
          Switching to {pending.name} at your next renewal ({dateText(sub.ends_at)}).
        </p>
      )}
      {sub.cancel_at_period_end && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Your membership is cancelling on {dateText(sub.ends_at)}.
        </p>
      )}
      {change.error ? <ErrorAlert error={change.error} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const price = interval ? priceFor(p, interval) : undefined
          const isCurrent = p.id === current.id
          const up = (p.tier ?? 0) > (current.tier ?? 0)
          const offered = p.is_free || !!price
          return (
            <div
              key={p.id}
              className={`space-y-2 rounded-xl border bg-card p-5 ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}
            >
              <p className="text-lg font-semibold">{p.name}</p>
              <p className="text-2xl font-bold">
                {p.is_free ? 'Free' : price ? money(price.amount, price.currency) : '-'}
                {price && interval && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    / {INTERVAL_LABEL[interval]}
                  </span>
                )}
              </p>
              {isCurrent ? (
                <>
                  <p className="text-sm font-medium text-primary">Your plan</p>
                  {sub.ends_at && !current.is_free && (
                    <Button size="sm" disabled={renew.isPending} onClick={() => renew.mutate()}>
                      Renew now
                    </Button>
                  )}
                </>
              ) : offered ? (
                <Button
                  size="sm"
                  variant={up ? 'default' : 'outline'}
                  disabled={change.isPending || p.id === pending?.id}
                  onClick={() => (up ? change.mutate(p) : setDown(p))}
                >
                  {up ? 'Upgrade now' : p.id === pending?.id ? 'Scheduled' : 'Switch at renewal'}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not offered for{' '}
                  {interval ? INTERVAL_TITLE[interval].toLowerCase() : 'this period'}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {renew.error ? <ErrorAlert error={renew.error} /> : null}
      {!sub.cancel_at_period_end && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) && (
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive"
          onClick={() => setCancelling(true)}
        >
          Cancel membership
        </Button>
      )}
    </div>
  )
}
