'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { safeHref } from '@/frontend/lib/safe-href'
import { usePagination } from '@/admin/hooks/usePagination'
import { rupees, useAdminItem, usePayments, useProviders } from '@/admin/hooks/useMembership'
import {
  Chips,
  DetailRow,
  PayStatus,
  payLabel,
  PersonCell,
  Section,
  SidePanel,
  downloadCsv,
  fmtDate,
  fmtDateTime,
  useDebounced,
} from '../_components/BillingBits'
import {
  RefundModal,
  RejectProofModal,
  VerifyModal,
  purposeOf,
  type PaymentRow,
} from '../_components/BillingModals'
import { FilterBar, Kpi, NativeSelect, enumOptions, humanize, totalPages } from '../_components/ui'

const STATUSES = [
  'PENDING',
  'AWAITING_PROOF',
  'UNDER_VERIFICATION',
  'PAID',
  'FAILED',
  'REFUNDED',
  'REJECTED',
]
const monthOf = (d?: string | null) => (d ? d.slice(0, 7) : '')

interface Stats {
  collected: number
  gst: number
  failed: number
  recovered: number
  refunded: number
  waiting: number
}

function PaymentDrawer({
  id,
  onClose,
  onRefund,
  onVerify,
}: {
  id: string | null
  onClose: () => void
  onRefund: (p: PaymentRow) => void
  onVerify: (p: PaymentRow) => void
}) {
  const { data: p, isLoading } = useAdminItem<PaymentRow>(id ? `payments/${id}` : null)
  const invoice = p?.invoices?.[0]
  const gst = p?.tax_amount ?? 0
  const half = Math.round(gst / 2)
  return (
    <SidePanel
      open={id !== null}
      onClose={onClose}
      title={p ? `Payment · ${rupees(p.amount)}` : 'Payment'}
      sub={p ? `${p.gateway_payment_id ?? p.reference} · ${payLabelOf(p)}` : undefined}
      footer={
        p && (
          <div className="flex justify-end gap-2">
            {invoice && (
              <Button asChild variant="outline">
                <Link href={`/admin/membership/invoices/${invoice.id}`}>Download invoice</Link>
              </Button>
            )}
            {p.status === 'UNDER_VERIFICATION' && (
              <Button onClick={() => onVerify(p)}>Verify payment</Button>
            )}
            {p.status === 'PAID' && (
              <Button
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => onRefund(p)}
              >
                Refund
              </Button>
            )}
          </div>
        )
      }
    >
      {isLoading || !p ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <DetailRow label="Member">
            {p.member?.full_name}
            {p.member?.member_no ? ` · ${p.member.member_no}` : ''}
          </DetailRow>
          <DetailRow label="Purpose">{purposeOf(p) || '—'}</DetailRow>
          <DetailRow label="Method">
            {p.provider?.label ?? '—'}
            {p.upi_id ? ` · ${p.upi_id}` : ''}
          </DetailRow>
          {p.utr && <DetailRow label="UTR">{p.utr}</DetailRow>}
          {p.gateway_order_id && <DetailRow label="Order ID">{p.gateway_order_id}</DetailRow>}
          <DetailRow label="Created">{fmtDateTime(p.created_at)}</DetailRow>
          <DetailRow label="Captured">{fmtDateTime(p.paid_at)}</DetailRow>
          <Section title="Breakdown">
            {(
              p.breakdown ?? [
                { label: invoice?.id ? 'Subtotal' : 'Amount (excl. GST)', amount: p.amount - gst },
                ...(gst
                  ? [
                      { label: `CGST ${(invoice?.gst_rate ?? 18) / 2}%`, amount: half },
                      { label: `SGST ${(invoice?.gst_rate ?? 18) / 2}%`, amount: gst - half },
                    ]
                  : []),
              ]
            ).map((b) => (
              <DetailRow key={b.label} label={b.label}>
                {rupees(b.amount)}
              </DetailRow>
            ))}
            <DetailRow label="Total">{rupees(p.amount)}</DetailRow>
            <DetailRow label="Refunded">{rupees(p.refunded_amount)}</DetailRow>
          </Section>
          {p.proof_url && (
            <p className="mt-4 text-sm">
              <a
                href={safeHref(p.proof_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Open payment proof
              </a>
            </p>
          )}
          {p.note && <p className="mt-3 text-sm">Note: {p.note}</p>}
          {p.failure_reason && <p className="mt-3 text-sm text-destructive">{p.failure_reason}</p>}
          {(p.webhook_events ?? p.events ?? []).length > 0 && (
            <Section title="Webhook events">
              {(p.webhook_events ?? p.events ?? []).map((e, i) => (
                <DetailRow key={i} label={humanize(e.key.replace(/[._]/g, ' '))}>
                  {fmtDateTime(e.created_at)}
                  {'status' in e && e.status ? ` · ${e.status}` : ''}
                </DetailRow>
              ))}
            </Section>
          )}
        </>
      )}
    </SidePanel>
  )
}
const payLabelOf = (p: PaymentRow) => payLabel(p.status)

