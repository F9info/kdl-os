'use client'

import { useState } from 'react'
import { useDefaultProjectId } from '@/hooks/useDefaultProjectId'
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
import { testimonialSchema, type TestimonialFormData } from './_schemas'

interface Testimonial {
  id: string
  project_id: string | null
  name: string
  role: string | null
  quote: string
  order: number
  is_active: boolean
}

function TestimonialsPageContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Testimonial | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['testimonials', projectId],
    queryFn: () =>
      api
        .get('/testimonials', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: Testimonial[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TestimonialFormData>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: { name: '', role: '', quote: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: TestimonialFormData) =>
      api.post('/testimonials', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', projectId] })
      toast({ title: 'Testimonial added' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TestimonialFormData }) =>
      api.patch(`/testimonials/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', projectId] })
      toast({ title: 'Testimonial updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/testimonials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', projectId] })
      toast({ title: 'Testimonial deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      name: '',
      role: '',
      quote: '',
      order: data?.items.length ?? 0,
      is_active: true,
    })
    setFormOpen(true)
  }

  function openEdit(entry: Testimonial) {
    setEditing(entry)
    reset({
      name: entry.name,
      role: entry.role ?? '',
      quote: entry.quote,
      order: entry.order,
      is_active: entry.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: TestimonialFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isActive = watch('is_active')

  const columns: ColumnDef<Testimonial>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'quote',
      header: 'Quote',
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">
          {row.original.quote}
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

  if (projectResolving) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!projectId) {
    return (
      <div>
        <PageHeader title="Testimonials" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet to scope testimonials to. Create one first, or add{' '}
          <code>?projectId=&lt;id&gt;</code> to the URL directly.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Testimonials"
        breadcrumbs={[{ label: 'Testimonials' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add testimonial
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No testimonials yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit testimonial' : 'Add testimonial'}
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
          <FormField label="Name" error={errors.name?.message} required>
            <Input placeholder="e.g. Priya S." {...register('name')} />
          </FormField>
          <FormField label="Role" error={errors.role?.message}>
            <Input placeholder="e.g. Customer" {...register('role')} />
          </FormField>
          <FormField label="Quote" error={errors.quote?.message} required>
            <Textarea rows={4} {...register('quote')} />
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
        title="Delete testimonial?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function TestimonialsPage() {
  return (
    <ModuleGuard slug="testimonials">
      <PermissionGuard permission="testimonials:view">
        <TestimonialsPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
