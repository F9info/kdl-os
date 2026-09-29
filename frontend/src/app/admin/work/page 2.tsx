'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefaultProjectId } from '@/hooks/useDefaultProjectId'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Settings, Trash2, Plus, ExternalLink, FileEdit } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { workSchema, type WorkFormData } from './_schemas'

interface WorkCategory {
  id: string
  project_id: string | null
  eyebrow: string | null
  name: string
  slug: string
  subtitle: string | null
  image: string | null
  detail_page_id: string | null
  order: number
  is_active: boolean
}

function WorkPageContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WorkCategory | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['work', projectId],
    queryFn: () =>
      api
        .get('/work', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: WorkCategory[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WorkFormData>({
    resolver: zodResolver(workSchema),
    defaultValues: { name: '', slug: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: WorkFormData) => api.post('/work', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', projectId] })
      queryClient.invalidateQueries({ queryKey: ['detail-page-types', projectId] })
      toast({ title: 'Work category created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WorkFormData }) =>
      api.patch(`/work/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', projectId] })
      queryClient.invalidateQueries({ queryKey: ['detail-page-types', projectId] })
      toast({ title: 'Work category updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/work/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work', projectId] })
      queryClient.invalidateQueries({ queryKey: ['detail-page-types', projectId] })
      toast({ title: 'Work category deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      eyebrow: '',
      name: '',
      slug: '',
      subtitle: '',
      image: '',
      order: data?.items.length ?? 0,
      is_active: true,
    })
    setFormOpen(true)
  }

  function openEdit(item: WorkCategory) {
    setEditing(item)
    reset({
      eyebrow: item.eyebrow ?? '',
      name: item.name,
      slug: item.slug,
      subtitle: item.subtitle ?? '',
      image: item.image ?? '',
      order: item.order,
      is_active: item.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: WorkFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isActive = watch('is_active')
  const imageUrl = watch('image')

  const columns: ColumnDef<WorkCategory>[] = [
    {
      accessorKey: 'image',
      header: '',
      cell: ({ row }) =>
        row.original.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.image}
            alt={row.original.name}
            className="h-10 w-14 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-14 rounded bg-muted" />
        ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: 'order', header: 'Order' },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <StatusBadge variant={row.original.is_active ? 'active' : 'inactive'} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.detail_page_id ? (
            <Button size="sm" asChild>
              <a
                href={`/admin/template-engine/edit/${row.original.detail_page_id}?projectId=${projectId ?? ''}`}
              >
                <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                Edit page
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">No page linked</span>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={`${row.original.name} settings (name, slug, subtitle)`}
            title="Settings — name, slug, subtitle, image"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label={`View ${row.original.name} live`}
            title="View live"
          >
            <a
              href={`/work/${row.original.slug}?projectId=${projectId ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (projectResolving) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!projectId) {
    return (
      <div>
        <PageHeader title="Work" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet to scope Work categories to. Create one first, or add{' '}
          <code>?projectId=&lt;id&gt;</code> to the URL directly.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Work"
        breadcrumbs={[{ label: 'Work' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Work Category
          </Button>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Edit page</strong> opens the category&apos;s detail page
        in the full section editor — add/remove/reorder sections, pick each section&apos;s design,
        and edit its content, same editor every other page uses.{' '}
        <strong className="text-foreground">Settings</strong> (gear icon) is only for this
        category&apos;s own name, slug, subtitle and image.
      </p>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No Work categories yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Work Category' : 'New Work Category'}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" error={errors.name?.message} required>
              <Input placeholder="e.g. Central AC" {...register('name')} />
            </FormField>
            <FormField
              label="Slug"
              hint="Used in the public /work/{slug} URL."
              error={errors.slug?.message}
              required
            >
              <Input placeholder="e.g. central-ac" {...register('slug')} />
            </FormField>
          </div>
          <FormField label="Eyebrow" error={errors.eyebrow?.message}>
            <Input placeholder="e.g. Central AC" {...register('eyebrow')} />
          </FormField>
          <FormField
            label="Image URL"
            hint="A stock or Unsplash URL is fine if no local asset exists yet."
            error={errors.image?.message}
          >
            <Input placeholder="/seed/subhadra/..." {...register('image')} />
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="mt-2 h-24 w-36 rounded object-cover" />
            )}
          </FormField>
          <FormField label="Subtitle" error={errors.subtitle?.message}>
            <Textarea rows={4} {...register('subtitle')} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Order" error={errors.order?.message}>
              <Input type="number" {...register('order', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Status">
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
                <span className="text-sm text-muted-foreground">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </FormField>
          </div>
          {formError && <ErrorAlert error={formError} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Work category?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function WorkPage() {
  return (
    <ModuleGuard slug="work">
      <PermissionGuard permission="work:view">
        <WorkPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
