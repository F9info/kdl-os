'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import {
  rupees,
  useAdminItem,
  useAdminList,
  type Member,
  type Payment,
  type Plan,
} from '@/admin/hooks/useMembership'
import { ActionModal, StatusPill, humanize } from '../_components/ui'

interface Application {
  id: string // subscription id
  created_at: string
  member: Member
  plan?: Pick<Plan, 'name'>
  payment?: Pick<Payment, 'reference' | 'status' | 'amount'> | null
  answers?: Record<string, unknown>
}

function ApprovalDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useAdminItem<Application>(id ? `approvals/${id}` : null)
  const [step, setStep] = useState<'approve' | 'reject' | null>(null)
  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      size="lg"
      title="Application"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep('reject')}>
            Reject
          </Button>
          <Button onClick={() => setStep('approve')}>Approve</Button>
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-base font-medium">
              {data.member.legal_name || data.member.full_name}
            </p>
            <p className="text-muted-foreground">
              {humanize(data.member.member_type)} · {data.member.email} ·{' '}
              {data.member.mobile ?? '—'}
            </p>
          </div>
          <p>
            Plan: <strong>{data.plan?.name}</strong> · applied {formatDate(data.created_at)}
          </p>
          {data.payment && (
            <p>
              Payment {data.payment.reference}: {rupees(data.payment.amount)}{' '}
              <StatusPill status={data.payment.status} />
            </p>
          )}
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(data.answers ?? data.member.fields ?? {}).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{humanize(k).replace(/_/g, ' ')}</dt>
                <dd>{String(v ?? '—')}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <ActionModal
        open={step === 'approve'}
        onClose={() => setStep(null)}
        title="Approve application"
        description="Issues a member number and activates the membership."
        fields={[]}
        submitLabel="Approve"
        request={() => ({ path: `approvals/${id}/approve` })}
        success="Member approved"
      />
      <ActionModal
        open={step === 'reject'}
        onClose={() => setStep(null)}
        title="Reject application"
        fields={[
          { name: 'reason', label: 'Reason', type: 'textarea', required: true },
          { name: 'message', label: 'Message to the applicant', type: 'textarea' },
          {
            name: 'refund',
            label: 'Refund the payment automatically',
            type: 'checkbox',
            defaultValue: true,
          },
        ]}
        destructive
        submitLabel="Reject"
        request={(v) => ({ path: `approvals/${id}/reject`, data: v })}
        success="Application rejected"
      />
    </Modal>
  )
}

function ApprovalsContent() {
  const { data, isLoading, error } = useAdminList<Application>('approvals')
  const [open, setOpen] = useState<string | null>(null)
  const columns: ColumnDef<Application>[] = [
    {
      header: 'Applicant',
      cell: ({ row: { original: a } }) => (
        <div>
          <p className="font-medium">{a.member.legal_name || a.member.full_name}</p>
          <p className="text-xs text-muted-foreground">{a.member.email}</p>
        </div>
      ),
    },
    { header: 'Type', cell: ({ row }) => humanize(row.original.member.member_type) },
    { header: 'Plan', cell: ({ row }) => row.original.plan?.name ?? '—' },
    { header: 'Applied', cell: ({ row }) => formatDate(row.original.created_at) },
    {
      header: 'Payment',
      cell: ({ row }) =>
        row.original.payment ? <StatusPill status={row.original.payment.status} /> : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setOpen(row.original.id)}>
          Review
        </Button>
      ),
    },
  ]
  return (
    <div>
      <PageHeader
        title="Approvals"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Approvals' }]}
      />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No applications waiting for review."
      />
      <ApprovalDetail id={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export default function ApprovalsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <ApprovalsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
