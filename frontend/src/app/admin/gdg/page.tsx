'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Plus, RefreshCw } from 'lucide-react'
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
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  CATEGORIES,
  eventSchema,
  syncSchema,
  type EventFormData,
  type SyncFormData,
} from './_schemas'

interface ChapterEvent {
  id: string
  source: 'manual' | 'gdg'
  title: string
  start_date: string
  end_date: string | null
  venue: string | null
  event_type: string | null
  image_url: string | null
  register_url: string | null
  page_url: string | null
  description: string | null
  category: string | null
  is_featured: boolean
  is_hidden: boolean
}

interface SyncSettings {
  chapter_id: number | null
  chapter_slug: string | null
  auto_sync: boolean
  last_synced_at: string | null
  last_result: { ok: boolean; created?: number; updated?: number; error?: string } | null
  members_count: number | null
}

// <input type="datetime-local"> works in local time; the API stores UTC.
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const EMPTY: EventFormData = {
  title: '',
  start_date: '',
  end_date: '',
  venue: '',
  event_type: '',
  image_url: '',
  register_url: '',
  description: '',
  category: '',
  is_featured: false,
  is_hidden: false,
}

function SyncCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['gdg-sync', projectId],
    queryFn: () =>
      api
        .get('/gdg/sync', { params: { project_id: projectId } })
        .then((r) => r.data.data.settings as SyncSettings | null),
  })
  const form = useForm<SyncFormData>({
    resolver: zodResolver(syncSchema),
    defaultValues: { chapter_id: '', chapter_slug: '', auto_sync: true },
  })
  useEffect(() => {
    if (data)
      form.reset({
        chapter_id: data.chapter_id ? String(data.chapter_id) : '',
        chapter_slug: data.chapter_slug ?? '',
        auto_sync: data.auto_sync,
      })
  }, [data, form])

  const save = useMutation({
    mutationFn: (v: SyncFormData) =>
      api.put(
        '/gdg/sync',
        {
          chapter_id: v.chapter_id ? Number(v.chapter_id) : null,
          chapter_slug: v.chapter_slug || null,
          auto_sync: v.auto_sync,
        },
        { params: { project_id: projectId } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdg-sync', projectId] })
      toast({ title: 'Sync settings saved' })
    },
  })
  const run = useMutation({
    mutationFn: () =>
      api
        .post('/gdg/sync/run', {}, { params: { project_id: projectId } })
        .then((r) => r.data.data.result),
    onSuccess: (result: SyncSettings['last_result']) => {
      qc.invalidateQueries({ queryKey: ['gdg-sync', projectId] })
      qc.invalidateQueries({ queryKey: ['gdg-events', projectId] })
      toast(
        result?.ok
          ? {
              title: 'Sync finished',
              description: `${result.created} new, ${result.updated} updated`,
            }
          : { title: 'Sync failed', description: result?.error, variant: 'destructive' }
      )
    },
  })
  const last = data?.last_result

  return (
    <section className="mb-6 rounded-lg border bg-card p-4" aria-labelledby="sync-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sync-h" className="text-base font-semibold">
            Chapter sync (gdg.community.dev)
          </h2>
          <p className="text-sm text-muted-foreground">
            Imports the chapter&apos;s events and organizers every 6 hours. Synced events keep their
            title, dates and links from the chapter page; you can still set the category, feature or
            hide them.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => run.mutate()}
          disabled={run.isPending || !data?.chapter_id}
        >
          <RefreshCw className={`h-4 w-4 ${run.isPending ? 'animate-spin' : ''}`} />
          Sync now
        </Button>
      </div>
      <form
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4"
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
      >
        <FormField
          label="Chapter id"
          error={form.formState.errors.chapter_id?.message}
          hint="e.g. 318"
        >
          <Input inputMode="numeric" {...form.register('chapter_id')} />
        </FormField>
        <FormField
          label="Chapter slug"
          error={form.formState.errors.chapter_slug?.message}
          hint="From the chapter URL, e.g. gdg-vizag"
        >
          <Input {...form.register('chapter_slug')} />
        </FormField>
        <FormField label="Auto sync">
          <div className="flex h-10 items-center">
            <Switch
              checked={form.watch('auto_sync')}
              onCheckedChange={(v) => form.setValue('auto_sync', v)}
              aria-label="Auto sync"
            />
          </div>
        </FormField>
        <div className="flex items-end">
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {data?.last_synced_at
          ? `Last good sync: ${when(data.last_synced_at)}. `
          : 'Not synced yet. '}
        {last &&
          (last.ok
            ? `${last.created} new, ${last.updated} updated.`
            : `Last run failed: ${last.error}`)}
        {data?.members_count
          ? ` Chapter members: ${data.members_count.toLocaleString('en-IN')}.`
          : ''}
      </p>
      {save.error && <ErrorAlert error={save.error} />}
    </section>
  )
}

function EventsPageContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ChapterEvent | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['gdg-events', projectId],
    queryFn: () =>
      api
        .get('/gdg/events', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: ChapterEvent[] }),
    enabled: Boolean(projectId),
  })
  const items = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.items ?? []).filter(
      (e) => !q || e.title.toLowerCase().includes(q) || (e.venue ?? '').toLowerCase().includes(q)
    )
  }, [data, search])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: EMPTY,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['gdg-events', projectId] })
  const toPayload = (f: EventFormData) => ({
    title: f.title,
    start_date: fromLocalInput(f.start_date),
    end_date: fromLocalInput(f.end_date),
    venue: f.venue || null,
    event_type: f.event_type || null,
    image_url: f.image_url || null,
    register_url: f.register_url || null,
    description: f.description || null,
    category: f.category || null,
    is_featured: f.is_featured,
    is_hidden: f.is_hidden,
  })
  const save = useMutation({
    mutationFn: async (f: EventFormData) => {
      if (editing) await api.patch(`/gdg/events/${editing.id}`, toPayload(f))
      else await api.post('/gdg/events', { ...toPayload(f), project_id: projectId })
    },
    onSuccess: () => {
      invalidate()
      toast({ title: editing ? 'Event updated' : 'Event created' })
      setFormOpen(false)
    },
  })
  const toggle = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ChapterEvent> }) =>
      api.patch(`/gdg/events/${id}`, patch),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/gdg/events/${id}`),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Event deleted' })
      setDeleteId(null)
    },
  })

  function openForm(e: ChapterEvent | null) {
    setEditing(e)
    reset(
      e
        ? {
            title: e.title,
            start_date: toLocalInput(e.start_date),
            end_date: toLocalInput(e.end_date),
            venue: e.venue ?? '',
            event_type: e.event_type ?? '',
            image_url: e.image_url ?? '',
            register_url: e.register_url ?? '',
            description: e.description ?? '',
            category: e.category ?? '',
            is_featured: e.is_featured,
            is_hidden: e.is_hidden,
          }
        : EMPTY
    )
    setFormOpen(true)
  }

  const synced = editing?.source === 'gdg'

  const columns: ColumnDef<ChapterEvent>[] = [
    {
      accessorKey: 'title',
      header: 'Event',
      cell: ({ row }) => (
        <div className="min-w-[16rem]">
          <div className="font-medium">{row.original.title}</div>
          <div className="text-xs text-muted-foreground">{row.original.venue}</div>
        </div>
      ),
    },
    {
      accessorKey: 'start_date',
      header: 'Starts',
      cell: ({ row }) => <span className="whitespace-nowrap">{when(row.original.start_date)}</span>,
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <Badge variant={row.original.source === 'gdg' ? 'secondary' : 'outline'}>
          {row.original.source === 'gdg' ? 'Synced' : 'Manual'}
        </Badge>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) =>
        row.original.category ?? <span className="text-muted-foreground">Auto</span>,
    },
    {
      accessorKey: 'is_featured',
      header: 'Featured',
      cell: ({ row }) => (
        <Switch
          checked={row.original.is_featured}
          onCheckedChange={(v) => toggle.mutate({ id: row.original.id, patch: { is_featured: v } })}
          aria-label={`Feature ${row.original.title}`}
        />
      ),
    },
    {
      accessorKey: 'is_hidden',
      header: 'Shown',
      cell: ({ row }) => (
        <Switch
          checked={!row.original.is_hidden}
          onCheckedChange={(v) => toggle.mutate({ id: row.original.id, patch: { is_hidden: !v } })}
          aria-label={`Show ${row.original.title} on the website`}
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
            onClick={() => openForm(row.original)}
            aria-label={`Edit ${row.original.title}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (projectResolving) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!projectId) {
    return (
      <div>
        <PageHeader title="GDG Chapter" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet. Create one first.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="GDG Chapter"
        breadcrumbs={[{ label: 'GDG Chapter' }]}
        action={
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" />
            New event
          </Button>
        }
      />
      <SyncCard projectId={projectId} />
      <div className="mb-3 max-w-sm">
        <Input
          placeholder="Search events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search events"
        />
      </div>
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyMessage="No events yet. Add one, or set up the chapter sync."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit event' : 'New event'}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit((f) => save.mutate(f))} disabled={save.isPending}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit((f) => save.mutate(f))}>
          {synced && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              This event comes from the chapter page. Its title, dates, venue and links update on
              every sync, so only the category, featured and shown settings can be changed here.
            </p>
          )}
          <fieldset disabled={synced} className="space-y-4 disabled:opacity-60">
            <FormField label="Title" error={errors.title?.message} required>
              <Input {...register('title')} />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Starts" error={errors.start_date?.message} required>
                <Input type="datetime-local" {...register('start_date')} />
              </FormField>
              <FormField label="Ends" error={errors.end_date?.message}>
                <Input type="datetime-local" {...register('end_date')} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Venue" error={errors.venue?.message}>
                <Input {...register('venue')} />
              </FormField>
              <FormField
                label="Type"
                error={errors.event_type?.message}
                hint="e.g. Free registration, Hackathon"
              >
                <Input {...register('event_type')} />
              </FormField>
            </div>
            <FormField label="Register link" error={errors.register_url?.message}>
              <Input placeholder="https://…" {...register('register_url')} />
            </FormField>
            <FormField label="Image URL" error={errors.image_url?.message}>
              <Input placeholder="https://… or /uploads/…" {...register('image_url')} />
            </FormField>
            <FormField label="Short description" error={errors.description?.message}>
              <Textarea rows={3} {...register('description')} />
            </FormField>
          </fieldset>
          <FormField label="Category" hint="Auto picks it from the title">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              {...register('category')}
            >
              <option value="">Auto</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={watch('is_featured')}
                onCheckedChange={(v) => setValue('is_featured', v)}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!watch('is_hidden')}
                onCheckedChange={(v) => setValue('is_hidden', !v)}
              />
              Shown on the website
            </label>
          </div>
          {save.error && <ErrorAlert error={save.error} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        title="Delete event?"
        description="A synced event comes back on the next sync. To keep it off the website, turn off Shown instead."
        isLoading={remove.isPending}
      />
    </div>
  )
}

export default function GdgChapterPage() {
  return (
    <ModuleGuard slug="gdg">
      <PermissionGuard permission="gdg:view">
        <EventsPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
