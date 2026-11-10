'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { post, useMe, usePlans, useProviders } from './api'
import { INTERVAL_TITLE, money, priceFor, priceTotals } from './format'
import { useMemberSession } from './useMemberSession'
import { loadRazorpay } from './razorpay'
import type { Interval, Payment, Provider } from './types'

interface Order {
  id: string
  amount?: number
  currency?: string
  key_id?: string
  key?: string
}
interface CheckoutResult {
  payment: Payment
  order?: Order
  instructions?: Record<string, unknown>
}

// Bank/UPI details the admin chose to show. Anything that looks like a credential is never rendered.
const SECRET = /secret|token|credential|password|private|api_?key/i
const safeEntries = (o?: Record<string, unknown>) =>
  Object.entries(o ?? {}).filter(
    ([k, v]) => !SECRET.test(k) && (typeof v === 'string' || typeof v === 'number')
  )

export function Checkout({ planSlug, interval }: { planSlug: string; interval: Interval }) {
  const router = useRouter()
  const session = useMemberSession()
  const me = useMe(session.ready)
  const { data: plans } = usePlans()
  const providers = useProviders(session.ready ? planSlug : undefined, interval)
  const [chosen, setChosen] = useState<Provider | null>(null)
  const [manual, setManual] = useState<CheckoutResult | null>(null)
  const [utr, setUtr] = useState('')
  const [note, setNote] = useState('')

  const plan = plans?.find((p) => p.slug === planSlug)
  const price = plan ? priceFor(plan, interval) : undefined
  const done = (state: string) => router.push(`/membership/success?state=${state}`)
  const approval = plan?.approval_mode === 'MANUAL' ? 'approval' : 'active'

  const confirm = useMutation({
    mutationFn: (body: { id: string; data: unknown }) =>
      post(`/membership/payments/${body.id}/confirm`, body.data),
    onSuccess: () => done(approval),
  })

  const pay = useMutation({
    mutationFn: (p: Provider) =>
      post<CheckoutResult>('/membership/checkout', {
        plan_slug: planSlug,
        interval,
        provider_id: p.id,
      }),
    onSuccess: async (res) => {
      if (res.order) {
        const Razorpay = await loadRazorpay()
        new Razorpay({
          key: res.order.key_id ?? res.order.key,
          order_id: res.order.id,
          amount: res.order.amount,
          currency: res.order.currency,
          name: plan?.name,
          prefill: {
            name: me.data?.member.full_name,
            email: me.data?.member.email,
            contact: me.data?.member.mobile,
          },
          handler: (r: unknown) => confirm.mutate({ id: res.payment.id, data: r }),
        }).open()
      } else {
        setManual(res)
      }
    },
  })

  const proof = useMutation({
    mutationFn: () =>
      post(`/membership/payments/${manual!.payment.id}/offline-proof`, {
        utr,
        note: note || undefined,
      }),
    onSuccess: () => done('verifying'),
  })

  if (!session.ready) return <LoadingSpinner />
  if (providers.isLoading) return <LoadingSpinner />
  const list = providers.data ?? []
  const err = pay.error ?? confirm.error ?? providers.error

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_280px]">
      <section className="space-y-5">
        <h1 className="text-2xl font-bold">Checkout</h1>

        {!manual && (
          <>
            <h2 className="font-medium">Choose how to pay</h2>
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No payment method is available for this plan right now. Please contact us.
              </p>
            )}
            <div className="space-y-3" role="radiogroup" aria-label="Payment method">
              {list.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 ${chosen?.id === p.id ? 'border-primary' : ''}`}
                >
                  <input
                    type="radio"
                    name="provider"
                    className="mt-1"
                    checked={chosen?.id === p.id}
                    onChange={() => setChosen(p)}
                  />
                  <span>
                    <span className="block font-medium">{p.label}</span>
                    {p.description && (
                      <span className="block text-sm text-muted-foreground">{p.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {err && <ErrorAlert error={err} />}
            <Button
              disabled={!chosen || pay.isPending || confirm.isPending}
              onClick={() => chosen && pay.mutate(chosen)}
            >
              {chosen?.type === 'MANUAL'
                ? 'Continue'
                : price
                  ? `Pay ${money(priceTotals(price).total, price.currency)}`
                  : 'Pay'}
            </Button>
          </>
        )}

        {manual && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 text-sm">
              <h2 className="mb-2 font-medium">Transfer the amount to</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {safeEntries(manual.instructions).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Reference: {manual.payment.reference}
              </p>
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (utr.trim()) proof.mutate()
              }}
            >
              <FormField label="UTR / transaction reference" required>
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} />
              </FormField>
              <FormField label="Note (optional)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </FormField>
              {proof.error && <ErrorAlert error={proof.error} />}
              <Button type="submit" disabled={!utr.trim() || proof.isPending}>
                Submit payment details
              </Button>
            </form>
          </div>
        )}
      </section>

      <aside
        className="h-fit space-y-1 rounded-xl border bg-card p-4 text-sm"
        aria-label="Order summary"
      >
        <h2 className="font-semibold">{plan?.name ?? 'Plan'}</h2>
        <p className="text-muted-foreground">{INTERVAL_TITLE[interval]}</p>
        {price && (
          <>
            <p>Price {money(priceTotals(price).subtotal, price.currency)}</p>
            <p>
              GST {price.gst_rate}% {money(priceTotals(price).tax, price.currency)}
            </p>
            <p className="font-bold">Total {money(priceTotals(price).total, price.currency)}</p>
          </>
        )}
      </aside>
    </div>
  )
}
