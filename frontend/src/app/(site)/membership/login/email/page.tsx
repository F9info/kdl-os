import { Suspense } from 'react'
import { AuthEmailLogin } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthEmailLogin />
    </Suspense>
  )
}
