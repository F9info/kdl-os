'use client'

import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, CreditCard, Download, Layers, RefreshCw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { post, useInvoices, useLibrary, useMe, usePayments } from './api'
import { INTERVAL_TITLE, dateText, money, priceFor, priceTotals } from './format'
import type { Subscription } from './types'

const DAY = 86_400_000
const days = (to?: string | null) =>
  to ? Math.max(0, Math.ceil((+new Date(to) - Date.now()) / DAY)) : 0

type Tone = 'ok' | 'warn' | 'bad' | 'idle'
const HERO: Record<Tone, string> = {
  ok: 'from-primary to-primary/70',
  warn: 'from-amber-700 to-amber-500',
  bad: 'from-red-800 to-red-600',
  idle: 'from-slate-700 to-slate-500',
}

interface View {
  tone: Tone
  label: string
  title?: string
  text?: string
  sub: string
  note?: string
  progress?: number
}

/** One place that turns subscription state into the banner, status pill and hero copy. */
function view(sub: Subscription, verifying: boolean): View {
  const ends = dateText(sub.ends_at)
  const grace = dateText(sub.grace_ends_at)
  if (sub.cancel_at_period_end && ['ACTIVE', 'TRIALING'].includes(sub.status))
    return {
      tone: 'warn',
      label: `Cancels ${ends}`,
      title: `Your membership will end on ${ends}`,
      text: 'Changed your mind? Resume with one click - nothing else changes.',
      sub: `You keep all benefits until ${ends} · no further charges`,
    }
  switch (sub.status) {
    case 'PAST_DUE':
      return {
        tone: 'warn',
        label: 'Past due',
        title: 'Your renewal payment is due',
        text: `You still have access until ${grace}. Renew now to keep your benefits without a break.`,
        sub: `Ended ${ends} · grace period active`,
        note: `Grace period ends ${grace} · ${days(sub.grace_ends_at)} days left`,
      }
    case 'EXPIRED':
      return {
        tone: 'idle',
        label: 'Expired',
        title: 'Your membership has expired',
        text: 'Rejoin any time - your new membership starts on the day you pay.',
        sub: `Expired on ${ends}`,
        note: 'Members-only content is locked · your history and invoices are kept',
      }
    case 'REJECTED':
      return {
        tone: 'bad',
        label: 'Not approved',
        title: 'Your application was not approved',
        text: sub.rejected_reason ? `Reason: ${sub.rejected_reason}` : undefined,
        sub: `Application of ${dateText(sub.starts_at)}`,
        note: 'Any payment you made is refunded in full.',
      }
    case 'PENDING_APPROVAL':
      return {
        tone: 'idle',
        label: 'Pending approval',
        title: 'Your application is being reviewed',
        text: "We'll email you as soon as it's approved. Members-only content unlocks after approval.",
        sub: 'Payment received',
        note: 'Usually approved within 1 working day',
      }
    case 'PENDING_PAYMENT':
      return verifying
        ? {
            tone: 'idle',
            label: 'Payment under verification',
            title: 'We are checking your bank transfer',
            text: "Then your application goes for approval. We'll email you at each step.",
            sub: 'Bank transfer submitted',
            note: 'We verify bank transfers within 1 working day',
          }
        : {
            tone: 'warn',
            label: 'Payment pending',
            title: 'Complete your payment',
            text: 'Your membership starts as soon as the payment is done.',
            sub: 'Waiting for payment',
          }
    case 'SUSPENDED':
      return {
        tone: 'bad',
        label: 'Suspended',
        title: 'Your membership is suspended',
        text: 'Please contact us.',
        sub: '',
      }
    default: {
      const start = sub.starts_at ? +new Date(sub.starts_at) : Date.now()
      const end = sub.ends_at ? +new Date(sub.ends_at) : 0
      return {
        tone: 'ok',
        label: 'Active',
        sub: sub.ends_at
          ? `Renews on ${ends} · ${days(sub.ends_at)} days left`
          : 'Lifetime membership',
        progress: end
          ? Math.min(100, Math.max(2, ((Date.now() - start) / (end - start)) * 100))
          : 100,
      }
    }
  }
}

