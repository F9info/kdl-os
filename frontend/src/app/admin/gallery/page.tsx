'use client'

import { useState } from 'react'
import { useDefaultProjectId } from '@/admin/hooks/useDefaultProjectId'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { OrderStatusFields } from '@/admin/components/shared/OrderStatusFields'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { gallerySchema, type GalleryFormData } from './_schemas'

interface GalleryItem {
  id: string
  project_id: string | null
  title: string
  image_url: string
  caption: string | null
  order: number
  is_active: boolean
}

function GalleryPageContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GalleryItem | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['gallery-items', projectId],
    queryFn: () =>
      api
        .get('/gallery', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: GalleryItem[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GalleryFormData>({
    resolver: zodResolver(gallerySchema),
    defaultValues: { title: '', image_url: '', caption: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: GalleryFormData) =>
      api.post('/gallery', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-items', projectId] })
      toast({ title: 'Image added' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GalleryFormData }) =>
      api.patch(`/gallery/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-items', projectId] })
      toast({ title: 'Image updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-items', projectId] })
      toast({ title: 'Image deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      title: '',
      image_url: '',
      caption: '',
      order: data?.items.length ?? 0,
      is_active: true,
    })
    setFormOpen(true)
  }

  function openEdit(entry: GalleryItem) {
    setEditing(entry)
    reset({
      title: entry.title,
      image_url: entry.image_url,
      caption: entry.caption ?? '',
      order: entry.order,
      is_active: entry.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: GalleryFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isActive = watch('is_active')

  const columns: ColumnDef<GalleryItem>[] = [
    {
      id: 'preview',
      header: 'Image',
      cell: ({ row }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.original.image_url}
          alt={row.original.title}
          className="h-12 w-16 rounded object-cover"
        />
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: 'caption',
      header: 'Caption',
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">
          {row.original.caption}
        </span>
      ),
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
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

  if (projectResolving) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!projectId) {
    return (
      <div>
        <PageHeader title="Gallery" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet to scope images to. Create one first, or add{' '}
          <code>?projectId=&lt;id&gt;</code> to the URL directly.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Gallery"
        breadcrumbs={[{ label: 'Gallery' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add image
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No images yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit image' : 'Add image'}
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
          <FormField label="Title" error={errors.title?.message} required>
            <Input placeholder="e.g. Our office" {...register('title')} />
          </FormField>
          <FormField label="Image address (URL)" error={errors.image_url?.message} required>
            <Input placeholder="https://… or /uploads/…" {...register('image_url')} />
          </FormField>
          <FormField label="Caption" error={errors.caption?.message}>
            <Textarea rows={2} {...register('caption')} />
          </FormField>
          <OrderStatusFields
            register={register}
            setValue={setValue}
            isActive={isActive}
            orderError={errors.order?.message}
          />
          {formError && <ErrorAlert error={formError} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete image?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function GalleryPage() {
  return (
    <ModuleGuard slug="gallery">
      <PermissionGuard permission="gallery:view">
        <GalleryPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
