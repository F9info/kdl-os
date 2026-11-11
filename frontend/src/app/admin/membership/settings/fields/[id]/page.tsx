'use client'

import { useParams } from 'next/navigation'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { SettingsPack } from '../../../_components/SettingsPack'

export default function PackPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <SettingsPack id={id} />
      </PermissionGuard>
    </ModuleGuard>
  )
}
