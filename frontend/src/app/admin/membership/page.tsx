'use client'

import Link from 'next/link'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Skeleton } from '@/components/ui/skeleton'
import { rupees, useOverview } from '@/admin/hooks/useMembership'
import { formatDate } from '@/lib/utils'
import { Card, Kpi, StatusPill } from './_components/ui'

// KPI keys come from the API; labels + money flag live here once.
const KPI_LABELS: Array<{ key: string; label: string; money?: boolean }> = [
  { key: 'active', label: 'Active members' },
  { key: 'new_30d', label: 'New (30 days)' },
  { key: 'revenue_30d', label: 'Revenue (30 days)', money: true },
  { key: 'pending_approvals', label: 'Pending approvals' },
  { key: 'expiring_30d', label: 'Expiring in 30 days' },
]

function Bars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate">{r.label}</span>
          <div className="h-3 flex-1 rounded bg-muted">
            <div
              className="h-3 rounded bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}

function OverviewContent() {
  const { data, isLoading, error } = useOverview()
  return (
    <div>
      <PageHeader title="Membership overview" breadcrumbs={[{ label: 'Membership' }]} />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {KPI_LABELS.map((k) => (
              <Kpi
                key={k.key}
                label={k.label}
                value={k.money ? rupees(data.kpis?.[k.key]) : (data.kpis?.[k.key] ?? 0)}
              />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Member growth">
              <Bars rows={(data.growth ?? []).map((g) => ({ label: g.month, value: g.count }))} />
            </Card>
            <Card title="Plan mix">
              <Bars
                rows={(data.plan_mix ?? []).map((g) => ({
                  label: g.plan?.name ?? '-',
                  value: g.count,
                }))}
              />
            </Card>
          </div>
          <Card
            title="Recent members"
            action={
              <Link href="/admin/membership/members" className="text-sm text-primary">
                View all
              </Link>
            }
          >
            {(data.recent_members ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="divide-y">
                {data.recent_members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/admin/membership/members/${m.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.full_name}
                    </Link>
                    <span className="text-muted-foreground">
                      {m.plan?.name ?? m.subscription?.plan?.name ?? '—'}
                      {m.member_since ? ` · ${formatDate(m.member_since)}` : ''}
                    </span>
                    {(m.status ?? m.subscription?.status) && (
                      <StatusPill status={(m.status ?? m.subscription?.status) as string} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
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
