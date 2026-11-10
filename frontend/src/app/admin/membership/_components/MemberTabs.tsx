'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
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
import { Card, NativeSelect, StatusPill, enumOptions, humanize } from './ui'

const dt = (d?: string | null) => (d ? formatDate(d) : '—')

export function OverviewTab({ member }: { member: Member }) {
  const s = member.subscription
  const rows: Array<[string, React.ReactNode]> = [
    ['Plan', s?.plan?.name ?? '—'],
    ['Status', s ? <StatusPill key="s" status={s.status} /> : '—'],
    ['Started', dt(s?.starts_at)],
    ['Valid till', s ? (s.ends_at ? dt(s.ends_at) : 'Lifetime') : '—'],
    ['Auto-renew', s?.auto_renew ? 'On' : 'Off'],
    ['Member since', dt(member.member_since)],
    ['Lifetime paid', rupees(member.lifetime_paid)],
  ]
  return (
    <Card title="Current membership">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {s?.suspended_reason && <p className="mt-3 text-sm">Suspended: {s.suspended_reason}</p>}
      {s?.cancel_reason && <p className="mt-3 text-sm">Cancelled: {s.cancel_reason}</p>}
    </Card>
  )
}

export function PaymentsTab({ member }: { member: Member }) {
  const pays = usePayments({ member_id: member.id, limit: 50 })
  const invs = useInvoices({ member_id: member.id, limit: 50 })
  return (
    <>
      <Card title="Payments">
        {(pays.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {pays.data!.items.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.reference}</span>
                <span>{dt(p.paid_at ?? p.created_at)}</span>
                <span>{rupees(p.amount)}</span>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Invoices">
        {(invs.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {invs.data!.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2">
                <span>{i.number}</span>
                <span>{dt(i.issued_at)}</span>
                <span>{rupees(i.total)}</span>
                <span>
                  {i.is_credit_note ? 'Credit note' : i.voided_at ? 'Void' : 'Tax invoice'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

const PROFILE_FIELDS: Array<{ key: keyof Member; label: string; org?: boolean; type?: string }> = [
  { key: 'full_name', label: 'Full name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'legal_name', label: 'Company name', org: true },
  { key: 'gstin', label: 'GSTIN', org: true },
  { key: 'pan', label: 'PAN', org: true },
  { key: 'dob', label: 'Date of birth', type: 'date' },
  { key: 'gender', label: 'Gender' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'address', label: 'Address' },
]

export function ProfileTab({ member }: { member: Member }) {
  const action = useAdminAction()
  const fields = PROFILE_FIELDS.filter((f) => !f.org || member.member_type === 'ORGANISATION')
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.type === 'date' ? String(member[f.key] ?? '').slice(0, 10) : String(member[f.key] ?? ''),
      ])
    ),
  })
  return (
    <Card title="Profile">
      <form
        className="grid max-w-2xl gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((v) =>
          action.mutate(
            { method: 'patch', path: `members/${member.id}`, data: v },
            { onSuccess: () => toast({ title: 'Profile saved' }) }
          )
        )}
      >
        {fields.map((f) => (
          <FormField key={f.key} label={f.label}>
            <Input type={f.type ?? 'text'} {...register(f.key)} />
          </FormField>
        ))}
        <div className="sm:col-span-2">
          {action.error && <ErrorAlert error={action.error} />}
          <Button type="submit" disabled={action.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ContactModal({
  member,
  contact,
  onClose,
}: {
  member: Member
  contact: Contact | 'new' | null
  onClose: () => void
}) {
  const action = useAdminAction()
  const editing = contact && contact !== 'new' ? contact : null
  const {
    register,
    handleSubmit,
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
        : { path: `members/${member.id}/contacts`, data: v },
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
      footer={
        <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
          Save contact
        </Button>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Name" error={errors.name?.message} required>
          <Input {...register('name')} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </FormField>
        <FormField label="Mobile">
          <Input {...register('mobile')} />
        </FormField>
        <FormField label="Designation">
          <Input {...register('designation')} />
        </FormField>
        <FormField label="Access">
          <NativeSelect
            options={enumOptions(['FULL', 'CONTENT', 'BILLING'])}
            {...register('access')}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_primary')} /> Primary contact
        </label>
        {action.error && <ErrorAlert error={action.error} />}
      </form>
    </Modal>
  )
}

const MAX_CONTACTS = 5

export function SectorTab({ member }: { member: Member }) {
  const action = useAdminAction()
  const [contact, setContact] = useState<Contact | 'new' | null>(null)
  const entries = Object.entries(member.fields ?? {})
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(entries.map(([k, v]) => [k, String(v ?? '')])),
  })
  const contacts = member.contacts ?? []
  return (
    <>
      <Card title="Sector details">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sector answers recorded.</p>
        ) : (
          <form
            className="grid max-w-2xl gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit((v) =>
              action.mutate(
                { method: 'patch', path: `members/${member.id}`, data: { fields: v } },
                { onSuccess: () => toast({ title: 'Details saved' }) }
              )
            )}
          >
            {entries.map(([k]) => (
              <FormField key={k} label={humanize(k).replace(/_/g, ' ')}>
                <Input {...register(k)} />
              </FormField>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={action.isPending}>
                Save details
              </Button>
            </div>
          </form>
        )}
      </Card>
      {member.member_type === 'ORGANISATION' && (
        <Card
          title={`Contacts (${contacts.length} of ${MAX_CONTACTS})`}
          action={
            <Button
              size="sm"
              disabled={contacts.length >= MAX_CONTACTS}
              onClick={() => setContact('new')}
            >
              <Plus className="h-4 w-4" /> Add contact
            </Button>
          }
        >
          <ul className="divide-y text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span>
                  {c.name}
                  {c.is_primary && <span className="ml-2 text-xs text-primary">Primary</span>}
                  <span className="block text-xs text-muted-foreground">
                    {[c.designation, c.email, c.mobile].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-xs">{humanize(c.access)}</span>
                <span>
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
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ContactModal member={member} contact={contact} onClose={() => setContact(null)} />
    </>
  )
}

export function NotesTab({ member }: { member: Member }) {
  const action = useAdminAction()
  const [note, setNote] = useState('')
  const [tags, setTags] = useState(member.tags.join(', '))
  return (
    <>
      <Card title="Internal notes">
        {member.notes && <p className="mb-3 whitespace-pre-wrap text-sm">{member.notes}</p>}
        <Textarea
          aria-label="New note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          className="mt-3"
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
      </Card>
      <Card title="Tags">
        <Input
          aria-label="Tags"
          placeholder="comma, separated"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Button
          className="mt-3"
          variant="outline"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(
              {
                method: 'patch',
                path: `members/${member.id}`,
                data: {
                  tags: tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                },
              },
              { onSuccess: () => toast({ title: 'Tags saved' }) }
            )
          }
        >
          Save tags
        </Button>
      </Card>
    </>
  )
}

interface Activity {
  id: string
  key: string
  created_at: string
  data?: Record<string, unknown>
}

export function ActivityTab({ member }: { member: Member }) {
  const { data, isLoading } = useAdminList<Activity>(`members/${member.id}/activity`)
  return (
    <Card title="Activity">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {data!.items.map((a) => (
            <li key={a.id} className="flex justify-between py-2">
              <span>{humanize(a.key.replace(/[._]/g, ' '))}</span>
              <span className="text-muted-foreground">
                {formatDate(a.created_at, 'MMM d, yyyy HH:mm')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
