import { Suspense } from 'react'
import { AuthReset } from '@/frontend/membership/AuthPages'

export default function Page() {
  return (
    <Suspense>
      <AuthReset />
    </Suspense>
  )
}
