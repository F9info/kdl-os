'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, Trash2, UserCheck, ExternalLink } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { DataTable } from '@/admin/components/shared/DataTable'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

// Talk proposals sent through the call for speakers form on the website, for one edition.
// Review them, then accept the ones you want: that adds a hidden speaker and session.

export interface Proposal {
  id: string
  name: string
  email: string
  phone: string | null
  city: string | null
  role: string | null
  company: string | null
  bio: string
  photo_url: string | null
  linkedin: string | null
  website: string | null
  title: string
  abstract: string
  format: string
  track: string | null
  level: string | null
  notes: string | null
  first_time: boolean
  status: Status
  review_note: string | null
  speaker_id: string | null
  session_id: string | null
  created_at: string
}

type Status = 'new' | 'shortlisted' | 'waitlist' | 'accepted' | 'rejected'
const STATUSES: { value: Status; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Not selected' },
]
const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s
const FORMATS: Record<string, string> = {
  talk: 'Talk (30 min)',
  lightning: 'Lightning talk (10 min)',
  workshop: 'Workshop / code lab',
  panel: 'Panel',
}
const STATUS_CLASS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  shortlisted: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  waitlist: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
  accepted: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
  rejected: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status] ?? ''}`}
    >
      {statusLabel(status)}
    </span>
  )
}

const day = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

const BASE = '/gdg/devfest/proposals'
const KEY = ['gdg-devfest', 'proposals']

function toCsv(rows: Proposal[]) {
  const cols: (keyof Proposal)[] = [
    'created_at',
    'status',
    'name',
    'email',
    'phone',
    'city',
    'role',
    'company',
    'title',
    'format',
    'track',
    'level',
    'abstract',
    'bio',
    'linkedin',
    'website',
    'photo_url',
    'first_time',
    'notes',
    'review_note',
  ]
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    // Quote everything, and stop spreadsheet formulas from running.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}

export function ProposalsTab({
  projectId,
  edition,
}: {
  projectId: string
  edition: {
    id: string
    name: string
    cfp_open?: boolean
    cfp_closes?: string | null
    cfp_url?: string | null
  }
}) {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading, error } = useQuery({
    queryKey: [...KEY, edition.id],
    queryFn: () =>
      api
        .get(BASE, { params: { project_id: projectId, edition_id: edition.id } })
        .then((r) => r.data.data.items as Proposal[]),
  })
  const all = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length }
    for (const p of all) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [all])
  const rows = filter === 'all' ? all : all.filter((p) => p.status === filter)
  const current = all.find((p) => p.id === openId) ?? null

  const closes = edition.cfp_closes ? new Date(edition.cfp_closes) : null
  const open = Boolean(edition.cfp_open) && (!closes || closes > new Date())

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${edition.name.replace(/\s+/g, '-').toLowerCase()}-proposals.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const columns: ColumnDef<Proposal>[] = [
    {
      id: 'when',
      header: 'Received',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">{day(row.original.created_at)}</span>
      ),
    },
    {
      id: 'talk',
      header: 'Proposal',
      cell: ({ row }) => {
        const p = row.original
        return (
          <button type="button" className="min-w-[16rem] text-left" onClick={() => setOpenId(p.id)}>
            <div className="font-medium hover:underline">{p.title}</div>
            <div className="text-xs text-muted-foreground">
              {[p.name, p.company].filter(Boolean).join(' · ')}
              {p.first_time ? ' · First-time speaker' : ''}
            </div>
          </button>
        )
      },
    },
    {
      id: 'kind',
      header: 'Track and format',
      cell: ({ row }) => (
        <span className="text-sm">
          {[
            row.original.track,
            FORMATS[row.original.format] ?? row.original.format,
            row.original.level,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpenId(row.original.id)}
          aria-label={`Review ${row.original.title}`}
        >
          <Eye className="h-4 w-4" />
          Review
        </Button>
      ),
    },
  ]

  return (
    <section aria-label="Proposals">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Call for speakers:{' '}
          {open ? (
            <span className="font-medium text-green-700 dark:text-green-400">
              open{closes ? ` until ${day(closes.toISOString())}` : ''}
            </span>
          ) : (
            <span className="font-medium">
              closed. Turn on “Take talk proposals” in Edit edition to open it.
            </span>
          )}
          {edition.cfp_url ? ' Proposals may also come in through your outside link.' : ''}
        </p>
        <Button variant="outline" size="sm" onClick={download} disabled={!rows.length}>
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[{ value: 'all' as const, label: 'All' }, ...STATUSES].map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={filter === s.value ? 'default' : 'outline'}
            onClick={() => setFilter(s.value)}
            aria-pressed={filter === s.value}
          >
            {s.label} <Badge variant="secondary">{counts[s.value] ?? 0}</Badge>
          </Button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        emptyMessage={
          all.length
            ? 'No proposals with this status.'
            : 'No proposals yet. They appear here when people send the call for speakers form.'
        }
      />
      {current && <ReviewModal proposal={current} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  )
}

const ext = (href: string) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-primary underline"
  >
    {href.replace(/^https?:\/\//, '').slice(0, 60)} <ExternalLink className="h-3 w-3" />
  </a>
)

function ReviewModal({ proposal: p, onClose }: { proposal: Proposal; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Status>(p.status)
  const [note, setNote] = useState(p.review_note ?? '')
  const [confirm, setConfirm] = useState<'accept' | 'delete' | null>(null)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['gdg-devfest'] })
    qc.invalidateQueries({ queryKey: ['gdg-devfest-public'] })
  }
  const save = useMutation({
    mutationFn: () =>
      api.patch(`${BASE}/${p.id}`, {
        ...(status !== p.status ? { status } : {}),
        review_note: note.trim() || null,
      }),
    onSuccess: () => {
      refresh()
      toast({ title: 'Review saved' })
    },
  })
  const accept = useMutation({
    mutationFn: () => api.post(`${BASE}/${p.id}/accept`),
    onSuccess: () => {
      refresh()
      setConfirm(null)
      setStatus('accepted')
      toast({
        title: 'Accepted',
        description: `${p.name} and the talk are now in Speakers and Sessions, hidden until you turn on Shown.`,
      })
    },
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`${BASE}/${p.id}`),
    onSuccess: () => {
      refresh()
      toast({ title: 'Proposal deleted' })
      onClose()
    },
  })
  const accepted = Boolean(p.speaker_id)
  const err = save.error ?? accept.error ?? remove.error

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={p.title}
      description={`${p.name} · received ${day(p.created_at)}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirm('delete')}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <div className="flex flex-wrap gap-2">
            {!accepted && (
              <Button variant="outline" onClick={() => setConfirm('accept')}>
                <UserCheck className="h-4 w-4" />
                Accept and add as speaker
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save review'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {err ? <ErrorAlert error={err} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={p.status} />
          {p.first_time && <Badge variant="outline">First-time speaker</Badge>}
          {accepted && (
            <span className="text-xs text-muted-foreground">
              Speaker and session added (hidden). Turn on Shown in the Speakers and Sessions tabs to
              announce them.
            </span>
          )}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">The talk</h3>
          <dl className="space-y-2">
            <Row label="Format">{FORMATS[p.format] ?? p.format}</Row>
            {p.track && <Row label="Track">{p.track}</Row>}
            {p.level && <Row label="Level">{p.level}</Row>}
            <Row label="Abstract">
              <p className="whitespace-pre-line">{p.abstract}</p>
            </Row>
            {p.notes && (
              <Row label="Notes for organizers">
                <p className="whitespace-pre-line">{p.notes}</p>
              </Row>
            )}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">The speaker</h3>
          <dl className="space-y-2">
            <Row label="Name">{p.name}</Row>
            {(p.role || p.company) && (
              <Row label="Role">{[p.role, p.company].filter(Boolean).join(', ')}</Row>
            )}
            <Row label="Email">
              <a className="text-primary underline" href={`mailto:${p.email}`}>
                {p.email}
              </a>
            </Row>
            {p.phone && (
              <Row label="Phone">
                <a className="text-primary underline" href={`tel:${p.phone}`}>
                  {p.phone}
                </a>
              </Row>
            )}
            {p.city && <Row label="City">{p.city}</Row>}
            <Row label="Bio">
              <p className="whitespace-pre-line">{p.bio}</p>
            </Row>
            {p.linkedin && <Row label="LinkedIn">{ext(p.linkedin)}</Row>}
            {p.website && <Row label="Website">{ext(p.website)}</Row>}
            {p.photo_url && (
              <Row label="Photo">
                <a href={p.photo_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded speaker photo */}
                  <img
                    src={p.photo_url}
                    alt={`Photo of ${p.name}`}
                    className="h-24 w-24 rounded-lg border object-cover"
                  />
                </a>
              </Row>
            )}
          </dl>
        </section>

        <section className="space-y-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">Your review</h3>
          {!accepted && (
            <FormField label="Status">
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {STATUSES.filter((s) => s.value !== 'accepted').map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Notes (only organizers see these)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </section>
      </div>

      <ConfirmDialog
        open={confirm === 'accept'}
        onClose={() => setConfirm(null)}
        onConfirm={() => accept.mutate()}
        title="Accept this proposal?"
        confirmLabel="Accept"
        variant="warning"
        description={`${p.name} is added to Speakers and “${p.title}” to Sessions, both hidden. Set the session time, then turn on Shown to announce.`}
        isLoading={accept.isPending}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate()}
        title="Delete this proposal?"
        description={
          accepted
            ? 'The speaker and session already added stay. This only deletes the proposal.'
            : 'This cannot be undone. To keep it but pass on it, set the status to Not selected.'
        }
        isLoading={remove.isPending}
      />
    </Modal>
  )
}
