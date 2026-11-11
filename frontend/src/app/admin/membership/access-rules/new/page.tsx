'use client'

import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { AccessRuleEditor } from '../../_components/AccessRuleEditor'

export default function NewAccessRulePage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:add">
        <AccessRuleEditor ruleKey="new" />
      </PermissionGuard>
    </ModuleGuard>
  )
}
