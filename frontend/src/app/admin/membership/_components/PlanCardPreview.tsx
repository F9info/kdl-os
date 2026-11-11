import { Check } from 'lucide-react'
import { rupees, type Plan } from '@/admin/hooks/useMembership'
import { humanize } from './ui'

/** Public pricing-card preview, rendered from the same plan data the pricing page uses. */
export function PlanCardPreview({
  plan,
  name,
  badge,
}: {
  plan?: Plan
  name?: string
  badge?: string | null
}) {
  const prices = (plan?.prices ?? []).filter((p) => p.is_active)
  const price = prices.find((p) => p.is_default) ?? prices[0]
  const label = badge || (plan?.is_featured ? 'Most popular' : '')
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold">Card preview</h2>
      <div className="relative rounded-lg border-2 border-primary p-5">
        {label && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
            {label}
          </span>
        )}
        <p className="text-sm font-medium">{name || plan?.name || 'Plan name'}</p>
        <p className="my-2 text-3xl font-bold">
          {plan?.is_free || !price ? '₹0' : rupees(price.amount).replace(/\.00$/, '')}
          {price && !plan?.is_free && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {humanize(price.interval).toLowerCase()}
              {price.tax_mode === 'EXCLUSIVE' ? ' + GST' : ''}
            </span>
          )}
        </p>
        <ul className="space-y-2 text-sm">
          {(plan?.benefits ?? []).map((b, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" /> {b.text}
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-md bg-primary py-2 text-center text-sm font-medium text-primary-foreground">
          Join {name || plan?.name || 'plan'}
        </div>
      </div>
    </section>
  )
}