function PaymentsContent() {
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [f, setF] = useState({ q: '', status: '', provider: '', month: '' })
  const [chip, setChip] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [verify, setVerify] = useState<PaymentRow | null>(null)
  const [rejectProof, setRejectProof] = useState<PaymentRow | null>(null)
  const [refund, setRefund] = useState<PaymentRow | null>(null)
  const status = chip === 'waiting' ? 'UNDER_VERIFICATION' : chip === 'all' ? f.status : chip
  const q = useDebounced(f.q)
  const { data, isLoading, error } = usePayments({
    q,
    status: status.toUpperCase(),
    provider_id: f.provider,
    page,
    limit,
  })
  const { data: providers } = useProviders()
  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }))
    reset()
  }
  const rows = useMemo(
    () =>
      ((data?.items ?? []) as PaymentRow[]).filter(
        (p) => !f.month || monthOf(p.paid_at ?? p.created_at) === f.month
      ),
    [data, f.month]
  )
  const server = (data as { stats?: Partial<Stats> } | undefined)?.stats
  const stats = useMemo<Stats>(() => {
    const m = f.month || new Date().toISOString().slice(0, 7)
    const inMonth = ((data?.items ?? []) as PaymentRow[]).filter(
      (p) => monthOf(p.paid_at ?? p.created_at) === m
    )
    const sum = (xs: PaymentRow[], k: (p: PaymentRow) => number) => xs.reduce((s, p) => s + k(p), 0)
    return {
      collected: sum(
        inMonth.filter((p) => p.status === 'PAID'),
        (p) => p.amount
      ),
      gst: sum(
        inMonth.filter((p) => p.status === 'PAID'),
        (p) => p.tax_amount
      ),
      failed: inMonth.filter((p) => p.status === 'FAILED').length,
      recovered: 0,
      refunded: sum(inMonth, (p) => p.refunded_amount),
      waiting: (data?.items ?? []).filter((p) => p.status === 'UNDER_VERIFICATION').length,
      ...server,
    }
  }, [data, f.month, server])
  const monthLabel = new Date(
    `${f.month || new Date().toISOString().slice(0, 7)}-01`
  ).toLocaleString('en-IN', { month: 'short' })

  const columns: ColumnDef<PaymentRow>[] = [
    { header: 'Date', cell: ({ row }) => fmtDate(row.original.paid_at ?? row.original.created_at) },
    {
      header: 'Member',
      cell: ({ row: { original: p } }) => (
        <PersonCell
          name={p.member?.full_name}
          sub={p.utr && p.status === 'UNDER_VERIFICATION' ? `UTR ${p.utr}` : p.member?.email}
        />
      ),
    },
    { header: 'Purpose', cell: ({ row }) => purposeOf(row.original) || '—' },
    { header: 'Method', cell: ({ row }) => row.original.provider?.label ?? '—' },
    { header: 'Total', cell: ({ row }) => rupees(row.original.amount) },
    { header: 'Status', cell: ({ row }) => <PayStatus status={row.original.status} /> },
    {
      header: 'Invoice',
      cell: ({ row: { original: p } }) =>
        p.invoices?.[0] ? (
          <Link
            className="text-primary hover:underline"
            href={`/admin/membership/invoices/${p.invoices[0].id}`}
          >
            {p.invoices[0].number}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original: p } }) => (
        <div className="flex gap-1">
          {p.status === 'UNDER_VERIFICATION' ? (
            <Button size="sm" onClick={() => setVerify(p)}>
              Verify
            </Button>
          ) : p.status === 'PAID' ? (
            <Button size="sm" variant="outline" onClick={() => setRefund(p)}>
              Refund
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setOpen(p.id)}>
              View
            </Button>
          )}
          {p.status === 'PAID' && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(p.id)}>
              View
            </Button>
          )}
        </div>
      ),
    },
  ]
  return (
    <div>
      <PageHeader
        title="Payments"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Payments & invoices' },
        ]}
        action={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv('payments-tally.csv', [
                  ['Date', 'Member', 'Method', 'Reference', 'Total (INR)', 'GST (INR)', 'Status'],
                  ...rows.map((p) => [
                    fmtDate(p.paid_at ?? p.created_at),
                    p.member?.full_name,
                    p.provider?.label,
                    p.reference,
                    p.amount / 100,
                    p.tax_amount / 100,
                    p.status,
                  ]),
                ])
              }
            >
              <Download className="h-4 w-4" /> Export for Tally
            </Button>
            <Button asChild>
              <Link href="/admin/membership/payments/new">
                <Plus className="h-4 w-4" /> Record manual payment
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Collected (${monthLabel})`} value={rupees(stats.collected)} />
        <Kpi label={`GST payable (${monthLabel})`} value={rupees(stats.gst)} />
        <Kpi
          label={`Failed (${monthLabel})`}
          value={stats.failed}
          hint={`${stats.recovered} recovered`}
        />
        <Kpi label={`Refunded (${monthLabel})`} value={rupees(stats.refunded)} />
      </div>
      <Chips
        value={chip}
        onChange={(c) => {
          setChip(c)
          reset()
        }}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'waiting', label: 'Waiting for verification', count: stats.waiting },
          { key: 'FAILED', label: 'Failed' },
          { key: 'REFUNDED', label: 'Refunded' },
        ]}
      />
      <FilterBar>
        <Input
          aria-label="Search payments"
          className="w-80"
          placeholder="Search payment ID, invoice no. or member…"
          value={f.q}
          onChange={(e) => set('q')(e.target.value)}
        />
        <NativeSelect
          aria-label="Provider"
          className="w-44"
          placeholder="All methods"
          value={f.provider}
          onChange={(e) => set('provider')(e.target.value)}
          options={(providers?.items ?? []).map((p) => ({ value: p.id, label: p.label }))}
        />
        <NativeSelect
          aria-label="Status"
          className="w-44"
          placeholder="All statuses"
          value={f.status}
          disabled={chip !== 'all'}
          onChange={(e) => set('status')(e.target.value)}
          options={enumOptions(STATUSES)}
        />
        <Input
          aria-label="Month"
          type="month"
          className="w-40"
          value={f.month}
          onChange={(e) => set('month')(e.target.value)}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        emptyMessage="No payments yet."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
      />
      <PaymentDrawer
        id={open}
        onClose={() => setOpen(null)}
        onRefund={(p) => {
          setOpen(null)
          setRefund(p)
        }}
        onVerify={(p) => {
          setOpen(null)
          setVerify(p)
        }}
      />
      <VerifyModal
        payment={verify}
        onClose={() => setVerify(null)}
        onReject={(p) => {
          setVerify(null)
          setRejectProof(p)
        }}
      />
      <RejectProofModal payment={rejectProof} onClose={() => setRejectProof(null)} />
      <RefundModal payment={refund} onClose={() => setRefund(null)} />
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
