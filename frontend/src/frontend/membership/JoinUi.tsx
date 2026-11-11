import Link from 'next/link'
import { Check, Crown, Lock } from 'lucide-react'
import { INTERVAL_TITLE, money, periodText, priceTotals } from './format'
import type { Interval, Plan, PlanPrice } from './types'

export const cardCls = 'rounded-2xl border bg-card p-7'

export function Crumbs({ plan, current }: { plan?: string; current: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <Link href="/membership" className="hover:underline">
        Membership
      </Link>
      {plan && <> › {plan}</>} › <b className="text-foreground">{current}</b>
    </p>
  )
}

/** Numbered progress: done steps show a tick, the current one is filled. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li
          key={s}
          className="flex items-center gap-2"
          aria-current={i === current ? 'step' : undefined}
        >
          <span
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-bold ${i <= current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={i === current ? 'font-semibold' : 'text-muted-foreground'}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 text-muted-foreground">—</span>}
        </li>
      ))}
    </ol>
  )
}

/** Plan, price rows (CGST/SGST split), total and the pay button. Numbers come from the plan price. */
export function OrderSummary({
  plan,
  price,
  interval,
  note,
  action,
  extra,
}: {
  plan: Plan
  price?: PlanPrice
  interval?: Interval
  note?: React.ReactNode
  action?: React.ReactNode
  extra?: string
}) {
  const t = price && !plan.is_free ? priceTotals(price) : null
  const half = t ? Math.round(t.tax / 2) : 0
  return (
    <aside className={`${cardCls} h-fit space-y-3`} aria-label="Order summary">
      <h3 className="text-base font-semibold">Order summary</h3>
      <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Crown className="h-4 w-4" aria-hidden />
        </span>
        <div className="flex-1 text-sm">
          <b>{plan.name}</b>
          <div className="text-xs text-muted-foreground">
            {interval ? `${INTERVAL_TITLE[interval]} · ${periodText(interval)}` : 'Free plan'}
          </div>
        </div>
        <Link href="/membership" className="text-xs text-primary hover:underline">
          Change
        </Link>
      </div>
      {t && price && (
        <>
          <Row
            k={`${plan.name} · ${INTERVAL_TITLE[price.interval]}${extra ?? ''}`}
            v={money(t.subtotal, price.currency)}
          />
          <Row k={`CGST ${price.gst_rate / 2}%`} v={money(half, price.currency)} />
          <Row k={`SGST ${price.gst_rate / 2}%`} v={money(t.tax - half, price.currency)} />
          <div className="flex items-center justify-between border-t pt-3">
            <b>Total</b>
            <b className="text-2xl">{money(t.total, price.currency)}</b>
          </div>
        </>
      )}
      {action}
      {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
    </aside>
  )
}
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{k}</span>
    <span>{v}</span>
  </div>
)

export const payLabel = (price?: PlanPrice, free?: boolean) =>
  free || !price ? (
    'Create free membership'
  ) : (
    <>
      <Lock className="h-4 w-4" aria-hidden /> Pay {money(priceTotals(price).total, price.currency)}
    </>
  )

/** Slim "Your membership" card used beside the detail steps. */
export function MiniSummary({
  plan,
  price,
  interval,
  who,
}: {
  plan: Plan
  price?: PlanPrice
  interval?: Interval
  who: string
}) {
  return (
    <aside className={`${cardCls} h-fit space-y-3`} aria-label="Your membership">
      <h3 className="text-base font-semibold">Your membership</h3>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Crown className="h-4 w-4" aria-hidden />
        </span>
        <div className="text-sm">
          <b>
            {plan.name}
            {interval ? ` · ${INTERVAL_TITLE[interval]}` : ''}
          </b>
          <div className="text-xs text-muted-foreground">{who}</div>
        </div>
      </div>
      {price && !plan.is_free && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total incl. GST</span>
          <b>{money(priceTotals(price).total, price.currency)}</b>
        </div>
      )}
    </aside>
  )
}
