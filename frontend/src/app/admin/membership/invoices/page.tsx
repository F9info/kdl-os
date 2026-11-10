'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePagination } from '@/admin/hooks/usePagination'
import { formatDate } from '@/lib/utils'
import { rupees, useInvoices, type Invoice } from '@/admin/hooks/useMembership'
import { ActionModal, FilterBar, StatusPill, totalPages } from '../_components/ui'

function InvoiceView({
  invoice,
  onClose,
  onVoid,
}: {
  invoice: Invoice | null
  onClose: () => void
  onVoid: () => void
}) {
  return (
    <Modal
      open={invoice !== null}
      onClose={onClose}
      size="lg"
      title={invoice?.is_credit_note ? 'Credit note' : 'Tax invoice'}
      footer={
        invoice && (
          <div className="flex gap-2">
            {!invoice.is_credit_note && !invoice.voided_at && (
              <Button variant="outline" onClick={onVoid}>
                Void (issue credit note)
              </Button>
            )}
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        )
      }
    >
      {invoice && (
        <div className="space-y-4 text-sm print:text-black">
          <div className="flex justify-between">
            <div>
              <p className="text-lg font-semibold">{invoice.number}</p>
              <p className="text-muted-foreground">Issued {formatDate(invoice.issued_at)}</p>
            </div>
            {invoice.voided_at && <StatusPill status="CANCELLED" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bill to</p>
            <p className="font-medium">{invoice.bill_to_name}</p>
            {invoice.bill_to_gstin && <p>GSTIN {invoice.bill_to_gstin}</p>}
            {invoice.bill_to_address && <p>{invoice.bill_to_address}</p>}
          </div>
          <table className="w-full">
            <tbody>
              <tr className="border-b">
                <td className="py-2">{invoice.description}</td>
                <td className="text-right">{rupees(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">GST @ {invoice.gst_rate}%</td>
                <td className="text-right">{rupees(invoice.tax_amount)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1">Total</td>
                <td className="text-right">{rupees(invoice.total)}</td>
              </tr>
            </tbody>
          </table>
          {invoice.void_reason && <p>Void reason: {invoice.void_reason}</p>}
        </div>
      )}
    </Modal>
  )
}

function InvoicesContent() {
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [q, setQ] = useState('')
  const [view, setView] = useState<Invoice | null>(null)
  const [voiding, setVoiding] = useState<Invoice | null>(null)
  const { data, isLoading, error } = useInvoices({ q, page, limit })
  const columns: ColumnDef<Invoice>[] = [
    {
      header: 'Number',
      cell: ({ row }) => <span className="font-medium">{row.original.number}</span>,
    },
    { header: 'Bill to', cell: ({ row }) => row.original.bill_to_name },
    { header: 'Date', cell: ({ row }) => formatDate(row.original.issued_at) },
    { header: 'Total', cell: ({ row }) => rupees(row.original.total) },
    {
      header: 'Type',
      cell: ({ row }) =>
        row.original.is_credit_note
          ? 'Credit note'
          : row.original.voided_at
            ? 'Void'
            : 'Tax invoice',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setView(row.original)}>
          View
        </Button>
      ),
    },
  ]
  return (
    <div>
      <PageHeader
        title="Invoices"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Invoices' }]}
      />
      <FilterBar>
        <Input
          aria-label="Search invoices"
          className="w-64"
          placeholder="Search number or company…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            reset()
          }}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No invoices yet."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
      />
      <InvoiceView
        invoice={view}
        onClose={() => setView(null)}
        onVoid={() => {
          setVoiding(view)
          setView(null)
        }}
      />
      <ActionModal
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Void invoice"
        description="Invoices are never deleted. A credit note is issued instead."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]}
        destructive
        submitLabel="Issue credit note"
        request={(v) => ({ path: `invoices/${voiding?.id}/void`, data: v })}
        success="Credit note issued"
      />
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <InvoicesContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
