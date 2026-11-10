import type { Interval, Plan, PlanPrice } from './types'

export const money = (paise: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(
    paise / 100
  )

export const dateText = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : '-'

export const INTERVAL_LABEL: Record<Interval, string> = {
  MONTHLY: 'month',
  QUARTERLY: 'quarter',
  HALF_YEARLY: '6 months',
  YEARLY: 'year',
  LIFETIME: 'lifetime',
}

export const INTERVAL_TITLE: Record<Interval, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
  LIFETIME: 'Lifetime',
}

export const priceFor = (plan: Plan, interval: Interval) =>
  plan.prices.find((p) => p.interval === interval)

/** GST split for display. The server is the source of truth for the charged amount. */
export function priceTotals(p: PlanPrice) {
  const tax =
    p.tax_mode === 'INCLUSIVE'
      ? Math.round(p.amount - p.amount / (1 + p.gst_rate / 100))
      : Math.round((p.amount * p.gst_rate) / 100)
  return {
    subtotal: p.tax_mode === 'INCLUSIVE' ? p.amount - tax : p.amount,
    tax,
    total: p.tax_mode === 'INCLUSIVE' ? p.amount : p.amount + tax,
  }
}

/** Intervals offered across all plans, in a fixed order, so the toggle is data-driven. */
const ORDER: Interval[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME']
export const intervalsOf = (plans: Plan[]) =>
  ORDER.filter((i) => plans.some((p) => p.prices.some((x) => x.interval === i)))

export const asList = <T>(d: unknown): T[] =>
  Array.isArray(d)
    ? d
    : Array.isArray((d as { items?: T[] })?.items)
      ? (d as { items: T[] }).items
      : []
