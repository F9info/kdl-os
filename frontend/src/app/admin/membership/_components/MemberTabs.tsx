'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Pencil, Trash2, X } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import {
  rupees,
  useAdminAction,
  useAdminList,
  useInvoices,
  usePayments,
  type Contact,
  type Member,
} from '@/admin/hooks/useMembership'
import { contactSchema, type ContactFormData } from '../_schemas'
import { Card, NativeSelect, StatusPill, humanize } from './ui'
import { MemberAvatar, Row, Seg, ToggleRow } from './MemberUi'
import { cap, daysBetween, dmy, dmyTime } from './MemberFormat'

// Extra member detail the screens use when the API returns it (see needs-A2). Everything is optional.
interface Detail extends Member {
  source?: string | null
  account?: {
    email_verified?: boolean
    signup_method?: string
    identities?: string[]
    last_login_at?: string
    site_role?: string
  }
  field_groups?: Array<{
    key: string
    name: string
    source?: string
    fields: Array<{ key: string; label: string; value: unknown; locked?: boolean }>
  }>
  documents?: Array<{
    id: string
    label: string
    file_name?: string | null
    size?: string | null
    status: 'VERIFIED' | 'UPLOADED' | 'MISSING'
    optional?: boolean
  }>
  verification?: Array<{ label: string; value: string }>
  notes_log?: Array<{ id: string; author: string; body: string; created_at: string }>
  missing_required?: string[]
  packs?: string[]
}
type D = { member: Detail }

interface Activity {
  id: string
  key: string
  created_at: string
  actor_name?: string | null
  ip?: string | null
  data?: Record<string, unknown>
}
const eventLabel = (a: Activity) =>
  typeof a.data?.description === 'string'
    ? a.data.description
    : humanize(a.key.replace(/[._]/g, ' '))

const STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

export function OverviewTab({ member }: D) {
  const s = member.subscription
  const invs = useInvoices({ member_id: member.id, limit: 1 })
  const act = useAdminList<Activity>(`members/${member.id}/activity`, { limit: 8 })
  const action = useAdminAction()
  const [note, setNote] = useState('')
  const start = s?.starts_at ? new Date(s.starts_at) : null
  const end = s?.ends_at ? new Date(s.ends_at) : null
  const left = end ? daysBetween(new Date(), end) : null
  const pct =
    start && end
      ? Math.min(100, Math.max(0, (daysBetween(start, new Date()) / daysBetween(start, end)) * 100))
      : 0
  const org = member.fields?.organisation ?? member.fields?.institution ?? member.legal_name
  const profile: Array<[string, unknown]> = [
    ['Organisation', org],
    ['Designation', member.fields?.designation],
    ['City / State', [member.city, member.state].filter(Boolean).join(', ')],
    ['Pincode', member.pincode],
    ['GSTIN', member.gstin],
    ['Source', member.source],
  ]
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card>
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="font-medium">
                {s?.plan?.name ?? '—'}
                {s?.price ? ` · ${cap(s.price.interval)}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valid till</p>
              <p className="font-semibold">
                {end ? dmy(s?.ends_at) : s?.starts_at ? 'Lifetime' : '—'}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{dmy(s?.starts_at)}</span>
            <span>
              {left !== null && `${Math.max(left, 0)} days left`}
              {s?.auto_renew ? ' · reminders on' : ''}
            </span>
          </div>
          {s?.suspended_reason && <p className="mt-3 text-sm">Suspended: {s.suspended_reason}</p>}
          {s?.cancel_reason && <p className="mt-3 text-sm">Cancelled: {s.cancel_reason}</p>}
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Member since', dmy(member.member_since)],
            ['Lifetime paid', rupees(member.lifetime_paid)],
            ['Invoices', String(invs.data?.total ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">{k}</p>
              <p className="mt-1 text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <Card title="Profile">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {profile.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd>{v ? String(v) : '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <Card title="Timeline">
        {(act.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="space-y-3 border-l pl-4 text-sm">
            {act.data!.items.map((a) => (
              <li key={a.id}>
                <b>{eventLabel(a)}</b>
                <span className="block text-xs text-muted-foreground">
                  {dmyTime(a.created_at)}
                  {a.actor_name ? ` · ${a.actor_name}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!note.trim()) return
            action.mutate(
              { path: `members/${member.id}/notes`, data: { notes: note } },
              {
                onSuccess: () => {
                  setNote('')
                  toast({ title: 'Note added' })
                },
              }
            )
          }}
        >
          <Input
            aria-label="Add a note"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </form>
      </Card>
    </div>
  )
}

