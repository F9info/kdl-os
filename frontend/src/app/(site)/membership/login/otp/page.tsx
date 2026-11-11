import { Suspense } from 'react'
import { AuthOtp } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthOtp mode="login" />
    </Suspense>
  )
}
