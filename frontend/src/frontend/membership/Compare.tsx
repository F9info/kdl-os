'use client'

import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { usePlans } from './api'
import { INTERVAL_LABEL, joinHref, moneyShort, priceFor } from './format'
import type { Interval, Plan } from './types'

const shownPrice = (p: Plan) => {
  if (p.is_free) return moneyShort(0)
  const x = priceFor(p, 'YEARLY') ?? p.prices[0]
  return x
    ? `${moneyShort(x.amount, x.currency)}/${INTERVAL_LABEL[x.interval]}`.replace('/year', '/yr')
    : ''
}
const intervalOf = (p: Plan): Interval =>
  priceFor(p, 'YEARLY') ? 'YEARLY' : (p.prices[0]?.interval ?? 'YEARLY')

/** Benefit matrix: rows are every distinct benefit text across plans, columns are the plans. */
export function Compare() {
  const { data: plans, isLoading, error } = usePlans()
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert error={error} />
  if (!plans?.length) return null
  const rows = [...new Set(plans.flatMap((p) => p.benefits.map((b) => b.text)))]
  return (
    <div className="mx-auto max-w-5xl space-y-5 py-4">
      <div>
        <h1 className="text-[32px] font-extrabold">Compare plans</h1>
        <p className="text-muted-foreground">Everything you get with each membership</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="p-4 text-left font-semibold">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="p-4 text-center font-semibold">
                  {p.name}
                  {p.is_featured && (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      Popular
                    </span>
                  )}
                  <div className="mt-0.5 font-bold">{shownPrice(p)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="border-b">
                <td className="p-4">{r}</td>
                {plans.map((p) => (
                  <td key={p.id} className="p-4 text-center">
                    {p.benefits.some((b) => b.text === r) ? (
                      <Check className="mx-auto h-4 w-4 text-green-600" aria-label="Included" />
                    ) : (
                      <Minus
                        className="mx-auto h-4 w-4 text-muted-foreground"
                        aria-label="Not included"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4" />
              {plans.map((p) => (
                <td key={p.id} className="p-4 text-center">
                  {(p.is_free || p.prices.length > 0) && (
                    <Link
                      href={joinHref(p, intervalOf(p))}
                      className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold ${p.is_featured ? 'bg-primary text-primary-foreground' : 'border bg-card hover:bg-muted/50'}`}
                    >
                      {p.is_free ? 'Join free' : `Choose ${p.name}`}
                    </Link>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <Link href="/membership" className="text-sm text-primary hover:underline">
        ← Back to plans
      </Link>
    </div>
  )
}
