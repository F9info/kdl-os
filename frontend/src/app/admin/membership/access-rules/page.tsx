'use client'

import { useState } from 'react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlan, usePlans } from '@/admin/hooks/useMembership'
import { AccessRulesEditor } from '../_components/PlanTabs'
import { Card, NativeSelect } from '../_components/ui'

function AccessRulesContent() {
  const { data: plans, isLoading, error } = usePlans()
  const [picked, setPicked] = useState('')
  const planId = picked || plans?.items[0]?.id || ''
  const { data: plan } = usePlan(planId || null)
  return (
    <div>
      <PageHeader
        title="Access rules"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Access rules' },
        ]}
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (plans?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a plan first, then choose what it unlocks.
        </p>
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <FormField label="Plan">
              <NativeSelect
                value={planId}
                onChange={(e) => setPicked(e.target.value)}
                options={(plans?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            </FormField>
          </div>
          <Card title="Members-only content for this plan">
            {plan ? (
              <AccessRulesEditor
                key={plan.id + (plan.access_rules?.length ?? 0)}
                planId={plan.id}
                initial={plan.access_rules ?? []}
              />
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default function AccessRulesPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <AccessRulesContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
