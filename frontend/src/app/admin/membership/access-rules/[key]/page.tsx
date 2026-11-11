'use client'

import { useParams } from 'next/navigation'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { AccessRuleEditor } from '../../_components/AccessRuleEditor'

export default function AccessRulePage() {
  const { key } = useParams<{ key: string }>()
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:edit">
        <AccessRuleEditor key={key} ruleKey={key} />
      </PermissionGuard>
    </ModuleGuard>
  )
}
