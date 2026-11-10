'use client'

import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useInvoices, useMe } from './api'
import { dateText, money } from './format'
import { StatusBadge } from './StatusBadge'
import type { Subscription } from './types'

function Banner({ sub }: { sub: Subscription }) {
  const msg: Record<string, string> = {
    PAST_DUE: `Your payment is overdue${sub.grace_ends_at ? `. Renew by ${dateText(sub.grace_ends_at)} to keep access` : ''}.`,
    REJECTED: `Your membership was not approved${sub.rejected_reason ? `: ${sub.rejected_reason}` : ''}. Any payment is refunded.`,
    EXPIRED: 'Your membership has expired. Renew to get your benefits back.',
    PENDING_APPROVAL: 'Your membership is waiting for admin approval.',
    PENDING_PAYMENT: 'Payment is pending. Complete it to activate your membership.',
    SUSPENDED: 'Your membership is suspended. Please contact us.',
  }
  const text = sub.cancel_at_period_end
    ? `Your membership is cancelling and ends on ${dateText(sub.ends_at)}.`
    : msg[sub.status]
  if (!text) return null
  const bad = ['PAST_DUE', 'REJECTED', 'EXPIRED', 'SUSPENDED'].includes(sub.status)
  return (
    <Alert variant={bad ? 'destructive' : 'default'}>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}

export function Dashboard() {
  const { data } = useMe()
  const invoices = useInvoices()
  if (!data) return null
  const { member, subscription: sub, plan } = data
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My membership</h1>
      {sub && <Banner sub={sub} />}
      <section className="space-y-3 rounded-xl border bg-card p-6" aria-label="Member card">
        {sub && plan ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <p className="text-xl font-semibold">{plan.name}</p>
              </div>
              <StatusBadge status={sub.status} />
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Member no.</dt>
                <dd>{member.member_no ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Member since</dt>
                <dd>{dateText(member.member_since)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valid till</dt>
                <dd>{sub.ends_at ? dateText(sub.ends_at) : 'Lifetime'}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/membership/account/plan" className="text-primary hover:underline">
                Renew, upgrade or cancel
              </Link>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => window.print()}
              >
                Print member card
              </button>
            </div>
          </>
        ) : (
          <p>
            You have no plan yet.{' '}
            <Link href="/membership" className="text-primary hover:underline">
              Choose a plan
            </Link>
          </p>
        )}
      </section>
      {plan && plan.benefits.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Your benefits</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.benefits.map((b, i) => (
              <li key={b.id ?? i}>{b.text}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent invoices</h2>
          <Link
            href="/membership/account/invoices"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {(invoices.data ?? []).slice(0, 3).map((i) => (
          <Link
            key={i.id}
            href={`/membership/account/invoices/${i.id}`}
            className="flex justify-between rounded-md border bg-card p-3 text-sm"
          >
            <span>
              {i.number} · {dateText(i.issued_at)}
            </span>
            <span>{money(i.total)}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
