'use client'

import { useState } from 'react'
import { notFound, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, ExternalLink, Pencil } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { fetchDetailPageTypes } from '@/lib/detail-page-types'
import { toast } from '@/hooks/use-toast'
import { useDefaultProjectId } from '@/hooks/useDefaultProjectId'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BuilderPageRow {
  id: string
  slug: string
  title: string
  status: 'DRAFT' | 'PUBLISHED'
  updated_at: string
  project_id: string | null
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// "/admin/service-detail" — every page of a nav type titled "<Something> Detail" (the pages behind
// the "Layout Service Detail" pill's numbered badge in Layout settings), each editable in the
// section builder. The type is recognised by slugified title, so no per-type route is needed.
function DetailTypePagesContent({ typeSlug }: { typeSlug: string }) {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['builder-pages'],
    queryFn: () => api.get('/page-builder').then((r) => r.data.data.items as BuilderPageRow[]),
  })

  const all = data ?? []
  const pages = all
    .filter((p) => slugify(p.title) === typeSlug && (!projectId || p.project_id === projectId))
    .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }))
  const label =
    pages[0]?.title ?? typeSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const editHref = (id: string) => `/admin/template-engine/edit/${id}?projectId=${projectId ?? ''}`
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['builder-pages'] })

  // New page = a copy of the first page's sections, so it starts with the same layout.
  const addMutation = useMutation({
    mutationFn: async () => {
      const source = pages[0]
      if (!source) throw new Error('No page to copy')
      const full = await api.get(`/page-builder/${source.id}`).then((r) => r.data.data)
      const taken = new Set(all.map((p) => p.slug))
      let n = pages.length + 1
      while (taken.has(`page-${typeSlug}-${n}`)) n++
      return api.post('/page-builder', {
        title: source.title,
        slug: `page-${typeSlug}-${n}`,
        data: full.data,
        project_id: projectId,
      })
    },
    onSuccess: () => {
      invalidate()
      toast({ title: `${label} page added` })
    },
    onError: () => toast({ title: 'Could not add page', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/page-builder/${id}`),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Page deleted' })
      setDeleteId(null)
    },
  })

  const columns: ColumnDef<BuilderPageRow>[] = [
    {
      accessorKey: 'title',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">/{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.status === 'PUBLISHED' ? 'active' : 'pending'}
          label={row.original.status === 'PUBLISHED' ? 'Published' : 'Draft'}
        />
      ),
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: ({ row }) =>
        new Date(row.original.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Edit in section builder"
            aria-label={`Edit ${row.original.slug}`}
          >
            <a href={editHref(row.original.id)}>
              <Pencil className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="View live"
            aria-label={`View ${row.original.slug}`}
          >
            <a href={`/p/${row.original.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.slug}`}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (projectResolving) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

  return (
    <div>
      <PageHeader
        title={label}
        breadcrumbs={[{ label }]}
        action={
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!pages.length || addMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            Add new
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={pages}
        isLoading={isLoading}
        emptyMessage={`No ${label} pages yet.`}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete page"
        description="This page will be removed from the site and its menus."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

interface DetailTypeInfo {
  typeKey: string
  label: string
}
interface EntryRow {
  id: string
  title: string
  slug: string
  is_active: boolean
  detail_page_id: string | null
  public_path: string
  updated_at: string
}

// DB-defined detail type (see backend detail-page-types): every entry is a page bound to the
// type's ONE shared layout. Add = new entry on that layout; Edit opens the section builder;
// the pencil-in-row dialog edits title/slug; delete removes the entry and its page.
function DetailEntriesContent({ type, projectId }: { type: DetailTypeInfo; projectId: string }) {
  const queryClient = useQueryClient()
  const key = ['detail-entries', projectId, type.typeKey]
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<{ id?: string; title: string; slug: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      api
        .get(`/detail-page-types/${type.typeKey}/entries`, { params: { project_id: projectId } })
        .then((r) => r.data.data.items as EntryRow[]),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['detail-page-types', projectId] })
  }
  const onError = (e: unknown) =>
    toast({
      title:
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Request failed',
      variant: 'destructive',
    })

  const saveMutation = useMutation({
    mutationFn: async (f: { id?: string; title: string; slug: string }) =>
      f.id
        ? await api.patch(`/detail-page-types/entries/${f.id}`, {
            project_id: projectId,
            title: f.title,
            slug: f.slug,
          })
        : await api.post(`/detail-page-types/${type.typeKey}/entries`, {
            project_id: projectId,
            title: f.title,
            ...(f.slug ? { slug: f.slug } : {}),
          }),
    onSuccess: () => {
      invalidate()
      setForm(null)
      toast({ title: 'Saved' })
    },
    onError,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/detail-page-types/entries/${id}`, { params: { project_id: projectId } }),
    onSuccess: () => {
      invalidate()
      setDeleteId(null)
      toast({ title: 'Page deleted' })
    },
    onError,
  })

  const columns: ColumnDef<EntryRow>[] = [
    {
      accessorKey: 'title',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.public_path}</p>
        </div>
      ),
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <button
          type="button"
          className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs hover:bg-muted"
          title="Edit title / slug"
          onClick={() =>
            setForm({ id: row.original.id, title: row.original.title, slug: row.original.slug })
          }
        >
          {row.original.slug}
        </button>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.is_active ? 'active' : 'pending'}
          label={row.original.is_active ? 'Published' : 'Hidden'}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.detail_page_id ? (
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Edit content in section builder"
              aria-label={`Edit ${row.original.slug}`}
            >
              <a
                href={`/admin/template-engine/edit/${row.original.detail_page_id}?projectId=${projectId}`}
              >
                <Pencil className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setForm({ id: row.original.id, title: row.original.title, slug: row.original.slug })
            }
          >
            Rename
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="View live"
            aria-label={`View ${row.original.slug}`}
          >
            <a href={row.original.public_path} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.slug}`}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={type.label}
        breadcrumbs={[{ label: type.label }]}
        action={
          <Button onClick={() => setForm({ title: '', slug: '' })}>
            <Plus className="h-4 w-4" />
            Add new
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        emptyMessage={`No ${type.label} pages yet.`}
      />
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit title / slug' : `New ${type.label} page`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title"
              value={form?.title ?? ''}
              onChange={(e) => setForm((f) => f && { ...f, title: e.target.value })}
            />
            <Input
              placeholder="slug (auto from title if empty)"
              value={form?.slug ?? ''}
              onChange={(e) => setForm((f) => f && { ...f, slug: slugify(e.target.value) })}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!form?.title.trim() || (!!form?.id && !form.slug) || saveMutation.isPending}
              onClick={() => form && saveMutation.mutate(form)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete page"
        description="This page will be removed from the site and its menus."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// Picks the right view for "/admin/<x>-detail": a DB detail type if one has this label,
// otherwise the legacy nav-page table.
function DetailTypeRouter({ typeSlug }: { typeSlug: string }) {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const { data: types, isLoading } = useQuery({
    queryKey: ['detail-page-types', projectId],
    queryFn: () => fetchDetailPageTypes<DetailTypeInfo>(projectId!),
    enabled: !!projectId,
  })
  if (projectResolving || (projectId && isLoading))
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  const type = types?.find((t) => slugify(t.label) === typeSlug)
  if (type && projectId) return <DetailEntriesContent type={type} projectId={projectId} />
  return <DetailTypePagesContent typeSlug={typeSlug} />
}

export default function DetailTypePage() {
  const { detailType } = useParams<{ detailType: string }>()
  if (!detailType.endsWith('-detail')) notFound()
  return (
    <ModuleGuard slug="page-builder">
      <PermissionGuard permission="page-builder:view">
        <DetailTypeRouter typeSlug={detailType} />
      </PermissionGuard>
    </ModuleGuard>
  )
}