interface PaymentRow {
  id: string
  paid_at: string | null
  created_at: string
  amount: number
  refunded_amount: number
  status: string
  purpose?: string | null
  method?: string | null
  provider?: { label: string } | null
  note?: string | null
  invoice?: { number: string } | null
  invoice_no?: string | null
}

export function PaymentsTab({ member }: D) {
  const pays = usePayments({ member_id: member.id, limit: 50 })
  const invs = useInvoices({ member_id: member.id, limit: 50 })
  const action = useAdminAction()
  const rows = (pays.data?.items ?? []) as unknown as PaymentRow[]
  const outstanding = rows
    .filter((p) => ['PENDING', 'AWAITING_PROOF', 'UNDER_VERIFICATION'].includes(p.status))
    .reduce((n, p) => n + p.amount, 0)
  const s = member.subscription
  const refund = (id: string) =>
    action.mutate(
      { path: `payments/${id}/refund`, data: {} },
      { onSuccess: () => toast({ title: 'Refund issued' }) }
    )
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Lifetime paid', rupees(member.lifetime_paid)],
          ['Outstanding', rupees(outstanding)],
          [
            'Next renewal',
            s?.ends_at ? `${dmy(s.ends_at)}${s.price ? ` · ${rupees(s.price.amount)}` : ''}` : '—',
          ],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{k}</p>
            <p className="mt-1 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              {['Date', 'Purpose', 'Method', 'Amount', 'Status', 'Invoice', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No payments yet.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const inv =
                p.invoice?.number ??
                p.invoice_no ??
                (rows.length === 1 && invs.data?.items.length === 1
                  ? invs.data.items[0]?.number
                  : null)
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">{dmy(p.paid_at ?? p.created_at)}</td>
                  <td className="px-4 py-3">{p.purpose ?? p.note ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.method ? humanize(p.method) : (p.provider?.label ?? '—')}
                  </td>
                  <td className="px-4 py-3">{rupees(p.amount)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-4 py-3">{inv ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'PAID' && !p.refunded_amount && (
                      <Button size="sm" variant="outline" onClick={() => refund(p.id)}>
                        Refund
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {action.error ? <ErrorAlert error={action.error} /> : null}
      {s?.ends_at && (
        <Card title="Upcoming">
          {[
            ['Renewal reminder T-30', -30],
            ['Renewal reminder T-7', -7],
            ['Membership ends', 0],
          ].map(([label, off]) => (
            <Row key={label as string} label={label as string}>
              {dmy(
                new Date(
                  new Date(s.ends_at!).getTime() + (off as number) * 86_400_000
                ).toISOString()
              )}
            </Row>
          ))}
        </Card>
      )}
    </div>
  )
}

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  mobile: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().max(500).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .regex(/^([1-9]\d{5})?$/, 'Pincode must be 6 digits')
    .optional(),
  gstin: z.string().optional(),
  legal_name: z.string().optional(),
  pan: z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

