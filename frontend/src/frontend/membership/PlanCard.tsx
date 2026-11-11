import Link from 'next/link'
import { Check } from 'lucide-react'
import { INTERVAL_LABEL, joinHref, moneyShort, priceFor } from './format'
import type { Interval, Plan } from './types'

/** One pricing card. Everything on it (price, GST note, benefits, badge) comes from the plan. */
export function PlanCard({ plan, interval }: { plan: Plan; interval: Interval }) {
  const price = priceFor(plan, interval)
  const featured = plan.is_featured
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-8 ${featured ? 'border-2 border-primary shadow-xl' : ''}`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      )}
      <h2 className="text-lg font-semibold">{plan.name}</h2>
      <p className="mt-3 flex items-baseline gap-1.5">
        {plan.is_free ? (
          <span className="text-4xl font-extrabold">{moneyShort(0)}</span>
        ) : price ? (
          <>
            <span className="text-4xl font-extrabold">
              {moneyShort(price.amount, price.currency)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {INTERVAL_LABEL[price.interval]}
              {price.tax_mode === 'EXCLUSIVE' ? ' + GST' : ' incl. GST'}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Not offered for this period</span>
        )}
      </p>
      <hr className="my-5" />
      <ul className="mb-6 flex-1 space-y-2.5 text-sm">
        {plan.benefits.map((b, i) => (
          <li key={b.id ?? i} className="flex items-center gap-2.5">
            <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
            <span className={b.highlighted ? 'font-medium' : ''}>{b.text}</span>
          </li>
        ))}
      </ul>
      {(plan.is_free || price) && (
        <Link
          href={joinHref(plan, interval)}
          className={`flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${featured ? 'bg-primary text-primary-foreground hover:opacity-90' : 'border bg-card hover:bg-muted/50'}`}
        >
          {plan.is_free ? 'Join free' : `Choose ${plan.name}`}
        </Link>
      )}
    </div>
  )
}
