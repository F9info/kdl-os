import Link from 'next/link'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { INTERVAL_LABEL, money, priceFor } from './format'
import type { Interval, Plan } from './types'

/** One pricing card. Everything on it (price, GST note, benefits, badge) comes from the plan. */
export function PlanCard({ plan, interval }: { plan: Plan; interval: Interval }) {
  const price = priceFor(plan, interval)
  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-card p-6 ${plan.is_featured ? 'border-primary shadow-md' : ''}`}
    >
      {plan.is_featured && <Badge className="absolute -top-3 left-6">Most popular</Badge>}
      <h2 className="text-xl font-semibold">{plan.name}</h2>
      {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
      <p className="mt-4">
        {plan.is_free ? (
          <span className="text-3xl font-bold">{money(0)}</span>
        ) : price ? (
          <>
            <span className="text-3xl font-bold">{money(price.amount, price.currency)}</span>{' '}
            <span className="text-sm text-muted-foreground">
              / {INTERVAL_LABEL[price.interval]}
              {price.tax_mode === 'EXCLUSIVE' ? ' + GST' : ' incl. GST'}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Not offered for this period</span>
        )}
      </p>
      <ul className="my-5 flex-1 space-y-2 text-sm">
        {plan.benefits.map((b, i) => (
          <li key={b.id ?? i} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className={b.highlighted ? 'font-medium' : ''}>{b.text}</span>
          </li>
        ))}
      </ul>
      {(plan.is_free || price) && (
        <Link
          href={`/membership/join/${plan.slug}?interval=${interval}`}
          className="rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
        >
          {plan.is_free ? 'Join free' : `Choose ${plan.name}`}
        </Link>
      )}
    </div>
  )
}