export function ProfileTab({ member }: D) {
  const action = useAdminAction()
  const org = member.member_type === 'ORGANISATION'
  const defaults = useMemo(
    () => ({
      full_name: member.full_name,
      email: member.email,
      mobile: member.mobile ?? '',
      dob: String(member.dob ?? '').slice(0, 10),
      address: member.address ?? '',
      city: member.city ?? '',
      state: member.state ?? '',
      pincode: member.pincode ?? '',
      gstin: member.gstin ?? '',
      legal_name: member.legal_name ?? '',
      pan: member.pan ?? '',
    }),
    [member]
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), values: defaults })
  const acct = member.account
  const [tags, setTags] = useState<string[]>(member.tags ?? [])
  const mail = (path: string, ok: string) =>
    action.mutate(
      { path: `members/${member.id}/${path}`, data: {} },
      { onSuccess: () => toast({ title: ok }) }
    )
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card title="Personal details">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((v) =>
            action.mutate(
              {
                method: 'patch',
                path: `members/${member.id}`,
                data: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')),
              },
              { onSuccess: () => toast({ title: 'Profile saved' }) }
            )
          )}
        >
          {org && (
            <FormField label="Company name">
              <Input {...register('legal_name')} />
            </FormField>
          )}
          <FormField label="Full name" error={errors.full_name?.message} required>
            <Input {...register('full_name')} />
          </FormField>
          <FormField label="Email" error={errors.email?.message} required>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Mobile">
            <Input {...register('mobile')} />
          </FormField>
          <FormField label="Date of birth">
            <Input type="date" {...register('dob')} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Address">
              <Input {...register('address')} />
            </FormField>
          </div>
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
          <FormField label="GSTIN">
            <Input {...register('gstin')} />
          </FormField>
          {org && (
            <FormField label="PAN">
              <Input {...register('pan')} />
            </FormField>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => reset(defaults)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              Save changes
            </Button>
          </div>
          {action.error && (
            <div className="sm:col-span-2">
              <ErrorAlert error={action.error} />
            </div>
          )}
        </form>
      </Card>
      <Card title="Account">
        <Row label="Login email">
          {acct?.email_verified === undefined
            ? '—'
            : acct.email_verified
              ? 'verified ✓'
              : 'not verified'}
        </Row>
        <Row label="Signed up with">{acct?.signup_method ? humanize(acct.signup_method) : '—'}</Row>
        <Row label="Linked logins">
          {acct?.identities?.length ? acct.identities.join(' · ') : '—'}
        </Row>
        <Row label="Last login">{dmyTime(acct?.last_login_at)}</Row>
        <Row label="Site role">
          {acct?.site_role ??
            `Member${member.subscription?.plan?.name ? ` — ${member.subscription.plan.name}` : ''}`}
        </Row>
        <div className="mt-3">
          <FormField label="Tags">
            <TagInput
              tags={tags}
              onChange={(t) => {
                setTags(t)
                action.mutate({ method: 'patch', path: `members/${member.id}`, data: { tags: t } })
              }}
            />
          </FormField>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => mail('send-password-reset', 'Password reset sent')}
          >
            Send password reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mail('resend-welcome', 'Welcome email sent')}
          >
            Resend welcome email
          </Button>
        </div>
      </Card>
    </div>
  )
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState('')
  const add = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = v.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setV('')
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        aria-label="Add tag"
        placeholder="Type and press Enter"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={add}
      />
    </div>
  )
}

const ACCESS = [
  { value: 'FULL', label: 'Full member access' },
  { value: 'CONTENT', label: 'Events & content' },
  { value: 'BILLING', label: 'Billing only' },
] as const

