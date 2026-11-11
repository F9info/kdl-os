'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Crown, Eye, IndianRupee, Layers, Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { rupees, useAdminAction, usePlans, type Plan } from '@/admin/hooks/useMembership'
import { PlanArchiveModal } from '../_components/PlanArchiveModal'
import { PlansTable, memberCount } from '../_components/PlansTable'
import { StatCard } from '../_components/OverviewParts'

function PlansContent() {
  const { data, isLoading, error } = usePlans()
  const action = useAdminAction()
  const [archive, setArchive] = useState<Plan | null>(null)
  // optimistic order while the PUT is in flight; server order wins after refetch
  const [order, setOrder] = useState<string[] | null>(null)

  const items = data?.items ?? []
  const plans = order ? [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : items
  const stats = (data as { stats?: Record<string, number> } | undefined)?.stats
  const paid =
    stats?.paid_members ?? items.filter((p) => !p.is_free).reduce((s, p) => s + memberCount(p), 0)

  function reorder(ids: string[]) {
    setOrder(ids)
    action.mutate(
      { method: 'put', path: 'plans/order', data: { ids } },
      {
        onSuccess: () => toast({ title: 'Plan order saved' }),
        onError: () => setOrder(null),
      }
    )
  }

  return (
    <div>
      <PageHeader
        title="Plans"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Plans — drag to reorder the pricing page' },
        ]}
        action={
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/membership" target="_blank">
                <Eye className="h-4 w-4" /> Preview pricing page
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/membership/plans/new">
                <Plus className="h-4 w-4" /> New plan
              </Link>
            </Button>
          </div>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <PlansTable plans={plans} onReorder={reorder} onArchive={setArchive} />
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total plans"
          value={stats?.total_plans ?? items.length}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Paid members"
          value={paid.toLocaleString('en-IN')}
          icon={<Crown className="h-4 w-4" />}
        />
        <StatCard
          label="Avg. revenue / member"
          value={
            stats?.avg_revenue_per_member !== undefined ? rupees(stats.avg_revenue_per_member) : '—'
          }
          icon={<IndianRupee className="h-4 w-4" />}
        />
      </div>
      <PlanArchiveModal plan={archive} onClose={() => setArchive(null)} />
    </div>
  )
}

export default function PlansPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <PlansContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
