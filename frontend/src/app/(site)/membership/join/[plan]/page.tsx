import { JoinFlow } from '@/frontend/membership/JoinFlow'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ plan: string }>
  searchParams: Promise<{ interval?: string }>
}) {
  const { plan } = await params
  const { interval } = await searchParams
  return <JoinFlow planSlug={plan} interval={interval} />
}
