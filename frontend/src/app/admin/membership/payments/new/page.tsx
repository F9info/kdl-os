'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import {
  rupees,
  useAdminAction,
  useMembers,
  usePlans,
  type Member,
} from '@/admin/hooks/useMembership'
import { manualPaymentSchema, type ManualPaymentData } from '../../_billing-schemas'
import { DetailRow, ToggleRow, useDebounced } from '../../_components/BillingBits'
import { Card, NativeSelect, humanize } from '../../_components/ui'

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque / DD' },
  { value: 'UPI', label: 'UPI' },
  { value: 'OTHER', label: 'Other' },
]

function NewPaymentContent() {
  const router = useRouter()
  const action = useAdminAction()
  const { data: plans } = usePlans()
  const [search, setSearch] = useState('')
  const dq = useDebounced(search)
  const { data: found } = useMembers({ q: dq, limit: 8 })
  const [picker, setPicker] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ManualPaymentData>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: {
      member_id: '',
      purpose: 'NEW',
      price_key: '',
      method: 'CASH',
      paid_on: new Date().toISOString().slice(0, 10),
      activate: true,
      invoice: true,
      email: true,
    },
  })
  const priceOptions = (plans?.items ?? [])
    .filter((p) => !p.is_free)
    .flatMap((p) =>
      (p.prices ?? [])
        .filter((x) => x.is_active)
        .map((x) => ({
          value: `${p.id}|${x.interval}`,
          label: `${p.name} · ${humanize(x.interval)}`,
          price: x,
        }))
    )
  const picked = priceOptions.find((o) => o.value === watch('price_key'))
  const quote = (
    picked?.price as { breakdown?: { subtotal: number; tax: number; total: number } } | undefined
  )?.breakdown
  const gst = picked?.price.gst_rate ?? 0

  function onSubmit(v: ManualPaymentData) {
    const [plan_id, interval] = v.price_key.split('|')
    action.mutate(
      {
        path: `members/${v.member_id}/record-payment`,
        data: {
          plan_id,
          interval,
          method: v.method,
          utr: v.reference || undefined,
          note:
            [v.note, v.collected_by && `Collected by ${v.collected_by}`]
              .filter(Boolean)
              .join(' · ') || undefined,
          // extra fields the API will honour once extended (see needs-A3)
          paid_on: v.paid_on,
          purpose: v.purpose,
          receipt_url: v.receipt_url || undefined,
          activate: v.activate,
          issue_invoice: v.invoice,
          email_receipt: v.email,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Payment recorded' })
          router.push('/admin/membership/payments')
        },
      }
    )
  }

  return (
    <div>
      <PageHeader
        title="Record manual payment"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Payments', href: '/admin/membership/payments' },
          { label: 'New' },
        ]}
        action={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/admin/membership/payments')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
              Save payment
            </Button>
          </div>
        }
      />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
        autoComplete="off"
      >
        <Card title="Payment">
          <div className="space-y-4">
            <FormField label="Member" error={errors.member_id?.message} required>
              <div>
                {member ? (
                  <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>
                      {member.full_name} · {member.email}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMember(null)
                        setValue('member_id', '')
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Search member by name, email or number…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {dq && (
                      <ul className="mt-1 max-h-48 overflow-auto rounded-md border text-sm">
                        {(found?.items ?? []).map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-muted"
                              onClick={() => {
                                setMember(m)
                                setValue('member_id', m.id, { shouldValidate: true })
                              }}
                            >
                              {m.full_name} · {m.email}
                            </button>
                          </li>
                        ))}
                        {(found?.items ?? []).length === 0 && (
                          <li className="px-3 py-2 text-muted-foreground">No members found.</li>
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Purpose">
                <NativeSelect
                  options={[
                    { value: 'NEW', label: 'New membership' },
                    { value: 'RENEWAL', label: 'Renewal' },
                  ]}
                  {...register('purpose')}
                />
              </FormField>
              <FormField label="Plan & price" error={errors.price_key?.message} required>
                <NativeSelect
                  placeholder="Choose…"
                  options={priceOptions}
                  {...register('price_key')}
                />
              </FormField>
              <FormField label="Method">
                <NativeSelect options={METHODS} {...register('method')} />
              </FormField>
              <FormField label="Paid on" error={errors.paid_on?.message}>
                <Input type="date" {...register('paid_on')} />
              </FormField>
              <FormField label="Reference / receipt no.">
                <Input placeholder="RCPT-0912" {...register('reference')} />
              </FormField>
              <FormField label="Collected by">
                <Input placeholder="Front desk" {...register('collected_by')} />
              </FormField>
            </div>
            <FormField label="Receipt">
              <div className="flex items-center gap-3 text-sm">
                <Button type="button" variant="outline" onClick={() => setPicker(true)}>
                  Upload image / PDF
                </Button>
                {receipt && <span>{receipt} ✓ attached</span>}
              </div>
            </FormField>
            <FormField label="Note">
              <Textarea rows={2} {...register('note')} />
            </FormField>
          </div>
        </Card>
        <Card title="Summary">
          {picked ? (
            <>
              <DetailRow label={picked.label}>
                {rupees(quote?.subtotal ?? picked.price.amount)}
              </DetailRow>
              {quote && gst > 0 && (
                <>
                  <DetailRow label={`CGST ${gst / 2}%`}>
                    {rupees(Math.round(quote.tax / 2))}
                  </DetailRow>
                  <DetailRow label={`SGST ${gst / 2}%`}>
                    {rupees(quote.tax - Math.round(quote.tax / 2))}
                  </DetailRow>
                </>
              )}
              <DetailRow label="Total received">
                {rupees(quote?.total ?? picked.price.amount)}
              </DetailRow>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a plan and price to see the total.</p>
          )}
          <div className="mt-3 border-t pt-2">
            {(
              [
                ['activate', 'Activate membership on save'],
                ['invoice', 'Issue GST invoice'],
                ['email', 'Email receipt'],
              ] as const
            ).map(([k, label]) => (
              <Controller
                key={k}
                control={control}
                name={k}
                render={({ field }) => (
                  <ToggleRow label={label} checked={field.value} onChange={field.onChange} />
                )}
              />
            ))}
          </div>
          {action.error && <ErrorAlert error={action.error} />}
        </Card>
      </form>
      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(m) => {
          const f = m[0]
          if (f) {
            setReceipt(f.original_name)
            setValue('receipt_url', f.url ?? '')
          }
          setPicker(false)
        }}
      />
    </div>
  )
}

export default function NewPaymentPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:edit">
        <NewPaymentContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
