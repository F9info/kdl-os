'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Crown, FileText, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { usePlans } from './api'
import { intervalsOf, INTERVAL_TITLE, yearlySavingPct } from './format'
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
  const save = yearlySavingPct(plans)
  return (
    <div className="space-y-8 py-4">
      <div className="space-y-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Crown className="h-3.5 w-3.5" aria-hidden /> Membership
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight">Become a member</h1>
        <p className="text-lg text-muted-foreground">
          Pick the plan that fits you. Upgrade or cancel any time.
        </p>
        {intervals.length > 1 && (
          <div
            role="group"
            aria-label="Billing period"
            className="mt-2 inline-flex overflow-hidden rounded-md border text-sm"
          >
            {intervals.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === interval}
                onClick={() => setPicked(i)}
                className={`px-3.5 py-1.5 font-medium ${i === interval ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
              >
                {INTERVAL_TITLE[i]}
                {i === 'YEARLY' && save > 0 ? ` · save ${save}%` : ''}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm">
          <Link href="/membership/compare" className="text-primary hover:underline">
            Compare all features →
          </Link>
        </p>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 pt-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} interval={interval} />
        ))}
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
        {[
          [ShieldCheck, 'Secure payments'],
          [Smartphone, 'UPI · Cards · Netbanking'],
          [FileText, 'GST invoice'],
          [RefreshCw, 'Cancel anytime'],
        ].map(([Icon, text]) => {
          const I = Icon as typeof Crown
          return (
            <li key={text as string} className="flex items-center gap-1.5">
              <I className="h-4 w-4" aria-hidden /> {text as string}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
