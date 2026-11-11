'use client'

import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ImportWizard } from '../../_components/ImportWizard'

export default function ImportMembersPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:add">
        <ImportWizard />
      </PermissionGuard>
    </ModuleGuard>
  )
}