function ContactModal({
  member,
  contact,
  used,
  max,
  onClose,
}: {
  member: Member
  contact: Contact | 'new' | null
  used: number
  max: number
  onClose: () => void
}) {
  const action = useAdminAction()
  const editing = contact && contact !== 'new' ? contact : null
  const [invite, setInvite] = useState(true)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    values: {
      name: editing?.name ?? '',
      email: editing?.email ?? '',
      mobile: editing?.mobile ?? '',
      designation: editing?.designation ?? '',
      access: editing?.access ?? 'CONTENT',
      is_primary: editing?.is_primary ?? false,
    },
  })
  const onSubmit = (v: ContactFormData) =>
    action.mutate(
      editing
        ? { method: 'patch', path: `members/${member.id}/contacts/${editing.id}`, data: v }
        : { path: `members/${member.id}/contacts`, data: { ...v, send_invite: invite } },
      {
        onSuccess: () => {
          toast({ title: 'Contact saved' })
          onClose()
        },
      }
    )
  return (
    <Modal
      open={contact !== null}
      onClose={onClose}
      title={editing ? 'Edit contact' : 'Add contact'}
      description={`${member.legal_name || member.full_name} · ${used} of ${max} used`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
            {editing ? 'Save contact' : 'Add contact'}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Designation">
            <Input {...register('designation')} />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Mobile">
            <Input {...register('mobile')} />
          </FormField>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Access</span>
          <Seg
            label="Access"
            value={watch('access')}
            onChange={(v) => setValue('access', v)}
            options={[...ACCESS]}
          />
        </div>
        {!editing && <ToggleRow label="Send login invite" checked={invite} onChange={setInvite} />}
        <ToggleRow
          label="Make primary contact"
          checked={watch('is_primary')}
          onChange={(v) => setValue('is_primary', v)}
        />
        {action.error && <ErrorAlert error={action.error} />}
      </form>
    </Modal>
  )
}

const MAX_CONTACTS = 5

function PackCard({
  member,
  group,
}: {
  member: Detail
  group: NonNullable<Detail['field_groups']>[number]
}) {
  const action = useAdminAction()
  const [edit, setEdit] = useState(false)
  const { register, handleSubmit } = useForm<Record<string, string>>({
    values: Object.fromEntries(group.fields.map((f) => [f.key, String(f.value ?? '')])),
  })
  return (
    <Card
      title={`${group.name}${group.source ? ` · ${group.source}` : ''}`}
      action={
        <Button size="sm" variant="outline" onClick={() => setEdit((e) => !e)}>
          {edit ? 'Cancel' : 'Edit'}
        </Button>
      }
    >
      {edit ? (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((v) =>
            action.mutate(
              { method: 'patch', path: `members/${member.id}`, data: { fields: v } },
              {
                onSuccess: () => {
                  toast({ title: 'Details saved' })
                  setEdit(false)
                },
              }
            )
          )}
        >
          {group.fields.map((f) => (
            <FormField key={f.key} label={f.label}>
              <Input disabled={f.locked} {...register(f.key)} />
            </FormField>
          ))}
          <div className="sm:col-span-2">
            {action.error && <ErrorAlert error={action.error} />}
            <Button type="submit" disabled={action.isPending}>
              Save details
            </Button>
          </div>
        </form>
      ) : (
        <div className={member.member_type === 'ORGANISATION' ? 'grid gap-x-8 sm:grid-cols-2' : ''}>
          {group.fields.map((f) => (
            <Row key={f.key} label={f.label}>
              {f.value === null || f.value === undefined || f.value === '' ? '—' : String(f.value)}
              {f.locked ? ' 🔒' : ''}
            </Row>
          ))}
        </div>
      )}
    </Card>
  )
}

