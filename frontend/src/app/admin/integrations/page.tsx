'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function IntegrationsPage() {
  return (
    <ModuleGuard slug="integrations">
      <div className="p-6">
        <PageHeader title="Integrations" />
        <p className="mt-4 text-gray-500">TODO: implement Integrations UI</p>
      </div>
    </ModuleGuard>
  )
}
