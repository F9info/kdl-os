import { Suspense } from 'react'
import { AuthForgot } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthForgot />
    </Suspense>
  )
}