export function Dashboard() {
  const qc = useQueryClient()
  const { data } = useMe()
  const invoices = useInvoices()
  const payments = usePayments()
  const library = useLibrary()
  const resume = useMutation({
    mutationFn: () => post('/membership/me/resume', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['membership'] }),
  })
  if (!data) return null
  const { member, subscription: sub, plan } = data
  if (!sub || !plan)
    return (
      <p className="rounded-xl border bg-card p-6">
        You have no plan yet.{' '}
        <Link href="/membership" className="text-primary hover:underline">
          Choose a plan
        </Link>
      </p>
    )
  const verifying = (payments.data ?? []).some((p) =>
    ['UNDER_VERIFICATION', 'AWAITING_PROOF'].includes(p.status)
  )
  const v = view(sub, verifying)
  const interval = sub.price?.interval
  const renewTotal = interval && plan.prices ? priceFor(plan, interval) : undefined
  const bad = v.tone === 'bad' || v.tone === 'warn'
  const active = ['ACTIVE', 'TRIALING'].includes(sub.status) && !sub.cancel_at_period_end
  const planLine = `${plan.name}${interval ? ` · ${INTERVAL_TITLE[interval]}` : ''}`
  const btn = (href: string, label: string, Icon: typeof Layers, primary = false) => (
    <Button variant={primary ? 'default' : 'outline'} asChild>
      <Link href={href}>
        <Icon className="mr-2 h-4 w-4" aria-hidden /> {label}
      </Link>
    </Button>
  )
  const actions = (() => {
    if (sub.cancel_at_period_end && active === false && ['ACTIVE', 'TRIALING'].includes(sub.status))
      return (
        <>
          <Button disabled={resume.isPending} onClick={() => resume.mutate()}>
            <Undo2 className="mr-2 h-4 w-4" aria-hidden /> Resume membership
          </Button>
          {btn('/membership/account/invoices', 'Download invoices', Download)}
        </>
      )
    switch (sub.status) {
      case 'PAST_DUE':
        return (
          <>
            {btn(
              '/membership/account/plan',
              `Renew now${renewTotal ? ` · ${money(priceTotals(renewTotal).total)}` : ''}`,
              RefreshCw,
              true
            )}
            {btn('/membership/account/plan', 'Change plan', Layers)}
            {btn('/membership/account/payments', 'Update payment method', CreditCard)}
          </>
        )
      case 'EXPIRED':
        return (
          <>
            {btn(`/membership/join?plan=${plan.slug}`, `Rejoin ${plan.name}`, RefreshCw, true)}
            {btn('/membership', 'See all plans', Layers)}
            {btn('/membership/account/invoices', 'Download invoices', Download)}
          </>
        )
      case 'REJECTED':
        return (
          <>
            {btn(`/membership/join?plan=${plan.slug}`, 'Re-apply', RefreshCw, true)}
            {btn('/membership', 'Join another plan', Layers)}
          </>
        )
      case 'PENDING_APPROVAL':
        return (
          <>
            {btn('/membership/account/invoices', 'Download invoice', Download)}
            {btn('/membership/account/profile', 'Edit my details', Layers)}
          </>
        )
      case 'PENDING_PAYMENT':
        return (
          <>
            {!verifying &&
              btn(
                `/membership/checkout?plan=${plan.slug}${interval ? `&interval=${interval}` : ''}`,
                'Complete payment',
                CreditCard,
                true
              )}
            {btn('/membership/account/profile', 'Edit my details', Layers)}
          </>
        )
      case 'SUSPENDED':
        return null
      default:
        return (
          <>
            {btn('/membership/account/plan', 'Renew early', RefreshCw, true)}
            {btn('/membership/account/plan', 'Upgrade plan', Layers)}
            {btn('/membership/account/card', 'Download member card', Download)}
            <Button variant="outline" asChild className="border-destructive/40 text-destructive">
              <Link href="/membership/account/plan?cancel=1">Cancel membership</Link>
            </Button>
          </>
        )
    }
  })()

  return (
    <div className="space-y-5">
      {v.title && (
        <div
          role="status"
          className={`flex gap-3 rounded-xl border p-4 text-sm ${bad ? (v.tone === 'bad' ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900') : 'bg-muted/40'}`}
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{v.title}</p>
            {v.text && <p>{v.text}</p>}
          </div>
        </div>
      )}
      <section
        aria-label="Member card"
        className={`rounded-2xl bg-gradient-to-br p-6 text-primary-foreground ${HERO[v.tone]} ${v.tone !== 'ok' ? 'text-white' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">Current plan</p>
            <p className="text-3xl font-bold">{planLine}</p>
            {member.member_no && sub.status !== 'PAST_DUE' && (
              <p className="mt-2 text-sm">Member no. {member.member_no}</p>
            )}
            {v.tone !== 'ok' && <p className="mt-2 text-sm opacity-90">{v.sub}</p>}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-900">
            <span
              className={`h-2 w-2 rounded-full ${v.tone === 'ok' ? 'bg-green-600' : v.tone === 'bad' ? 'bg-red-600' : 'bg-amber-600'}`}
            />
            {v.label}
          </span>
        </div>
        {v.progress !== undefined && (
          <div className="mt-6">
            <div className="h-2 rounded-full bg-white/25" role="presentation">
              <div className="h-2 rounded-full bg-white" style={{ width: `${v.progress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>Member since {dateText(member.member_since)}</span>
              <span>{v.sub}</span>
            </div>
          </div>
        )}
        {v.note && <p className="mt-5 text-sm">{v.note}</p>}
      </section>
      {resume.error ? <ErrorAlert error={resume.error} /> : null}
      <div className="flex flex-wrap gap-3">
        {actions}
        {!['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) && (
          <Button variant="ghost" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        )}
      </div>
      {active && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Resources unlocked', String(library.data?.length ?? 0), 'in your plan'],
            ['Invoices', String(invoices.data?.length ?? 0), 'GST invoices'],
            [
              'Days left',
              sub.ends_at ? String(days(sub.ends_at)) : '∞',
              sub.ends_at ? `until ${dateText(sub.ends_at)}` : 'lifetime',
            ],
          ].map(([k, n, s]) => (
            <div key={k} className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">{k}</p>
              <p className="text-3xl font-bold">{n}</p>
              <p className="text-xs text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
      )}
      {['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(plan.benefits?.length ?? 0) > 0 && (
            <section className="space-y-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Your benefits</h2>
              <ul className="space-y-2 text-sm">
                {plan.benefits.map((b, i) => (
                  <li key={b.id ?? i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
                    {b.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recent invoices</h2>
              <Link
                href="/membership/account/invoices"
                className="text-sm text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            {(invoices.data ?? []).slice(0, 3).map((i) => (
              <Link
                key={i.id}
                href={`/membership/account/invoices/${i.id}`}
                className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
              >
                <span>
                  <span className="block font-semibold">{i.number}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateText(i.issued_at)} · {i.description}
                  </span>
                </span>
                <span>{money(i.total)}</span>
              </Link>
            ))}
            {invoices.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
