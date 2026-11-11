'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Download, Mail, Ban } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { safeHref } from '@/frontend/lib/safe-href'
import { rupees, useAdminItem, useSettings } from '@/admin/hooks/useMembership'
import { DetailRow, fmtDate, fmtDateTime, useDo } from '../../_components/BillingBits'
import { VoidModal } from '../../_components/BillingModals'
import { Card } from '../../_components/ui'
import { InvoiceStatus, type InvoiceRow } from '../../_components/InvoiceBits'

function InvoiceContent() {
  const { id } = useParams<{ id: string }>()
  const { data: i, isLoading, error } = useAdminItem<InvoiceRow>(`invoices/${id}`)
  const { data: settings } = useSettings()
  const [voiding, setVoiding] = useState(false)
  const act = useDo()
  const biz = (settings?.general as Record<string, unknown> | undefined) ?? {}
  const pol = (biz.policies as Record<string, string> | undefined) ?? {}
  const legal = pol.legal_name ?? (biz.legal_name as string | undefined)
  const gstin = pol.gstin ?? (biz.gstin as string | undefined)
  const half = i ? Math.round(i.tax_amount / 2) : 0
  return (
    <div>
      <PageHeader
        title={i?.number ?? 'Invoice'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Invoices', href: '/admin/membership/invoices' },
          { label: i?.is_credit_note ? 'Credit note' : 'Tax invoice' },
        ]}
        action={
          i && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={act.pending}
                onClick={() =>
                  act.run({ path: `invoices/${i.id}/resend` }, 'Invoice sent to the member')
                }
              >
                <Mail className="h-4 w-4" /> Resend to member
              </Button>
              {i.pdf_url ? (
                <Button asChild variant="outline">
                  <a href={safeHref(i.pdf_url)} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" /> Download PDF
                  </a>
                </Button>
              ) : (
                <Button variant="outline" onClick={() => window.print()}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              )}
              {!i.is_credit_note && !i.voided_at && (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive"
                  onClick={() => setVoiding(true)}
                >
                  <Ban className="h-4 w-4" /> Void / credit note
                </Button>
              )}
            </div>
          )
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {act.error ? <ErrorAlert error={act.error} /> : null}
      {isLoading || !i ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border bg-card p-8 print:border-0">
            <div className="flex justify-between border-b pb-5">
              <div>
                <p className="text-lg font-semibold">{legal ?? 'Your organisation'}</p>
                {gstin && <p className="text-xs text-muted-foreground">GSTIN: {gstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tracking-wide">
                  {i.is_credit_note ? 'CREDIT NOTE' : 'TAX INVOICE'}
                </p>
                <p className="text-xs text-muted-foreground">No. {i.number}</p>
                <p className="text-xs text-muted-foreground">
                  Date {fmtDate(i.issued_at)}
                  {i.place_of_supply ? ` · Place of supply ${i.place_of_supply}` : ''}
                </p>
              </div>
            </div>
            <div className="border-b py-5 text-sm">
              <p className="text-xs uppercase text-muted-foreground">Billed to</p>
              <p className="font-medium">
                {i.bill_to_name}
                {i.member?.member_no ? ` · ${i.member.member_no}` : ''}
              </p>
              {i.bill_to_address && <p className="text-muted-foreground">{i.bill_to_address}</p>}
              {i.bill_to_gstin && <p className="text-muted-foreground">GSTIN {i.bill_to_gstin}</p>}
            </div>
            <table className="my-5 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Description</th>
                  <th>SAC</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">{i.description}</td>
                  <td>{i.sac ?? '999599'}</td>
                  <td className="text-right">{rupees(i.subtotal)}</td>
                </tr>
              </tbody>
            </table>
            <div className="ml-auto w-64 text-sm">
              <DetailRow label={`CGST @ ${i.gst_rate / 2}%`}>{rupees(half)}</DetailRow>
              <DetailRow label={`SGST @ ${i.gst_rate / 2}%`}>
                {rupees(i.tax_amount - half)}
              </DetailRow>
              <DetailRow label="Total">{rupees(i.total)}</DetailRow>
            </div>
          </div>
          <Card title="Details">
            <DetailRow label="Status">
              <InvoiceStatus i={i} />
            </DetailRow>
            <DetailRow label="Payment">
              {i.payment
                ? `${i.payment.gateway_payment_id ?? i.payment.reference}${i.payment.provider ? ` · ${i.payment.provider.label}` : ''}`
                : '—'}
            </DetailRow>
            <DetailRow label="Emailed">
              {i.emailed_at ? `${fmtDateTime(i.emailed_at)} ✓` : '—'}
            </DetailRow>
            <DetailRow label="Downloaded by member">
              {i.downloads != null ? `${i.downloads} times` : '—'}
            </DetailRow>
            <DetailRow label="PDF">
              {i.pdf_url ? 'Stored in Media' : 'Generated on download'}
            </DetailRow>
            {i.voided_at && (
              <DetailRow label="Voided">
                {fmtDate(i.voided_at)}
                {i.void_reason ? ` · ${i.void_reason}` : ''}
              </DetailRow>
            )}
          </Card>
        </div>
      )}
      <VoidModal invoice={voiding ? (i ?? null) : null} onClose={() => setVoiding(false)} />
    </div>
  )
}

export default function InvoicePage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <InvoiceContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
