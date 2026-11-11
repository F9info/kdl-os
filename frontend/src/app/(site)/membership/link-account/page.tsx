import { Suspense } from 'react'
import { AuthLinkAccount } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthLinkAccount />
    </Suspense>
  )
}
