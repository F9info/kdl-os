import { Checkout } from '@/frontend/membership/Checkout'
import type { Interval } from '@/frontend/membership/types'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>
}) {
  const { plan, interval } = await searchParams
  return <Checkout planSlug={plan ?? ''} interval={(interval ?? 'YEARLY') as Interval} />
}
