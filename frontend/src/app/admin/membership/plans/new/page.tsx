'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { PlanForm } from '../../_components/PlanForm'
import { Tabs } from '../../_components/ui'

const TABS = ['Details', 'Pricing', 'Benefits', 'Join form', 'Access']

function NewPlanContent() {
  const router = useRouter()
  const draft = useRef(false)
  return (
    <div>
      <PageHeader
        title="New plan"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Plans', href: '/admin/membership/plans' },
          { label: 'New' },
        ]}
        action={
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/membership/plans">Cancel</Link>
            </Button>
            <Button
              type="submit"
              form="plan-form"
              variant="outline"
              onClick={() => (draft.current = true)}
            >
              Save as draft
            </Button>
            <Button type="submit" form="plan-form" onClick={() => (draft.current = false)}>
              <Check className="h-4 w-4" /> Create plan
            </Button>
          </div>
        }
      />
      <Tabs
        tabs={TABS.map((t) => ({ key: t, label: t }))}
        value="Details"
        onChange={() => undefined}
      />
      <PlanForm asDraft={draft} onSaved={(p) => router.push(`/admin/membership/plans/${p.id}`)} />
      <p className="mt-4 text-sm text-muted-foreground">
        Next: add prices, benefits and join-form fields in the other tabs.
      </p>
    </div>
  )
}

export default function NewPlanPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <NewPlanContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
