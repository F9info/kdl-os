'use client'

import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { usePlans } from './api'
import { money } from './format'

/** Benefit matrix: rows are every distinct benefit text across plans, columns are the plans. */
export function Compare() {
  const { data: plans, isLoading, error } = usePlans()
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert error={error} />
  if (!plans?.length) return null
  const rows = [...new Set(plans.flatMap((p) => p.benefits.map((b) => b.text)))]
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Compare plans</h1>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left font-medium">Feature</th>
              {plans.map((p) => {
                const lowest = p.prices.length ? Math.min(...p.prices.map((x) => x.amount)) : 0
                return (
                  <th key={p.id} className="p-3 text-center">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {p.is_free ? 'Free' : `from ${money(lowest)}`}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="border-b last:border-0">
                <td className="p-3">{r}</td>
                {plans.map((p) => (
                  <td key={p.id} className="p-3 text-center">
                    {p.benefits.some((b) => b.text === r) ? (
                      <Check className="mx-auto h-4 w-4 text-primary" aria-label="Included" />
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
          </tbody>
        </table>
      </div>
      <Link href="/membership" className="text-sm text-primary hover:underline">
        Back to plans
      </Link>
    </div>
  )
}
