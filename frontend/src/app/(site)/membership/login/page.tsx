import { Suspense } from 'react'
import { AuthMobile } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthMobile mode="login" />
    </Suspense>
  )
}
