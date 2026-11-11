import { Success } from '@/frontend/membership/Success'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; plan?: string; interval?: string; ref?: string }>
}) {
  const { state, plan, interval, ref } = await searchParams
  return <Success state={state} plan={plan} interval={interval} reference={ref} />
}