export function SectorTab({ member }: D) {
  const action = useAdminAction()
  const [contact, setContact] = useState<Contact | 'new' | null>(null)
  const org = member.member_type === 'ORGANISATION'
  const groups =
    member.field_groups ??
    (Object.keys(member.fields ?? {}).length
      ? [
          {
            key: 'fields',
            name: org ? 'Business details' : 'Sector details',
            fields: Object.entries(member.fields ?? {}).map(([k, v]) => ({
              key: k,
              label: humanize(k.replace(/_/g, ' ')),
              value: v,
            })),
          },
        ]
      : [])
  const contacts = member.contacts ?? []
  const docs = member.documents ?? []
  const act = useAdminList<Activity>(`members/${member.id}/activity`, { limit: 10 })
  const changes = (act.data?.items ?? []).filter((a) => /field|pack|profile/i.test(a.key))
  const verifyDoc = (id: string) =>
    action.mutate(
      { path: `members/${member.id}/documents/${id}/verify`, data: {} },
      { onSuccess: () => toast({ title: 'Document verified' }) }
    )
  const left = (
    <>
      {groups.length === 0 && (
        <Card title="Sector details">
          <p className="text-sm text-muted-foreground">No sector answers recorded.</p>
        </Card>
      )}
      {groups.map((g) => (
        <PackCard key={g.key} member={member} group={g} />
      ))}
      {org && (
        <Card
          title={`Contacts · ${contacts.length} of ${MAX_CONTACTS}`}
          action={
            <Button
              size="sm"
              disabled={contacts.length >= MAX_CONTACTS}
              onClick={() => setContact('new')}
            >
              Add contact
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  {['Person', 'Role', 'Mobile', 'Access', 'Status', ''].map((h) => (
                    <th key={h} className="py-2 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <MemberAvatar name={c.name} size={32} />
                        <span>
                          <span className="block font-medium">{c.name}</span>
                          <span className="block text-xs text-muted-foreground">{c.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="pr-3">{c.designation ?? '—'}</td>
                    <td className="pr-3">{c.mobile ?? '—'}</td>
                    <td className="pr-3">
                      {c.is_primary
                        ? 'Primary'
                        : (ACCESS.find((a) => a.value === c.access)?.label ?? humanize(c.access))}
                    </td>
                    <td className="pr-3">
                      <StatusPill
                        status={(c as Contact & { status?: string }).status ?? 'ACTIVE'}
                      />
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => setContact(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${c.name}`}
                        onClick={() =>
                          action.mutate({
                            method: 'delete',
                            path: `members/${member.id}/contacts/${c.id}`,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>{left}</div>
        <div>
          {org ? (
            <>
              <Card title="Documents">
                {docs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                )}
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <b className="font-medium">{d.label}</b>
                      <p className="text-xs text-muted-foreground">
                        {d.file_name
                          ? `${d.file_name}${d.size ? ` · ${d.size}` : ''}`
                          : 'Not uploaded'}
                      </p>
                    </div>
                    {d.status === 'VERIFIED' ? (
                      <StatusPill status="ACTIVE" />
                    ) : d.status === 'UPLOADED' ? (
                      <Button size="sm" onClick={() => verifyDoc(d.id)}>
                        Verify
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {d.optional ? 'Optional' : 'Missing'}
                      </span>
                    )}
                  </div>
                ))}
              </Card>
              <Card title="Verification">
                {(member.verification ?? []).map((v) => (
                  <Row key={v.label} label={v.label}>
                    {v.value}
                  </Row>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    action.mutate(
                      { path: `members/${member.id}/documents/request`, data: {} },
                      { onSuccess: () => toast({ title: 'Document requested' }) }
                    )
                  }
                >
                  Request a document
                </Button>
              </Card>
            </>
          ) : (
            <>
              <Card title="Member type">
                <Row label="Type">Individual</Row>
                <Row label="Packs asked by plan">
                  {member.packs?.length
                    ? member.packs.join(' · ')
                    : (member.subscription?.plan?.name ?? '—')}
                </Row>
                <Row label="Missing required answers">
                  {member.missing_required?.length ? member.missing_required.join(', ') : 'None ✓'}
                </Row>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    action.mutate(
                      {
                        method: 'patch',
                        path: `members/${member.id}`,
                        data: { member_type: 'ORGANISATION' },
                      },
                      { onSuccess: () => toast({ title: 'Converted to organisation' }) }
                    )
                  }
                >
                  Convert to organisation
                </Button>
              </Card>
              <Card title="Changes">
                {changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes yet.</p>
                ) : (
                  <ol className="space-y-3 border-l pl-4 text-sm">
                    {changes.map((a) => (
                      <li key={a.id}>
                        <b>{eventLabel(a)}</b>
                        <span className="block text-xs text-muted-foreground">
                          {a.actor_name ? `by ${a.actor_name} · ` : ''}
                          {dmyTime(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </>
          )}
          {action.error ? <ErrorAlert error={action.error} /> : null}
        </div>
      </div>
      <ContactModal
        member={member}
        contact={contact}
        used={contacts.length}
        max={MAX_CONTACTS}
        onClose={() => setContact(null)}
      />
    </>
  )
}

export function NotesTab({ member }: D) {
  const action = useAdminAction()
  const [note, setNote] = useState('')
  const tags = member.tags ?? []
  const setTags = (t: string[]) =>
    action.mutate(
      { method: 'patch', path: `members/${member.id}`, data: { tags: t } },
      { onSuccess: () => toast({ title: 'Tags saved' }) }
    )
  const log =
    member.notes_log ??
    (member.notes ? [{ id: 'n', author: '', body: member.notes, created_at: '' }] : [])
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card title="Internal notes">
        <FormField label="Add a note">
          <Textarea
            aria-label="New note"
            rows={3}
            placeholder="Write a note visible only to admins…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
        <Button
          size="sm"
          className="mb-4"
          disabled={!note.trim() || action.isPending}
          onClick={() =>
            action.mutate(
              { path: `members/${member.id}/notes`, data: { notes: note } },
              {
                onSuccess: () => {
                  setNote('')
                  toast({ title: 'Note added' })
                },
              }
            )
          }
        >
          Add note
        </Button>
        {action.error ? <ErrorAlert error={action.error} /> : null}
        <div className="space-y-3">
          {log.map((n) => (
            <div key={n.id} className="rounded-lg border p-3">
              {(n.author || n.created_at) && (
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {n.author && <MemberAvatar name={n.author} size={24} />}
                    {n.author}
                  </span>
                  <span>{dmyTime(n.created_at)}</span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </Card>
    </div>
  )
}

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '0', label: 'All time' },
]

export function ActivityTab({ member }: D) {
  const { data, isLoading } = useAdminList<Activity>(`members/${member.id}/activity`, {
    limit: 100,
  })
  const [actor, setActor] = useState('')
  const [key, setKey] = useState('')
  const [range, setRange] = useState('30')
  const all = data?.items ?? []
  const actorOf = (a: Activity) => a.actor_name ?? 'System'
  const items = all.filter(
    (a) =>
      (!actor || actorOf(a) === actor) &&
      (!key || a.key === key) &&
      (range === '0' || Date.now() - new Date(a.created_at).getTime() <= Number(range) * 86_400_000)
  )
  const uniq = (xs: string[]) => [...new Set(xs)].map((v) => ({ value: v, label: v }))
  function exportCsv() {
    const csv = [
      'when,actor,action,ip',
      ...items.map((a) =>
        [a.created_at, actorOf(a), eventLabel(a), a.ip ?? '']
          .map((c) => `"${c.replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const l = document.createElement('a')
    l.href = url
    l.download = 'member-activity.csv'
    l.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          aria-label="Actor"
          className="w-40"
          placeholder="All actors"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          options={uniq(all.map(actorOf))}
        />
        <NativeSelect
          aria-label="Action"
          className="w-44"
          placeholder="All actions"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          options={[...new Set(all.map((a) => a.key))].map((k) => ({
            value: k,
            label: humanize(k.replace(/[._]/g, ' ')),
          }))}
        />
        <NativeSelect
          aria-label="Range"
          className="w-40"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          options={RANGES}
        />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={items.length === 0}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              {['When', 'Actor', 'Action', 'IP'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No activity yet.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {dmyTime(a.created_at)}
                  </td>
                  <td className="px-4 py-3">{actorOf(a)}</td>
                  <td className="px-4 py-3">{eventLabel(a)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.ip ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
