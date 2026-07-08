'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function NotificationsPage() {
  return (
    <ModuleGuard slug="notifications">
      <div className="p-6">
        <PageHeader title="Notifications" />
        <p className="mt-4 text-gray-500">TODO: implement Notifications UI</p>
      </div>
    </ModuleGuard>
  )
}
