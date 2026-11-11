'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useInvoice, useInvoices, useLibrary, usePayments } from './api'
import { dateText, money } from './format'
import { StatusBadge } from './StatusBadge'

export function Invoices() {
  const { data, isLoading, error } = useInvoices()
  if (isLoading) return <LoadingSpinner />
  return (
    <div className="space-y-4">
      {error ? <ErrorAlert error={error} /> : null}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
      {!!data?.length && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {['Invoice', 'Date', 'For', 'Amount', 'Status', ''].map((h) => (
                  <th key={h} className="p-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3 font-medium">{i.number}</td>
                  <td className="p-3">{dateText(i.issued_at)}</td>
                  <td className="p-3">{i.description}</td>
                  <td className="p-3">{money(i.total)}</td>
                  <td className="p-3">
                    <StatusBadge
                      status={i.voided_at ? 'VOID' : i.is_credit_note ? 'CREDIT' : 'PAID'}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/membership/account/invoices/${i.id}`}
                      className="text-primary hover:underline"
                    >
                      View / PDF
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function InvoiceView({ id }: { id: string }) {
  const { data: i, isLoading, error } = useInvoice(id)
  if (isLoading) return <LoadingSpinner />
  if (error || !i) return <ErrorAlert error={error ?? new Error('Invoice not found')} />
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/membership/account/invoices" className="text-sm text-primary hover:underline">
          Back to invoices
        </Link>
        <Button onClick={() => window.print()}>Print / save PDF</Button>
      </div>
      <article className="space-y-3 rounded-xl border bg-card p-6 text-sm">
        <h1 className="text-xl font-bold">
          {i.is_credit_note ? 'Credit note' : 'Tax invoice'} {i.number}
        </h1>
        <p>Issued {dateText(i.issued_at)}</p>
        <p>
          Billed to {i.bill_to_name}
          {i.bill_to_gstin ? ` · GSTIN ${i.bill_to_gstin}` : ''}
          {i.bill_to_address ? ` · ${i.bill_to_address}` : ''}
        </p>
        <p>{i.description}</p>
        <dl className="ml-auto grid max-w-xs grid-cols-2 gap-1">
          <dt>Subtotal</dt>
          <dd className="text-right">{money(i.subtotal)}</dd>
          <dt>GST {i.gst_rate}%</dt>
          <dd className="text-right">{money(i.tax_amount)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold">{money(i.total)}</dd>
        </dl>
        {i.voided_at && (
          <p className="text-destructive">This invoice was voided on {dateText(i.voided_at)}.</p>
        )}
      </article>
    </div>
  )
}

export function Payments() {
  const { data, isLoading, error } = usePayments()
  if (isLoading) return <LoadingSpinner />
  return (
    <div className="space-y-4">
      {error ? <ErrorAlert error={error} /> : null}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
      {data?.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm"
        >
          <span>
            {p.reference} · {dateText(p.paid_at ?? p.created_at)}
            {p.provider?.label ? ` · ${p.provider.label}` : ''}
          </span>
          <span className="flex items-center gap-3">
            <StatusBadge status={p.status} />
            {money(p.amount, p.currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Library() {
  const { data, isLoading, error } = useLibrary()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  if (isLoading) return <LoadingSpinner />
  const types = [...new Set((data ?? []).map((x) => x.type).filter(Boolean))] as string[]
  const rows = (data ?? []).filter(
    (x) =>
      (!type || x.type === type) &&
      `${x.title} ${x.description ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Search resources"
          className="max-w-xs"
          placeholder="Search resources…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {types.length > 0 && (
          <select
            aria-label="Type"
            className="rounded-md border bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
      </div>
      {error ? <ErrorAlert error={error} /> : null}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {data?.length ? 'No resources match.' : 'Nothing unlocked for your plan yet.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((x) => (
          <div
            key={x.id}
            className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <div>
              <p className="font-semibold">{x.title}</p>
              <p className="text-sm text-muted-foreground">{x.description ?? x.type}</p>
            </div>
            <Button size="sm" variant="outline" asChild className="self-start">
              <a href={x.url}>Open</a>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
