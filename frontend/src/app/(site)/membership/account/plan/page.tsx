import { Suspense } from 'react'
import { PlanManager } from '@/frontend/membership/PlanManager'

export default function Page() {
  return (
    <Suspense>
      <PlanManager />
    </Suspense>
  )
}
