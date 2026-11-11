import { Suspense } from 'react'
import { AuthVerifyEmail } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthVerifyEmail />
    </Suspense>
  )
}
