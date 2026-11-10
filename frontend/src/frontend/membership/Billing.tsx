'use client'

import Link from 'next/link'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { useInvoice, useInvoices, useLibrary, usePayments } from './api'
import { dateText, money } from './format'
import { StatusBadge } from './StatusBadge'

export function Invoices() {
  const { data, isLoading, error } = useInvoices()
  if (isLoading) return <LoadingSpinner />
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoices</h1>
      {error ? <ErrorAlert error={error} /> : null}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
      {data?.map((i) => (
        <Link
          key={i.id}
          href={`/membership/account/invoices/${i.id}`}
          className="flex justify-between rounded-md border bg-card p-3 text-sm"
        >
          <span>
            {i.number} · {dateText(i.issued_at)} · {i.description}
            {i.voided_at ? ' (void)' : ''}
          </span>
          <span>{money(i.total)}</span>
        </Link>
      ))}
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
      <h1 className="text-2xl font-bold">Payments</h1>
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
  if (isLoading) return <LoadingSpinner />
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Members-only content</h1>
      {error ? <ErrorAlert error={error} /> : null}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing unlocked for your plan yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((x) => (
          <a key={x.id} href={x.url} className="rounded-xl border bg-card p-4 hover:border-primary">
            <p className="font-medium">{x.title}</p>
            {x.description && <p className="text-sm text-muted-foreground">{x.description}</p>}
          </a>
        ))}
      </div>
    </div>
  )
}
