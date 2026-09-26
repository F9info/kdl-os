'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Plus } from 'lucide-react'
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
import { sectorSchema, type SectorFormData } from './_schemas'

interface Sector {
  id: string
  project_id: string | null
  eyebrow: string | null
  name: string
  slug: string
  category: string | null
  description: string | null
  image: string | null
  cta_label: string | null
  cta_href: string | null
  order: number
  is_active: boolean
}

function SectorsPageContent() {
  const projectId = useSearchParams().get('projectId')
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Sector | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sectors', projectId],
    queryFn: () =>
      api
        .get('/sectors', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: Sector[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SectorFormData>({
    resolver: zodResolver(sectorSchema),
    defaultValues: { name: '', slug: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: SectorFormData) =>
      api.post('/sectors', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors', projectId] })
      toast({ title: 'Sector created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SectorFormData }) =>
      api.patch(`/sectors/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors', projectId] })
      toast({ title: 'Sector updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sectors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors', projectId] })
      toast({ title: 'Sector deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      eyebrow: '',
      name: '',
      slug: '',
      category: '',
      description: '',
      image: '',
      cta_label: 'Read more →',
      cta_href: '#',
      order: data?.items.length ?? 0,
      is_active: true,
    })
    setFormOpen(true)
  }

  function openEdit(item: Sector) {
    setEditing(item)
    reset({
      eyebrow: item.eyebrow ?? '',
      name: item.name,
      slug: item.slug,
      category: item.category ?? '',
      description: item.description ?? '',
      image: item.image ?? '',
      cta_label: item.cta_label ?? '',
      cta_href: item.cta_href ?? '',
      order: item.order,
      is_active: item.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: SectorFormData) {
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

  const columns: ColumnDef<Sector>[] = [
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
    { accessorKey: 'category', header: 'Category' },
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
            aria-label={`Edit ${row.original.name}`}
          >
            <Pencil className="h-4 w-4" />
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

  if (!projectId) {
    return (
      <div>
        <PageHeader title="Sectors" />
        <p className="mt-4 text-sm text-muted-foreground">
          Add <code>?projectId=&lt;id&gt;</code> to the URL to manage that project&apos;s sectors —
          scoped per project, same as Team, FAQ and Case Studies.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Sectors"
        breadcrumbs={[{ label: 'Sectors' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Sector
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No sectors yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Sector' : 'New Sector'}
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
              <Input placeholder="e.g. Hotel" {...register('name')} />
            </FormField>
            <FormField
              label="Slug"
              hint="Used as the section's anchor id and jump-pill link."
              error={errors.slug?.message}
              required
            >
              <Input placeholder="e.g. hotel" {...register('slug')} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Eyebrow" error={errors.eyebrow?.message}>
              <Input placeholder="e.g. 02 · Hospitality" {...register('eyebrow')} />
            </FormField>
            <FormField label="Category" error={errors.category?.message}>
              <Input placeholder="e.g. Hospitality" {...register('category')} />
            </FormField>
          </div>
          <FormField
            label="Image URL"
            hint="A stock or Unsplash URL is fine if no local asset exists yet."
            error={errors.image?.message}
          >
            <Input placeholder="/seed/subhadra/sectors/hotel.jpg" {...register('image')} />
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="mt-2 h-24 w-36 rounded object-cover" />
            )}
          </FormField>
          <FormField
            label="Description"
            hint="Two paragraphs, separated by a blank line."
            error={errors.description?.message}
          >
            <Textarea rows={6} {...register('description')} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="CTA label" error={errors.cta_label?.message}>
              <Input placeholder="Read more →" {...register('cta_label')} />
            </FormField>
            <FormField label="CTA href" error={errors.cta_href?.message}>
              <Input placeholder="#" {...register('cta_href')} />
            </FormField>
          </div>
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
        title="Delete sector?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function SectorsPage() {
  return (
    <ModuleGuard slug="sectors">
      <PermissionGuard permission="sectors:view">
        <SectorsPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
