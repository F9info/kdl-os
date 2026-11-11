'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePagination } from '@/admin/hooks/usePagination'
import { rupees, useInvoices, type Invoice } from '@/admin/hooks/useMembership'
import { PersonCell, downloadCsv, fmtDate, useDebounced } from '../_components/BillingBits'
import { InvoiceStatus, signed, type InvoiceRow } from '../_components/InvoiceBits'
import { FilterBar, Kpi, NativeSelect, totalPages } from '../_components/ui'

const monthOf = (d?: string | null) => (d ? d.slice(0, 7) : '')
const money = (i: Invoice, v: number) => `${i.is_credit_note ? '− ' : ''}${rupees(v)}`

function InvoicesContent() {
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [month, setMonth] = useState('')
  const dq = useDebounced(q)
  const { data, isLoading, error } = useInvoices({ q: dq, kind, page, limit })
  const rows = useMemo(
    () =>
      ((data?.items ?? []) as InvoiceRow[]).filter((i) => !month || monthOf(i.issued_at) === month),
    [data, month]
  )
  const m = month || new Date().toISOString().slice(0, 7)
  const label = new Date(`${m}-01`).toLocaleString('en-IN', { month: 'short' })
  const server = (data as { stats?: Record<string, number> } | undefined)?.stats
  const inM = ((data?.items ?? []) as InvoiceRow[]).filter((i) => monthOf(i.issued_at) === m)
  const live = inM.filter((i) => !i.is_credit_note && !i.voided_at)
  const stats = {
    count: server?.invoices ?? live.length,
    taxable: server?.taxable ?? live.reduce((s, i) => s + i.subtotal, 0),
    gst: server?.gst ?? live.reduce((s, i) => s + i.tax_amount, 0),
    credit: server?.credit_notes ?? inM.filter((i) => i.is_credit_note).length,
  }
  const fy = (data?.items as InvoiceRow[] | undefined)?.[0]?.fy

  const exportRows = (name: string, gstr: boolean) =>
    downloadCsv(name, [
      gstr
        ? [
            'Invoice no.',
            'Date',
            'Billed to',
            'GSTIN',
            'Taxable value',
            'Rate %',
            'CGST',
            'SGST',
            'Total',
            'Type',
          ]
        : ['Invoice no.', 'Date', 'Billed to', 'Taxable', 'GST', 'Total', 'Status'],
      ...rows.map((i) =>
        gstr
          ? [
              i.number,
              fmtDate(i.issued_at),
              i.bill_to_name,
              i.bill_to_gstin,
              signed(i, i.subtotal) / 100,
              i.gst_rate,
              signed(i, Math.round(i.tax_amount / 2)) / 100,
              signed(i, i.tax_amount - Math.round(i.tax_amount / 2)) / 100,
              signed(i, i.total) / 100,
              i.is_credit_note ? 'Credit note' : 'Invoice',
            ]
          : [
              i.number,
              fmtDate(i.issued_at),
              i.bill_to_name,
              signed(i, i.subtotal) / 100,
              signed(i, i.tax_amount) / 100,
              signed(i, i.total) / 100,
              i.is_credit_note ? 'Credit note' : i.voided_at ? 'Void' : 'Issued',
            ]
      ),
    ])

  const columns: ColumnDef<InvoiceRow>[] = [
    {
      header: 'Invoice no.',
      cell: ({ row: { original: i } }) => (
        <Link
          className="font-medium text-primary hover:underline"
          href={`/admin/membership/invoices/${i.id}`}
        >
          {i.number}
        </Link>
      ),
    },
    { header: 'Date', cell: ({ row }) => fmtDate(row.original.issued_at) },
    {
      header: 'Billed to',
      cell: ({ row: { original: i } }) => (
        <PersonCell name={i.bill_to_name} sub={i.member?.email} />
      ),
    },
    { header: 'Taxable', cell: ({ row: { original: i } }) => money(i, i.subtotal) },
    { header: 'GST', cell: ({ row: { original: i } }) => money(i, i.tax_amount) },
    { header: 'Status', cell: ({ row }) => <InvoiceStatus i={row.original} /> },
  ]
  return (
    <div>
      <PageHeader
        title="Invoices"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: `Invoices${fy ? ` · FY ${fy}` : ''}` },
        ]}
        action={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => exportRows('gstr1.csv', true)}>
              <Download className="h-4 w-4" /> GST report (GSTR-1)
            </Button>
            <Button variant="outline" onClick={() => exportRows('invoices.csv', false)}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Invoices (${label})`} value={stats.count} />
        <Kpi label={`Taxable value (${label})`} value={rupees(stats.taxable)} />
        <Kpi label={`GST collected (${label})`} value={rupees(stats.gst)} />
        <Kpi label={`Credit notes (${label})`} value={stats.credit} />
      </div>
      <FilterBar>
        <Input
          aria-label="Search invoices"
          className="w-72"
          placeholder="Search invoice no. or member…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            reset()
          }}
        />
        <NativeSelect
          aria-label="Type"
          className="w-40"
          placeholder="All types"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value)
            reset()
          }}
          options={[
            { value: 'invoice', label: 'Invoices' },
            { value: 'credit_note', label: 'Credit notes' },
          ]}
        />
        <Input
          aria-label="Month"
          type="month"
          className="w-40"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        emptyMessage="No invoices yet. One is issued for every paid membership."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
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
