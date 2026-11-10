'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { usePlans } from './api'
import { intervalsOf, INTERVAL_TITLE } from './format'
import { PlanCard } from './PlanCard'
import type { Interval } from './types'

export function Pricing() {
  const { data: plans, isLoading, error } = usePlans()
  const [picked, setPicked] = useState<Interval | null>(null)
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorAlert error={error} />
  if (!plans?.length) return <p className="text-center text-muted-foreground">No plans yet.</p>
  const intervals = intervalsOf(plans)
  const interval = picked ?? intervals.find((i) => i === 'YEARLY') ?? intervals[0] ?? 'YEARLY'
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Membership</h1>
        <p className="text-muted-foreground">
          Pick the plan that fits you. Upgrade or cancel any time.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {intervals.length > 1 && (
          <div
            role="group"
            aria-label="Billing period"
            className="inline-flex rounded-lg border p-1"
          >
            {intervals.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === interval}
                onClick={() => setPicked(i)}
                className={`rounded-md px-3 py-1 text-sm capitalize ${i === interval ? 'bg-primary text-primary-foreground' : ''}`}
              >
                {INTERVAL_TITLE[i]}
              </button>
            ))}
          </div>
        )}
        <Link href="/membership/compare" className="text-sm text-primary hover:underline">
          Compare all features
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} interval={interval} />
        ))}
      </div>
    </div>
  )
}
