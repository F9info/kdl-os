'use client'

import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import type { Invoice } from '@/admin/hooks/useMembership'

export type InvoiceRow = Invoice & {
  member?: { id: string; full_name: string; email: string; member_no?: string | null }
  payment?: {
    reference: string
    gateway_payment_id?: string | null
    provider?: { label: string } | null
  } | null
  fy?: string
  sac?: string | null
  place_of_supply?: string | null
  emailed_at?: string | null
  downloads?: number
  pdf_url?: string | null
  period_label?: string | null
}

export const signed = (i: Invoice, v: number) => (i.is_credit_note ? -v : v)
export function InvoiceStatus({ i }: { i: Invoice }) {
  return i.is_credit_note ? (
    <StatusBadge variant="user" label="Credit note" />
  ) : i.voided_at ? (
    <StatusBadge variant="suspended" label="Void" />
  ) : (
    <StatusBadge variant="active" label="Issued" />
  )
}
