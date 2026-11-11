'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Plus, User, X } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import api from '@/lib/axios'
import {
  rupees,
  toPaise,
  useAdminAction,
  useFieldGroups,
  usePlans,
  type FieldDef,
  type Member,
  type MemberType,
} from '@/admin/hooks/useMembership'
import { Card, NativeSelect, enumOptions } from './ui'
import { MemberAvatar, MemberPageHeader, Seg, ToggleRow } from './MemberUi'
import { addMonths, cap, dmy, isoDay } from './MemberFormat'

const MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
}
const STATES = [
  'Andhra Pradesh',
  'Telangana',
  'Karnataka',
  'Tamil Nadu',
  'Kerala',
  'Maharashtra',
  'Gujarat',
  'Delhi',
  'Odisha',
  'West Bengal',
]
const mobile = z
  .string()
  .regex(/^(\+?91)?[\s-]?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
const ACCESS = [
  { value: 'FULL', label: 'Full access' },
  { value: 'CONTENT', label: 'Events & content' },
  { value: 'BILLING', label: 'Billing only' },
]

const core = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
  mobile,
  email: z.string().trim().email('Valid email required'),
  dob: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .regex(/^([1-9]\d{5})?$/, 'Pincode must be 6 digits')
    .optional(),
  tags: z.string().optional(),
  legal_name: z.string().optional(),
  gstin: z
    .string()
    .regex(/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])?$/, 'Enter a valid 15-character GSTIN')
    .optional(),
  pan: z
    .string()
    .regex(/^([A-Z]{5}\d{4}[A-Z])?$/, 'Enter a valid PAN')
    .optional(),
  designation: z.string().optional(),
  plan_id: z.string().min(1, 'Choose a plan'),
  interval: z.string().optional(),
  starts_at: z.string().min(1, 'Start date is required'),
  method: z.string().optional(),
  reference: z.string().optional(),
  amount: z.string().optional(),
})

interface ContactDraft {
  name: string
  contact: string
  access: string
}

