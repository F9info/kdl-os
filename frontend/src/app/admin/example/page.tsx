'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ExamplePage() {
  return (
    <ModuleGuard slug="example">
      <div>
        <PageHeader title="Example" />
        <p className="mt-4 text-muted-foreground">TODO: implement Example UI</p>
      </div>
    </ModuleGuard>
  )
}
