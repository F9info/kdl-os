import { formatDate } from '@/lib/utils'

/** "07 Nov 2026" - the one date style the member screens use. */
export const dmy = (d?: string | null) => (d ? formatDate(d, 'dd MMM yyyy') : '—')
export const dmyTime = (d?: string | null) => (d ? formatDate(d, 'dd MMM yyyy, h:mm a') : '—')
export const isoDay = (d: Date) => d.toISOString().slice(0, 10)
export const addMonths = (from: Date, n: number) => {
  const d = new Date(from)
  d.setMonth(d.getMonth() + n)
  return d
}
export const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 86_400_000)
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