/** Offline / walk-in member (mockups adm-member-new + adm-member-new-org): one page, Individual or Organisation. */
export function MemberCreateForm() {
  const router = useRouter()
  const action = useAdminAction()
  const { data: plans } = usePlans()
  const { data: groups } = useFieldGroups()
  const [type, setType] = useState<MemberType>('INDIVIDUAL')
  const [payment, setPayment] = useState<'offline' | 'link' | 'complimentary'>('offline')
  const [login, setLogin] = useState(true)
  const [invoice, setInvoice] = useState(true)
  const [contacts, setContacts] = useState<Array<ContactDraft>>([])
  const [draft, setDraft] = useState<ContactDraft>({ name: '', contact: '', access: 'FULL' })
  const [lookup, setLookup] = useState('')
  const org = type === 'ORGANISATION'

  const planList = (plans?.items ?? []).filter((p) => p.member_types.includes(type))
  const [planId, setPlanId] = useState('')
  const plan = planList.find((p) => p.id === planId)
  const prices = (plan?.prices ?? []).filter((p) => p.is_active)
  const [interval, setInterval] = useState('')
  const price = prices.find((p) => p.interval === interval) ?? prices[0]

  const packFields: FieldDef[] = useMemo(() => {
    const ids = new Set(
      (plan?.field_groups ?? []).filter((g) => g.member_type === type).map((g) => g.group_id)
    )
    return (groups?.items ?? [])
      .filter((g) => ids.has(g.id) && g.is_active)
      .flatMap((g) => g.fields ?? [])
      .filter((f) => f.visibility !== 'HIDDEN')
      .sort((a, b) => a.sort - b.sort)
  }, [plan, groups, type])

  const schema = useMemo(() => {
    const fields = z.object(
      Object.fromEntries(
        packFields.map((f) => [
          f.key,
          f.required ? z.string().min(1, `${f.label} is required`) : z.string().optional(),
        ])
      )
    )
    return core.extend({ fields }).superRefine((v, ctx) => {
      if (org && !v.legal_name)
        ctx.addIssue({ code: 'custom', path: ['legal_name'], message: 'Company name is required' })
      if (org && !v.designation)
        ctx.addIssue({ code: 'custom', path: ['designation'], message: 'Designation is required' })
    })
  }, [packFields, org])

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof core> & { fields: Record<string, string> }>({
    resolver: zodResolver(schema),
    defaultValues: { starts_at: isoDay(new Date()), fields: {} },
  })
  const start = watch('starts_at')
  const months = MONTHS[price?.interval ?? ''] ?? 0
  const end =
    start && months
      ? isoDay(new Date(addMonths(new Date(start), months).getTime() - 86_400_000))
      : ''
  const total = price
    ? price.tax_mode === 'EXCLUSIVE'
      ? Math.round(price.amount * (1 + price.gst_rate / 100))
      : price.amount
    : 0
  const fe = (errors.fields ?? {}) as Record<string, { message?: string }>

  async function fetchGstin() {
    const g = getValues('gstin')
    try {
      const r = await api.get('/membership/admin/gstin/lookup', { params: { gstin: g } })
      const d = r.data.data as { legal_name?: string; status?: string; state?: string }
      if (d.legal_name) setValue('legal_name', d.legal_name)
      setLookup(
        `Found: ${d.legal_name ?? ''}${d.status ? ` · ${d.status}` : ''}${d.state ? ` · ${d.state}` : ''}`
      )
    } catch {
      setLookup('GSTIN lookup is not available - enter the details by hand.')
    }
  }

  function addContact() {
    if (!draft.name.trim() || !draft.contact.trim()) return
    if (contacts.length + 1 >= 5) return
    setContacts((c) => [...c, draft])
    setDraft({ name: '', contact: '', access: 'FULL' })
  }

  function onSubmit(v: z.infer<typeof core> & { fields: Record<string, string> }) {
    const body = {
      member_type: type,
      full_name: v.full_name,
      email: v.email,
      mobile: v.mobile,
      dob: v.dob || undefined,
      address: v.address || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
      pincode: v.pincode || undefined,
      tags: v.tags
        ? v.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      legal_name: org ? v.legal_name : undefined,
      gstin: v.gstin || undefined,
      pan: v.pan || undefined,
      plan_id: v.plan_id,
      interval: price?.interval,
      starts_at: v.starts_at,
      complimentary: payment === 'complimentary',
      fields: Object.fromEntries(Object.entries(v.fields ?? {}).filter(([, x]) => x !== '')),
      contacts: org
        ? [
            {
              name: v.full_name,
              email: v.email,
              mobile: v.mobile,
              designation: v.designation,
              access: 'FULL',
              is_primary: true,
            },
            ...contacts.map((c) => ({
              name: c.name,
              [c.contact.includes('@') ? 'email' : 'mobile']: c.contact,
              access: c.access,
            })),
          ]
        : undefined,
      payment:
        payment === 'offline'
          ? {
              mode: 'OFFLINE',
              method: v.method || 'CASH',
              reference: v.reference || undefined,
              amount: v.amount ? toPaise(Number(v.amount)) : total,
            }
          : { mode: payment === 'link' ? 'PAY_LINK' : 'COMPLIMENTARY' },
      send_welcome: login,
      issue_invoice: invoice && payment !== 'complimentary',
    }
    action.mutate(
      { path: 'members', data: body },
      {
        onSuccess: (m) => {
          toast({ title: 'Member added' })
          router.push(`/admin/membership/members/${(m as Member).id}`)
        },
      }
    )
  }

  const typeCard = (t: MemberType, title: string, hint: string, icon: typeof User) => {
    const Icon = icon
    return (
      <button
        key={t}
        type="button"
        role="radio"
        aria-checked={type === t}
        onClick={() => {
          setType(t)
          setPlanId('')
          setValue('plan_id', '')
        }}
        className={`flex flex-1 items-center gap-3 rounded-lg border p-3 text-left ${type === t ? 'border-primary bg-primary/5' : ''}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <b className="block text-sm">{title}</b>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <span>{type === t ? '●' : '○'}</span>
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <MemberPageHeader
        title="Add member"
        subtitle="Membership › Members › Add — offline, walk-in or complimentary members"
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/membership/members')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              Add member
            </Button>
          </div>
        }
      />
      <div role="radiogroup" aria-label="Member type" className="mb-6 flex gap-3">
        {typeCard(
          'INDIVIDUAL',
          'Individual',
          'One person, one login · Professional details pack',
          User
        )}
        {typeCard(
          'ORGANISATION',
          'Organisation',
          'Company or institution · Business details, documents, up to 5 contacts',
          Building2
        )}
      </div>
      {action.error ? <ErrorAlert error={action.error} /> : null}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          {org ? (
            <Card title="1 · Organisation">
              <FormField label="GSTIN" error={errors.gstin?.message}>
                <div className="flex gap-2">
                  <Input {...register('gstin')} />
                  <Button type="button" variant="outline" onClick={fetchGstin}>
                    Fetch details
                  </Button>
                </div>
              </FormField>
              {lookup && <p className="mb-3 text-sm">{lookup}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Company / organisation name"
                  error={errors.legal_name?.message}
                  required
                >
                  <Input {...register('legal_name')} />
                </FormField>
                <FormField label="PAN" error={errors.pan?.message}>
                  <Input {...register('pan')} />
                </FormField>
              </div>
            </Card>
          ) : null}
          <Card title={org ? '2 · Primary contact' : '1 · Person'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" error={errors.full_name?.message} required>
                <Input {...register('full_name')} />
              </FormField>
              {org && (
                <FormField label="Designation" error={errors.designation?.message} required>
                  <Input {...register('designation')} />
                </FormField>
              )}
              <FormField label="Mobile (login)" error={errors.mobile?.message} required>
                <Input {...register('mobile')} />
              </FormField>
              <FormField label="Email" error={errors.email?.message} required>
                <Input type="email" {...register('email')} />
              </FormField>
              {!org && (
                <>
                  <FormField label="Date of birth">
                    <Input type="date" {...register('dob')} />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Address">
                      <Input {...register('address')} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                    <FormField label="City">
                      <Input {...register('city')} />
                    </FormField>
                    <FormField label="State">
                      <NativeSelect
                        placeholder="—"
                        options={STATES.map((s) => ({ value: s, label: s }))}
                        {...register('state')}
                      />
                    </FormField>
                    <FormField label="Pincode" error={errors.pincode?.message}>
                      <Input {...register('pincode')} />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField label="Tags">
                      <Input placeholder="walk-in, 2026-batch" {...register('tags')} />
                    </FormField>
                  </div>
                </>
              )}
            </div>
          </Card>
          {packFields.length > 0 && (
            <Card title={org ? '3 · Business details' : '2 · Professional details'}>
              <p className="mb-3 text-xs text-muted-foreground">
                Field pack asked by the selected plan
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {packFields.map((f) => (
                  <FormField
                    key={f.id}
                    label={f.label}
                    error={fe[f.key]?.message}
                    required={f.required}
                  >
                    {f.type === 'SELECT' ? (
                      <NativeSelect
                        placeholder="—"
                        options={f.options.map((o) => ({ value: o, label: o }))}
                        {...register(`fields.${f.key}`)}
                      />
                    ) : (
                      <Input
                        type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'}
                        {...register(`fields.${f.key}`)}
                      />
                    )}
                  </FormField>
                ))}
              </div>
            </Card>
          )}
          {org && (
            <Card title="Contacts">
              <p className="mb-3 text-xs text-muted-foreground">
                Up to 5 people under one membership · each gets a login
              </p>
              <ul className="mb-3 divide-y text-sm">
                {contacts.map((c, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2">
                      <MemberAvatar name={c.name} size={28} />
                      <span>
                        <b className="block font-medium">{c.name}</b>
                        <span className="text-xs text-muted-foreground">{c.contact}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      {ACCESS.find((a) => a.value === c.access)?.label}
                      <button
                        type="button"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => setContacts((x) => x.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Contact name"
                  className="w-40"
                  placeholder="Name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <Input
                  aria-label="Contact mobile or email"
                  className="w-52"
                  placeholder="Mobile or email"
                  value={draft.contact}
                  onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                />
                <NativeSelect
                  aria-label="Contact access"
                  className="w-40"
                  value={draft.access}
                  onChange={(e) => setDraft({ ...draft, access: e.target.value })}
                  options={ACCESS}
                />
                <Button type="button" variant="outline" onClick={addContact}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{contacts.length + 1} of 5 used</p>
            </Card>
          )}
        </div>
        <Card title="Membership">
          <div className="space-y-4">
            <FormField label="Plan" error={errors.plan_id?.message} required>
              <NativeSelect
                placeholder="Choose…"
                options={planList.map((p) => ({ value: p.id, label: p.name }))}
                {...register('plan_id', {
                  onChange: (e) => {
                    setPlanId(e.target.value)
                    setInterval('')
                  },
                })}
              />
            </FormField>
            {prices.length > 0 && (
              <FormField label="Price">
                <NativeSelect
                  aria-label="Price"
                  value={price?.interval ?? ''}
                  onChange={(e) => setInterval(e.target.value)}
                  options={prices.map((p) => ({
                    value: p.interval,
                    label: `${cap(p.interval)} · ${rupees(p.amount)}${p.tax_mode === 'EXCLUSIVE' ? ' + GST' : ''}`,
                  }))}
                />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start date" error={errors.starts_at?.message}>
                <Input type="date" {...register('starts_at')} />
              </FormField>
              <FormField label="End date">
                <Input type="date" readOnly value={end} aria-label="End date" />
              </FormField>
            </div>
            <p className="text-sm font-medium">Payment</p>
            <Seg
              label="Payment"
              value={payment}
              onChange={setPayment}
              options={[
                { value: 'offline', label: 'Paid offline' },
                { value: 'link', label: 'Send pay link' },
                { value: 'complimentary', label: 'Complimentary' },
              ]}
            />
            {payment === 'offline' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Method">
                  <NativeSelect
                    options={enumOptions(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'OTHER'])}
                    {...register('method')}
                  />
                </FormField>
                <FormField label="Reference no.">
                  <Input {...register('reference')} />
                </FormField>
                <div className="col-span-2">
                  <FormField
                    label="Amount received (₹, incl. GST)"
                    hint={total ? `Plan price incl. GST: ${rupees(total)}` : undefined}
                  >
                    <Input type="number" step="any" min="0" {...register('amount')} />
                  </FormField>
                </div>
              </div>
            )}
            <ToggleRow
              label="Create login & send welcome message"
              hint="Mobile OTP login · WhatsApp + email"
              checked={login}
              onChange={setLogin}
            />
            <ToggleRow label="Issue GST invoice" checked={invoice} onChange={setInvoice} />
            <p className="text-sm">
              <b>Member since</b> will be {dmy(start)} (activation date).
            </p>
          </div>
        </Card>
      </div>
    </form>
  )
}
