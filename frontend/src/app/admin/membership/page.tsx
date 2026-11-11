'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Download, Plus, RefreshCw, Users, IndianRupee } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { rupees, useOverview } from '@/admin/hooks/useMembership'
import api from '@/lib/axios'
import { AddMemberModal } from './_components/AddMemberModal'
import {
  ChurnChart,
  PlanMixBars,
  RangeTabs,
  RecentMembersTable,
  StatCard,
  delta,
  type Range,
} from './_components/OverviewParts'

async function exportMembers() {
  const res = await api.get('/membership/admin/members/export', {
    params: { format: 'csv' },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'members.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function OverviewContent() {
  const [range, setRange] = useState<Range>('30d')
  const [adding, setAdding] = useState(false)
  const { data, isLoading, error } = useOverview(range)
  // the API keys are being renamed; read both spellings so neither breaks the page
  const k = (data?.kpis ?? {}) as Record<string, number | undefined>
  const active = k.active_members ?? k.active ?? 0
  const revenue = k.revenue_30d ?? 0
  const pending = k.pending_approvals ?? 0
  const expiring = k.expiring_30d ?? 0
  return (
    <div>
      <PageHeader
        title="Membership"
        breadcrumbs={[{ label: 'Members, revenue and renewals at a glance' }]}
        action={
          <div className="flex items-center gap-3">
            <RangeTabs value={range} onChange={setRange} />
            <Button variant="outline" onClick={() => void exportMembers()}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </div>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active members"
              value={active.toLocaleString('en-IN')}
              icon={<Users className="h-4 w-4" />}
              note={delta(k.active_members_delta_pct, range)}
              tone="good"
            />
            <StatCard
              label={`Revenue (${range === '1y' ? '1 year' : range.replace('d', ' days')})`}
              value={rupees(revenue)}
              icon={<IndianRupee className="h-4 w-4" />}
              note={delta(k.revenue_30d_delta_pct, range)}
              tone="good"
            />
            <StatCard
              label="Renewals due (30 days)"
              value={expiring.toLocaleString('en-IN')}
              icon={<RefreshCw className="h-4 w-4" />}
              note={k.expiring_value ? `${rupees(k.expiring_value)} at risk` : undefined}
              tone="bad"
            />
            <StatCard
              label="Pending approval"
              value={pending.toLocaleString('en-IN')}
              icon={<CheckCircle2 className="h-4 w-4" />}
              note={
                pending > 0 && k.oldest_pending_days !== undefined
                  ? `Oldest ${k.oldest_pending_days} days`
                  : undefined
              }
              tone="bad"
            />
          </div>
          <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">New members vs churn</h2>
              <ChurnChart growth={(data.growth ?? []).slice(-10)} />
            </section>
            <section className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Members by plan</h2>
              <PlanMixBars rows={data.plan_mix ?? []} />
              {k.renewal_rate_90d !== undefined && (
                <div className="mt-4 flex justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Renewal rate (90d)</span>
                  <b>{k.renewal_rate_90d}%</b>
                </div>
              )}
            </section>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent members</h2>
            <Link href="/admin/membership/members" className="text-sm text-primary">
              View all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card">
            <RecentMembersTable rows={data.recent_members ?? []} />
          </div>
        </>
      )}
      <AddMemberModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

export default function MembershipOverviewPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <OverviewContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
