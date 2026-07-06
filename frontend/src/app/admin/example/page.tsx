'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ExamplePage() {
  return (
    <ModuleGuard slug="example">
      <div className="p-6">
        <PageHeader title="Example" />
        <p className="mt-4 text-gray-500">TODO: implement Example UI</p>
      </div>
    </ModuleGuard>
  )
}
