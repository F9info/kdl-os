import { Success } from '@/frontend/membership/Success'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) {
  const { state } = await searchParams
  return <Success state={state} />
}
