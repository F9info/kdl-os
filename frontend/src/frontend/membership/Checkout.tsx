'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { post, useMe, usePlans, useProviders } from './api'
import { money, priceFor, priceTotals } from './format'
import { cardCls, Crumbs, OrderSummary, payLabel } from './JoinUi'
import { outlineBtn, primaryBtn } from './AuthShell'
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
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10))
  const [copied, setCopied] = useState('')

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
        const rp = new Razorpay({
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
        })
        rp.on('payment.failed', () =>
          router.push(
            `/membership/success?state=failed&plan=${planSlug}&interval=${interval}&ref=${res.payment.reference}`
          )
        )
        rp.open()
      } else {
        setManual(res)
      }
    },
  })

  const proof = useMutation({
    mutationFn: () =>
      post(`/membership/payments/${manual!.payment.id}/offline-proof`, {
        utr,
        note: [`Paid on ${paidOn}`, note].filter(Boolean).join(' · '),
      }),
    onSuccess: () => done('verifying'),
  })

  if (!session.ready) return <LoadingSpinner />
  if (providers.isLoading) return <LoadingSpinner />
  const list = providers.data ?? []
  const err = pay.error ?? confirm.error ?? providers.error
  const total = price ? money(priceTotals(price).total, price.currency) : ''
  const copy = (k: string, v: string) => {
    navigator.clipboard?.writeText(v).then(() => setCopied(k))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-2">
      <Crumbs plan={plan?.name} current="Payment" />
      <h1 className="text-4xl font-extrabold tracking-tight">
        {manual ? 'Pay by bank transfer' : 'Choose how to pay'}
      </h1>
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className={`${cardCls} space-y-4`}>
          {!manual && (
            <>
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No payment method is available for this plan right now. Please contact us.
                </p>
              )}
              <div className="space-y-3" role="radiogroup" aria-label="Payment method">
                {list.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${chosen?.id === p.id ? 'border-2 border-primary bg-primary/5' : ''}`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      className="mt-1"
                      checked={chosen?.id === p.id}
                      onChange={() => setChosen(p)}
                    />
                    <span>
                      <span className="block font-semibold">{p.label}</span>
                      {p.description && (
                        <span className="block text-sm text-muted-foreground">{p.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              {err && <ErrorAlert error={err} />}
              <button
                type="button"
                className={primaryBtn}
                disabled={!chosen || pay.isPending || confirm.isPending}
                onClick={() => chosen && pay.mutate(chosen)}
              >
                {chosen?.type === 'MANUAL' ? 'Continue' : payLabel(price)}
              </button>
            </>
          )}

          {manual && (
            <div className="space-y-4">
              <h2 className="font-semibold">1 · Transfer {total} to</h2>
              <dl className="space-y-2 text-sm">
                {safeEntries(manual.instructions).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                    <dd className="flex items-center gap-3">
                      <b>{String(v)}</b>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => copy(k, String(v))}
                      >
                        {copied === k ? 'Copied' : 'Copy'}
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="rounded-lg bg-muted/50 p-3 text-sm">
                Write <b>{manual.payment.reference}</b> in the transfer remarks so we can match your
                payment.
              </p>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (utr.trim()) proof.mutate()
                }}
              >
                <h2 className="font-semibold">2 · Tell us you&apos;ve paid</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="UTR / reference number" required>
                    <Input value={utr} onChange={(e) => setUtr(e.target.value)} />
                  </FormField>
                  <FormField label="Paid on" required>
                    <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
                  </FormField>
                </div>
                <FormField label="Note (optional)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </FormField>
                {proof.error && <ErrorAlert error={proof.error} />}
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={`${outlineBtn} !w-auto`}
                    onClick={() => setManual(null)}
                  >
                    Change method
                  </button>
                  <button
                    type="submit"
                    className={`${primaryBtn} !w-auto px-6`}
                    disabled={!utr.trim() || proof.isPending}
                  >
                    Submit payment details
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Haven&apos;t paid yet? You can come back to this page from My account — your
                  details are saved.
                </p>
              </form>
            </div>
          )}
        </section>

        {plan && (
          <OrderSummary
            plan={plan}
            price={price}
            interval={interval}
            note={
              manual
                ? 'GST invoice is issued after we confirm the payment.'
                : plan.approval_mode === 'MANUAL'
                  ? 'Needs admin approval. Full refund if not approved.'
                  : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
