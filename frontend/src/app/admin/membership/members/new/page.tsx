'use client'

import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { MemberCreateForm } from '../../_components/MemberCreateForm'

export default function NewMemberPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:add">
        <MemberCreateForm />
      </PermissionGuard>
    </ModuleGuard>
  )
}
