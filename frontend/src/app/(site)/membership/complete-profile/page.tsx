import { Suspense } from 'react'
import { AuthCompleteProfile } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthCompleteProfile />
    </Suspense>
  )
}
