'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { usePagination } from '@/admin/hooks/usePagination'
import { formatDate } from '@/lib/utils'
import {
  rupees,
  toPaise,
  useAdminItem,
  usePayments,
  useProviders,
  type Payment,
} from '@/admin/hooks/useMembership'
import {
  ActionModal,
  FilterBar,
  NativeSelect,
  StatusPill,
  enumOptions,
  humanize,
  totalPages,
} from '../_components/ui'

const STATUSES = [
  'PENDING',
  'AWAITING_PROOF',
  'UNDER_VERIFICATION',
  'PAID',
  'FAILED',
  'REFUNDED',
  'REJECTED',
]

function PaymentDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: p, isLoading } = useAdminItem<Payment>(id ? `payments/${id}` : null)
  const [step, setStep] = useState<'verify' | 'reject' | 'refund' | null>(null)
  const base = `payments/${id}`
  const rows: Array<[string, React.ReactNode]> = p
    ? [
        ['Reference', p.reference],
        [
          'Member',
          p.member ? `${p.member.full_name} (${p.member.member_no ?? 'no number yet'})` : '—',
        ],
        ['Provider', p.provider?.label ?? '—'],
        ['Status', <StatusPill key="s" status={p.status} />],
        ['Amount (incl. GST)', rupees(p.amount)],
        ['GST', rupees(p.tax_amount)],
        ['UTR', p.utr ?? '—'],
        ['Refunded', rupees(p.refunded_amount)],
        ['Paid on', p.paid_at ? formatDate(p.paid_at) : '—'],
      ]
    : []
  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      size="lg"
      title="Payment"
      footer={
        p && (
          <div className="flex gap-2">
            {p.status === 'UNDER_VERIFICATION' && (
              <>
                <Button variant="outline" onClick={() => setStep('reject')}>
                  Reject proof
                </Button>
                <Button onClick={() => setStep('verify')}>Verify payment</Button>
              </>
            )}
            {p.status === 'PAID' && (
              <Button variant="outline" onClick={() => setStep('refund')}>
                Refund
              </Button>
            )}
          </div>
        )
      }
    >
      {isLoading || !p ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {p.proof_url && (
            <a
              href={p.proof_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              Open payment proof
            </a>
          )}
          {p.note && <p className="text-sm">Note: {p.note}</p>}
          {p.failure_reason && <p className="text-sm text-destructive">{p.failure_reason}</p>}
          {(p.events ?? []).length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {p.events!.map((e, i) => (
                <li key={i}>
                  {humanize(e.key.replace(/[._]/g, ' '))} ·{' '}
                  {formatDate(e.created_at, 'MMM d, yyyy HH:mm')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ActionModal
        open={step === 'verify'}
        onClose={() => setStep(null)}
        title="Verify payment"
        description="Confirm the money reached the account. This issues the GST invoice."
        fields={[]}
        submitLabel="Verify"
        request={() => ({ path: `${base}/verify` })}
        success="Payment verified"
      />
      <ActionModal
        open={step === 'reject'}
        onClose={() => setStep(null)}
        title="Reject payment proof"
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]}
        destructive
        submitLabel="Reject"
        request={(v) => ({ path: `${base}/reject`, data: v })}
        success="Payment rejected"
      />
      <ActionModal
        open={step === 'refund'}
        onClose={() => setStep(null)}
        title="Refund payment"
        description="Leave the amount empty to refund in full. A credit note is issued."
        fields={[{ name: 'amount', label: 'Amount (INR)', type: 'number' }]}
        destructive
        submitLabel="Refund"
        request={(v) => ({
          path: `${base}/refund`,
          data: v.amount ? { amount: toPaise(Number(v.amount)) } : {},
        })}
        success="Refund issued"
      />
    </Modal>
  )
}

function PaymentsContent() {
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [f, setF] = useState({ q: '', status: '', provider: '' })
  const [open, setOpen] = useState<string | null>(null)
  const { data, isLoading, error } = usePayments({ ...f, page, limit })
  const { data: providers } = useProviders()
  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }))
    reset()
  }
  const columns: ColumnDef<Payment>[] = [
    {
      header: 'Reference',
      cell: ({ row }) => <span className="font-medium">{row.original.reference}</span>,
    },
    { header: 'Member', cell: ({ row }) => row.original.member?.full_name ?? '—' },
    { header: 'Provider', cell: ({ row }) => row.original.provider?.label ?? '—' },
    {
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.paid_at ?? row.original.created_at),
    },
    { header: 'Amount', cell: ({ row }) => rupees(row.original.amount) },
    { header: 'Status', cell: ({ row }) => <StatusPill status={row.original.status} /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setOpen(row.original.id)}>
          {row.original.status === 'UNDER_VERIFICATION' ? 'Verify' : 'View'}
        </Button>
      ),
    },
  ]
  return (
    <div>
      <PageHeader
        title="Payments"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Payments' }]}
      />
      <FilterBar>
        <Input
          aria-label="Search payments"
          className="w-64"
          placeholder="Search reference, member or UTR…"
          value={f.q}
          onChange={(e) => set('q')(e.target.value)}
        />
        <NativeSelect
          aria-label="Status"
          className="w-48"
          placeholder="All statuses"
          value={f.status}
          onChange={(e) => set('status')(e.target.value)}
          options={enumOptions(STATUSES)}
        />
        <NativeSelect
          aria-label="Provider"
          className="w-48"
          placeholder="All providers"
          value={f.provider}
          onChange={(e) => set('provider')(e.target.value)}
          options={(providers?.items ?? []).map((p) => ({ value: p.id, label: p.label }))}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No payments yet."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
      />
      <PaymentDetail id={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <PaymentsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
