'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Archive } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, usePlans, type Plan } from '@/admin/hooks/useMembership'
import { PlanForm } from '../_components/PlanForm'
import { StatusPill, humanize, priceSummary } from '../_components/ui'

function PlansContent() {
  const router = useRouter()
  const { data, isLoading, error } = usePlans()
  const action = useAdminAction()
  const [creating, setCreating] = useState(false)
  const [archiveId, setArchiveId] = useState<string | null>(null)

  const columns: ColumnDef<Plan>[] = [
    {
      header: 'Plan',
      cell: ({ row: { original: p } }) => (
        <div>
          <Link href={`/admin/membership/plans/${p.id}`} className="font-medium hover:underline">
            {p.name}
          </Link>
          {p.is_featured && <span className="ml-2 text-xs text-primary">Most popular</span>}
          {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
        </div>
      ),
    },
    { header: 'Pricing (+GST)', cell: ({ row }) => priceSummary(row.original) },
    { header: 'Approval', cell: ({ row }) => humanize(row.original.approval_mode) },
    { header: 'Visibility', cell: ({ row }) => humanize(row.original.visibility) },
    {
      header: 'Members',
      cell: ({ row }) => row.original.member_count ?? row.original._count?.subscriptions ?? 0,
    },
    {
      header: 'Status',
      cell: ({ row }) => (
        <StatusPill status={row.original.visibility === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row: { original: p } }) => (
        <div className="flex gap-1">
          <Button asChild variant="ghost" size="icon" aria-label={`Edit ${p.name}`}>
            <Link href={`/admin/membership/plans/${p.id}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          {p.visibility !== 'ARCHIVED' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Archive ${p.name}`}
              onClick={() => setArchiveId(p.id)}
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Plans"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Plans' }]}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New plan
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No plans yet. Create your first plan."
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="New plan" size="lg">
        <PlanForm onSaved={(p) => router.push(`/admin/membership/plans/${p.id}`)} />
      </Modal>
      <ConfirmDialog
        open={archiveId !== null}
        onClose={() => setArchiveId(null)}
        title="Archive plan?"
        description="The plan is hidden from the pricing page. Current members are not affected."
        confirmLabel="Archive"
        isLoading={action.isPending}
        onConfirm={() =>
          archiveId &&
          action.mutate(
            { path: `plans/${archiveId}/archive` },
            {
              onSuccess: () => {
                toast({ title: 'Plan archived' })
                setArchiveId(null)
              },
            }
          )
        }
      />
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
