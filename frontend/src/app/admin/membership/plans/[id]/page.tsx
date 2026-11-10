'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlan } from '@/admin/hooks/useMembership'
import { PlanForm } from '../../_components/PlanForm'
import { AccessTab, BenefitsTab, JoinFormTab, PricingTab } from '../../_components/PlanTabs'
import { Tabs } from '../../_components/ui'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'joinform', label: 'Join form' },
  { key: 'access', label: 'Access' },
]

function PlanEditorContent() {
  const { id } = useParams<{ id: string }>()
  const { data: plan, isLoading, error } = usePlan(id)
  const [tab, setTab] = useState('details')
  return (
    <div>
      <PageHeader
        title={plan?.name ?? 'Plan'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Plans', href: '/admin/membership/plans' },
          { label: plan?.name ?? '…' },
        ]}
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !plan ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'details' && <PlanForm plan={plan} />}
          {tab === 'pricing' && <PricingTab plan={plan} />}
          {tab === 'benefits' && <BenefitsTab plan={plan} />}
          {tab === 'joinform' && <JoinFormTab plan={plan} />}
          {tab === 'access' && <AccessTab plan={plan} />}
        </>
      )}
    </div>
  )
}

export default function PlanEditorPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <PlanEditorContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
