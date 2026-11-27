'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Plus, ImageIcon, ExternalLink } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { useDefaultProjectId } from '@/admin/hooks/useDefaultProjectId'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  FIELDS,
  LABELS,
  SESSION_KINDS,
  SPONSOR_TIERS,
  formSchema,
  toForm,
  toPayload,
  type ApiRecord,
  type ChildKind,
  type FieldDef,
  type FormValues,
  type Kind,
} from './_schemas'
import { ProposalsTab } from './_proposals'

// DevFest admin: one edition per year, and each edition's speakers, sessions, sponsors and team.
// Everything the DevFest pages of the website show is entered here.

interface Edition extends ApiRecord {
  year: number
  name: string
  theme: string | null
  start_date: string | null
  end_date: string | null
  venue: string | null
  ticket_url: string | null
  cfp_url: string | null
  cfp_closes: string | null
  cfp_open: boolean
  tracks: { name: string; color?: string }[]
  is_current: boolean
}
interface Speaker extends ApiRecord {
  name: string
  role: string | null
  company: string | null
  photo_url: string | null
  is_featured: boolean
  is_visible: boolean
}

const TABS: ChildKind[] = ['speakers', 'sessions', 'sponsors', 'team']
type Tab = ChildKind | 'proposals'
const BASE = '/gdg/devfest'

const when = (iso: unknown, withTime = true) =>
  typeof iso === 'string' && iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: withTime ? undefined : 'numeric',
        ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
      })
    : ''

const listKey = (kind: Kind, scope: string | null | undefined) => [
  'gdg-devfest',
  kind,
  scope ?? null,
]

// ─── Inputs ──────────────────────────────────────────────────────────────────

function ImageInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of any stored link
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or pick from the media library"
          aria-label={`${label} link`}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Choose from media
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {open && (
        <MediaPicker
          open
          typeFilter="IMAGE"
          onClose={() => setOpen(false)}
          onSelect={(media) => {
            const url = media[0]?.url
            if (url) onChange(url)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function SpeakerPicker({
  value,
  onChange,
  speakers,
}: {
  value: string[]
  onChange: (v: string[]) => void
  speakers: Speaker[]
}) {
  if (!speakers.length)
    return <p className="text-sm text-muted-foreground">Add speakers first, then pick them here.</p>
  const on = new Set(value)
  return (
    <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
      {speakers.map((s) => (
        <label
          key={s.id}
          className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
        >
          <input
            type="checkbox"
            checked={on.has(s.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, s.id] : value.filter((x) => x !== s.id))
            }
          />
          <span className="truncate">{s.name}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Record form (any kind) ──────────────────────────────────────────────────

function RecordForm({
  kind,
  item,
  open,
  onClose,
  projectId,
  edition,
  speakers,
}: {
  kind: Kind
  item: ApiRecord | null
  open: boolean
  onClose: () => void
  projectId: string
  edition: Edition | null
  speakers: Speaker[]
}) {
  const qc = useQueryClient()
  const schema = useMemo(() => formSchema(kind), [kind])
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(kind, item),
  })
  useEffect(() => {
    if (open) form.reset(toForm(kind, item))
  }, [open, item, kind, form])

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = toPayload(kind, values)
      if (item) return api.patch(`${BASE}/${kind}/${item.id}`, body)
      return api.post(`${BASE}/${kind}`, {
        ...body,
        project_id: projectId,
        ...(kind === 'editions' ? {} : { edition_id: edition?.id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdg-devfest'] })
      qc.invalidateQueries({ queryKey: ['gdg-devfest-public'] })
      toast({
        title: item ? `${capital(LABELS[kind].one)} saved` : `${capital(LABELS[kind].one)} added`,
      })
      onClose()
    },
  })

  const errors = form.formState.errors
  const trackOptions = [
    { value: 'All', label: 'All (everyone attends)' },
    ...(edition?.tracks ?? []).map((t) => ({ value: t.name, label: t.name })),
  ]

  const field = (f: FieldDef) => {
    const error = errors[f.name]?.message as string | undefined
    return (
      <div key={f.name} className={f.wide || f.type === 'switch' ? 'sm:col-span-2' : undefined}>
        <Controller
          control={form.control}
          name={f.name}
          render={({ field: c }) => {
            if (f.type === 'switch')
              return (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={Boolean(c.value)} onCheckedChange={c.onChange} />
                  {f.label}
                </label>
              )
            let input: React.ReactNode
            const str = typeof c.value === 'string' ? c.value : ''
            switch (f.type) {
              case 'textarea':
              case 'links':
              case 'tracks':
              case 'stats':
                input = (
                  <Textarea
                    rows={f.type === 'textarea' ? 4 : 3}
                    value={str}
                    onChange={c.onChange}
                    placeholder={f.placeholder}
                  />
                )
                break
              case 'datetime':
                input = <Input type="datetime-local" value={str} onChange={c.onChange} />
                break
              case 'number':
                input = <Input inputMode="numeric" value={str} onChange={c.onChange} />
                break
              case 'image':
                input = <ImageInput value={str} onChange={c.onChange} label={f.label} />
                break
              case 'select':
              case 'track': {
                const options = f.type === 'track' ? trackOptions : (f.options ?? [])
                input = (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={str}
                    onChange={c.onChange}
                  >
                    {!f.required && <option value="">None</option>}
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {f.type === 'track' && str && !options.some((o) => o.value === str) && (
                      <option value={str}>{str}</option>
                    )}
                  </select>
                )
                break
              }
              case 'speakers':
                input = (
                  <SpeakerPicker
                    value={Array.isArray(c.value) ? c.value : []}
                    onChange={c.onChange}
                    speakers={speakers}
                  />
                )
                break
              default:
                input = <Input value={str} onChange={c.onChange} placeholder={f.placeholder} />
            }
            return (
              <FormField label={f.label} error={error} required={f.required} hint={f.hint}>
                {input}
              </FormField>
            )
          }}
        />
      </div>
    )
  }

  const noun = LABELS[kind].one
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `Edit ${noun}` : `New ${noun}`}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit((v) => save.mutate(v))} disabled={save.isPending}>
            {item ? 'Save changes' : 'Add'}
          </Button>
        </div>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
      >
        {FIELDS[kind].map(field)}
        {save.error && (
          <div className="sm:col-span-2">
            <ErrorAlert error={save.error} />
          </div>
        )}
      </form>
    </Modal>
  )
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ─── One tab: a list of speakers / sessions / sponsors / team ───────────────

function ChildList({
  kind,
  projectId,
  edition,
  speakers,
}: {
  kind: ChildKind
  projectId: string
  edition: Edition
  speakers: Speaker[]
}) {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApiRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: listKey(kind, edition.id),
    queryFn: () =>
      api
        .get(`${BASE}/${kind}`, { params: { project_id: projectId, edition_id: edition.id } })
        .then((r) => r.data.data.items as ApiRecord[]),
  })
  const items = data ?? []
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['gdg-devfest'] })
    qc.invalidateQueries({ queryKey: ['gdg-devfest-public'] })
  }
  const toggle = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, boolean> }) =>
      api.patch(`${BASE}/${kind}/${id}`, patch),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${kind}/${id}`),
    onSuccess: () => {
      invalidate()
      toast({ title: `${capital(LABELS[kind].one)} deleted` })
      setDeleteId(null)
    },
  })
  const open = (item: ApiRecord | null) => {
    setEditing(item)
    setFormOpen(true)
  }
  const speakerName = useMemo(() => new Map(speakers.map((s) => [s.id, s.name])), [speakers])
  const titleOf = (r: ApiRecord) => String(r.name ?? r.title ?? '')

  const main: ColumnDef<ApiRecord> = {
    id: 'main',
    header: kind === 'sessions' ? 'Session' : 'Name',
    cell: ({ row }) => {
      const r = row.original
      const photo = (r.photo_url ?? r.logo_url) as string | null
      const sub =
        kind === 'sessions'
          ? [r.track, r.room, SESSION_KINDS.find((k) => k.value === r.kind)?.label]
          : kind === 'sponsors'
            ? [SPONSOR_TIERS.find((t) => t.value === r.tier)?.label, r.url]
            : [r.role, r.company]
      return (
        <div className="flex min-w-[16rem] items-center gap-3">
          {kind !== 'sessions' && (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          )}
          <div>
            <div className="font-medium">{titleOf(r)}</div>
            <div className="text-xs text-muted-foreground">{sub.filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      )
    },
  }
  const columns: ColumnDef<ApiRecord>[] = [
    ...(kind === 'sessions'
      ? [
          {
            id: 'time',
            header: 'Time',
            cell: ({ row }: { row: { original: ApiRecord } }) => (
              <span className="whitespace-nowrap">{when(row.original.starts_at) || 'Not set'}</span>
            ),
          } as ColumnDef<ApiRecord>,
        ]
      : []),
    main,
    ...(kind === 'sessions'
      ? [
          {
            id: 'speakers',
            header: 'Speakers',
            cell: ({ row }: { row: { original: ApiRecord } }) => (
              <span className="text-sm">
                {((row.original.speaker_ids as string[]) ?? [])
                  .map((id) => speakerName.get(id))
                  .filter(Boolean)
                  .join(', ') || <span className="text-muted-foreground">None</span>}
              </span>
            ),
          } as ColumnDef<ApiRecord>,
        ]
      : []),
    ...(kind === 'speakers'
      ? [
          {
            id: 'featured',
            header: 'Featured',
            cell: ({ row }: { row: { original: ApiRecord } }) => (
              <Switch
                checked={Boolean(row.original.is_featured)}
                onCheckedChange={(v) =>
                  toggle.mutate({ id: row.original.id, patch: { is_featured: v } })
                }
                aria-label={`Feature ${titleOf(row.original)}`}
              />
            ),
          } as ColumnDef<ApiRecord>,
        ]
      : []),
    {
      id: 'shown',
      header: 'Shown',
      cell: ({ row }) => (
        <Switch
          checked={Boolean(row.original.is_visible)}
          onCheckedChange={(v) => toggle.mutate({ id: row.original.id, patch: { is_visible: v } })}
          aria-label={`Show ${titleOf(row.original)} on the website`}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => open(row.original)}
            aria-label={`Edit ${titleOf(row.original)}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${titleOf(row.original)}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const noun = LABELS[kind].one
  return (
    <section aria-label={LABELS[kind].many}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? noun : LABELS[kind].many.toLowerCase()} in{' '}
          {edition.name}. Turn off Shown to keep one off the website until you announce it.
        </p>
        <Button onClick={() => open(null)}>
          <Plus className="h-4 w-4" />
          Add {noun}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyMessage={`No ${LABELS[kind].many.toLowerCase()} in this edition yet.`}
      />
      <RecordForm
        kind={kind}
        item={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        projectId={projectId}
        edition={edition}
        speakers={speakers}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        title={`Delete ${noun}?`}
        description={
          kind === 'speakers'
            ? 'The speaker is also taken off every session that lists them.'
            : 'This cannot be undone. To hide it for now, turn off Shown instead.'
        }
        isLoading={remove.isPending}
      />
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function DevfestContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const qc = useQueryClient()
  const [editionId, setEditionId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('speakers')
  const [editionForm, setEditionForm] = useState<{ open: boolean; item: Edition | null }>({
    open: false,
    item: null,
  })
  const [deleteEdition, setDeleteEdition] = useState(false)

  const { data: editions, isLoading } = useQuery({
    queryKey: listKey('editions', projectId),
    queryFn: () =>
      api
        .get(`${BASE}/editions`, { params: { project_id: projectId } })
        .then((r) => r.data.data.items as Edition[]),
    enabled: Boolean(projectId),
  })
  const edition =
    editions?.find((e) => e.id === editionId) ??
    editions?.find((e) => e.is_current) ??
    editions?.[0] ??
    null

  const { data: speakers } = useQuery({
    queryKey: listKey('speakers', edition?.id),
    queryFn: () =>
      api
        .get(`${BASE}/speakers`, { params: { project_id: projectId, edition_id: edition?.id } })
        .then((r) => r.data.data.items as Speaker[]),
    enabled: Boolean(projectId && edition),
  })

  const removeEdition = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/editions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdg-devfest'] })
      qc.invalidateQueries({ queryKey: ['gdg-devfest-public'] })
      toast({ title: 'Edition deleted' })
      setDeleteEdition(false)
      setEditionId(null)
    },
  })

  if (projectResolving || isLoading)
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!projectId) {
    return (
      <div>
        <PageHeader title="DevFest" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet. Create one first.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="DevFest"
        breadcrumbs={[{ label: 'GDG Chapter', href: '/admin/gdg' }, { label: 'DevFest' }]}
        action={
          <Button onClick={() => setEditionForm({ open: true, item: null })}>
            <Plus className="h-4 w-4" />
            New edition
          </Button>
        }
      />

      {!edition ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <h2 className="text-lg font-semibold">No DevFest editions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            An edition is one year of DevFest. Create one, then add its speakers, sessions, sponsors
            and team. The DevFest pages of the website show the edition marked as current.
          </p>
          <Button className="mt-4" onClick={() => setEditionForm({ open: true, item: null })}>
            <Plus className="h-4 w-4" />
            Create the first edition
          </Button>
        </div>
      ) : (
        <>
          <section className="mb-6 rounded-lg border p-4" aria-label="Edition">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="edition-pick">
                    Edition
                  </label>
                  <select
                    id="edition-pick"
                    className="h-9 rounded-md border bg-background px-2 text-sm font-medium"
                    value={edition.id}
                    onChange={(e) => setEditionId(e.target.value)}
                  >
                    {editions?.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.year} · {e.name}
                      </option>
                    ))}
                  </select>
                  {edition.is_current ? (
                    <Badge>Shown on the website</Badge>
                  ) : (
                    <Badge variant="outline">Archive</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[
                    edition.theme,
                    edition.start_date && when(edition.start_date, false),
                    edition.venue,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Add the dates and venue in Edit edition.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tracks:{' '}
                  {edition.tracks?.length
                    ? edition.tracks.map((t) => t.name).join(', ')
                    : 'none yet'}
                </p>
              </div>
              <div className="flex gap-2">
                {edition.ticket_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={edition.ticket_url} target="_blank" rel="noopener noreferrer">
                      Tickets <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditionForm({ open: true, item: edition })}
                >
                  <Pencil className="h-4 w-4" />
                  Edit edition
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteEdition(true)}
                  aria-label={`Delete ${edition.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          <div role="tablist" aria-label="Edition content" className="mb-4 flex gap-1 border-b">
            {TABS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                  tab === k
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTab(k)}
              >
                {LABELS[k].many}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'proposals'}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === 'proposals'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('proposals')}
            >
              Proposals
            </button>
          </div>
          <div role="tabpanel">
            {tab === 'proposals' ? (
              <ProposalsTab key={edition.id} projectId={projectId} edition={edition} />
            ) : (
              <ChildList
                key={`${tab}-${edition.id}`}
                kind={tab}
                projectId={projectId}
                edition={edition}
                speakers={speakers ?? []}
              />
            )}
          </div>
        </>
      )}

      <RecordForm
        kind="editions"
        item={editionForm.item}
        open={editionForm.open}
        onClose={() => setEditionForm({ open: false, item: null })}
        projectId={projectId}
        edition={null}
        speakers={[]}
      />
      <ConfirmDialog
        open={deleteEdition}
        onClose={() => setDeleteEdition(false)}
        onConfirm={() => edition && removeEdition.mutate(edition.id)}
        title={`Delete ${edition?.name ?? 'edition'}?`}
        description="Its speakers, sessions, sponsors and team are deleted with it. This cannot be undone."
        isLoading={removeEdition.isPending}
      />
    </div>
  )
}

export default function GdgDevfestAdminPage() {
  return (
    <ModuleGuard slug="gdg">
      <PermissionGuard permission="gdg:view">
        <DevfestContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
