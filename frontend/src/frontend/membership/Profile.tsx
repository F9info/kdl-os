'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { del, post, put, useJoinForm, useMe } from './api'
import { FieldInput, missingRequired } from './FieldInput'
import type { Contact, FieldGroup, MeData } from './types'

const CORE = [
  ['full_name', 'Full name'],
  ['mobile', 'Mobile'],
  ['dob', 'Date of birth'],
  ['address', 'Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['pincode', 'Pincode'],
] as const
const ORG = [
  ['legal_name', 'Organisation legal name'],
  ['gstin', 'GSTIN'],
] as const

function useSave<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      setSaved(true)
      return qc.invalidateQueries({ queryKey: ['membership', 'me'] })
    },
  })
  return { ...m, saved, save: (v: T) => (setSaved(false), m.mutate(v)) }
}

function Result({ saved, error }: { saved: boolean; error: unknown }) {
  return (
    <>
      {error ? <ErrorAlert error={error} /> : null}
      {saved && (
        <p role="status" className="text-sm text-primary">
          Saved.
        </p>
      )}
    </>
  )
}

function Personal({ me }: { me: MeData }) {
  const m = me.member as unknown as Record<string, string | null>
  const rows = me.member.member_type === 'ORGANISATION' ? [...CORE, ...ORG] : CORE
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(
      rows.map(([k]) => [k, (m[k] ?? '').toString().slice(0, k === 'dob' ? 10 : 200)])
    )
  )
  const s = useSave((b: Record<string, string | null>) => put('/membership/me', b))
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        s.save(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : x])))
      }}
    >
      {rows.map(([k, label]) => (
        <FormField key={k} label={label}>
          <Input
            type={k === 'dob' ? 'date' : 'text'}
            value={v[k]}
            onChange={(e) => setV({ ...v, [k]: e.target.value })}
          />
        </FormField>
      ))}
      <p className="text-xs text-muted-foreground">Email: {me.member.email}</p>
      <Result saved={s.saved} error={s.error} />
      <Button type="submit" disabled={s.isPending}>
        Save
      </Button>
    </form>
  )
}

function Pack({ group, me }: { group: FieldGroup; me: MeData }) {
  const [v, setV] = useState<Record<string, unknown>>(me.fields ?? {})
  const [errs, setErrs] = useState<Record<string, string>>({})
  const s = useSave((b: Record<string, unknown>) => put('/membership/me/fields', b))
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const miss = missingRequired([group], v)
        setErrs(miss)
        if (!Object.keys(miss).length)
          s.save(Object.fromEntries(group.fields.map((f) => [f.key, v[f.key] ?? null])))
      }}
    >
      {group.fields.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={v[f.key]}
          error={errs[f.key]}
          onChange={(x) => setV({ ...v, [f.key]: x })}
        />
      ))}
      <Result saved={s.saved} error={s.error} />
      <Button type="submit" disabled={s.isPending}>
        Save
      </Button>
    </form>
  )
}

function Contacts({ me }: { me: MeData }) {
  const qc = useQueryClient()
  const max = me.plan?.max_contacts ?? 5
  const [c, setC] = useState({ name: '', email: '', mobile: '', designation: '' })
  const refresh = () => qc.invalidateQueries({ queryKey: ['membership', 'me'] })
  const add = useMutation({
    mutationFn: () =>
      post('/membership/me/contacts', { ...c, is_primary: me.contacts.length === 0 }),
    onSuccess: () => (setC({ name: '', email: '', mobile: '', designation: '' }), refresh()),
  })
  const rm = useMutation({
    mutationFn: (id: string) => del(`/membership/me/contacts/${id}`),
    onSuccess: refresh,
  })
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {me.contacts.map((x: Contact) => (
          <li
            key={x.id}
            className="flex items-center justify-between rounded-md border bg-card p-3 text-sm"
          >
            <span>
              {x.name}
              {x.is_primary ? ' (primary)' : ''} · {x.designation ?? ''} {x.email ?? ''}{' '}
              {x.mobile ?? ''}
            </span>
            <Button variant="outline" size="sm" onClick={() => rm.mutate(x.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {me.contacts.length >= max ? (
        <p className="text-sm text-muted-foreground">You can add up to {max} contacts.</p>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (c.name.trim()) add.mutate()
          }}
        >
          {(['name', 'designation', 'email', 'mobile'] as const).map((k) => (
            <FormField key={k} label={k[0]!.toUpperCase() + k.slice(1)} required={k === 'name'}>
              <Input value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
            </FormField>
          ))}
          <div className="sm:col-span-2">
            {add.error && <ErrorAlert error={add.error} />}
            <Button type="submit" disabled={add.isPending}>
              Add contact
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export function Profile() {
  const { data: me } = useMe()
  const { data: groups = [] } = useJoinForm(me?.plan?.slug, me?.member.member_type)
  const [tab, setTab] = useState('personal')
  if (!me) return null
  const tabs = [
    { key: 'personal', label: 'Personal' },
    ...groups.map((g) => ({ key: `g:${g.key}`, label: g.name })),
    ...(me.member.member_type === 'ORGANISATION' ? [{ key: 'contacts', label: 'Contacts' }] : []),
  ]
  const group = groups.find((g) => `g:${g.key}` === tab)
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div role="tablist" className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-primary font-medium' : 'border-transparent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={tab}>
        {tab === 'personal' && <Personal me={me} />}
        {group && <Pack group={group} me={me} />}
        {tab === 'contacts' && <Contacts me={me} />}
      </div>
    </div>
  )
}
