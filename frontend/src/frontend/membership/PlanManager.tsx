'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { post, useMe, usePlans } from './api'
import { INTERVAL_TITLE, dateText, money, priceFor } from './format'
import type { Interval, Plan } from './types'

const REASONS = ['Too expensive', 'Not using the benefits', 'Moving to another provider', 'Other']

function Cancel({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [immediately, setImmediately] = useState(false)
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: () =>
      post('/membership/me/cancel', {
        reason: [reason, detail].filter(Boolean).join(': ') || undefined,
        immediately,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['membership'] })
      onDone()
    },
  })
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5" aria-label="Cancel membership">
      <p className="text-sm text-muted-foreground">Step {step} of 3</p>
      {step === 1 && (
        <>
          <h2 className="font-semibold">Why are you leaving?</h2>
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
          <Textarea
            placeholder="Anything we could do better? (optional)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="font-semibold">When should it end?</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="when"
              checked={!immediately}
              onChange={() => setImmediately(false)}
            />
            At the end of the current period (keep your benefits until then)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="when"
              checked={immediately}
              onChange={() => setImmediately(true)}
            />
            Immediately (you lose access now)
          </label>
        </>
      )}
      {step === 3 && (
        <>
          <h2 className="font-semibold">Confirm cancellation</h2>
          <p className="text-sm">
            Your membership will end{' '}
            {immediately ? 'immediately' : 'at the end of the current period'}.
          </p>
          {m.error && <ErrorAlert error={m.error} />}
        </>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => (step === 1 ? onDone() : setStep(step - 1))}>
          {step === 1 ? 'Keep my membership' : 'Back'}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>
            Cancel membership
          </Button>
        )}
      </div>
    </div>
  )
}

export function PlanManager() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { data: plans = [] } = usePlans()
  const [cancelling, setCancelling] = useState(false)
  const sub = me?.subscription
  const current = me?.plan
  const interval = (sub?.price?.interval ?? current?.prices[0]?.interval) as Interval | undefined

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
  if (!me) return null
  const pending = plans.find((p) => p.id === sub?.pending_plan_id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Change plan</h1>
      {current && sub && (
        <div className="space-y-2 rounded-xl border bg-card p-5">
          <p className="font-semibold">
            {current.name}
            {interval ? ` · ${INTERVAL_TITLE[interval]}` : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            {sub.ends_at ? `Valid till ${dateText(sub.ends_at)}` : 'Lifetime'}
            {sub.cancel_at_period_end ? ' · cancelling at the end of the period' : ''}
          </p>
          {pending && <p className="text-sm">Switching to {pending.name} at your next renewal.</p>}
          <div className="flex flex-wrap gap-3">
            {!current.is_free && sub.ends_at && (
              <Button disabled={renew.isPending} onClick={() => renew.mutate()}>
                Renew now
              </Button>
            )}
            {!sub.cancel_at_period_end && !cancelling && (
              <Button variant="outline" onClick={() => setCancelling(true)}>
                Cancel membership
              </Button>
            )}
          </div>
          {renew.error && <ErrorAlert error={renew.error} />}
        </div>
      )}
      {cancelling && <Cancel onDone={() => setCancelling(false)} />}
      <section className="space-y-3">
        <h2 className="font-semibold">Other plans</h2>
        {change.error && <ErrorAlert error={change.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {plans
            .filter((p) => p.id !== current?.id)
            .map((p) => {
              const price = interval ? priceFor(p, interval) : undefined
              const up = (p.tier ?? 0) > (current?.tier ?? 0)
              return (
                <div key={p.id} className="space-y-2 rounded-xl border bg-card p-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.is_free
                      ? 'Free'
                      : price
                        ? money(price.amount, price.currency)
                        : 'Not offered for this period'}
                  </p>
                  {(p.is_free || price) && (
                    <Button
                      size="sm"
                      variant={up ? 'default' : 'outline'}
                      disabled={change.isPending}
                      onClick={() => change.mutate(p)}
                    >
                      {up ? 'Upgrade' : 'Downgrade'}
                    </Button>
                  )}
                  {!up && (
                    <p className="text-xs text-muted-foreground">
                      Takes effect at your next renewal.
                    </p>
                  )}
                </div>
              )
            })}
        </div>
      </section>
    </div>
  )
}
