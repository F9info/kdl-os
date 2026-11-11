import { Suspense } from 'react'
import { AuthEmailSignup } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthEmailSignup />
    </Suspense>
  )
}
