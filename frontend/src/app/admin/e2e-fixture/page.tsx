'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function E2eFixturePage() {
  return (
    <ModuleGuard slug="e2e-fixture">
      <div className="p-6">
        <PageHeader title="E2E Fixture" />
        <p className="mt-4 text-gray-500">TODO: implement E2E Fixture UI</p>
      </div>
    </ModuleGuard>
  )
}
