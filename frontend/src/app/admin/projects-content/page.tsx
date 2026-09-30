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
import { caseStudySchema, type CaseStudyFormData } from './_schemas'

interface CaseStudy {
  id: string
  project_id: string | null
  title: string
  eyebrow: string | null
  tags: string | null
  image: string | null
  description: string | null
  cta_label: string | null
  cta_href: string | null
  link_label: string | null
  link_href: string | null
  order: number
  is_active: boolean
}

function ProjectsContentPageContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CaseStudy | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['project-case-studies', projectId],
    queryFn: () =>
      api
        .get('/projects-content', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: CaseStudy[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CaseStudyFormData>({
    resolver: zodResolver(caseStudySchema),
    defaultValues: { title: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: CaseStudyFormData) =>
      api.post('/projects-content', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-case-studies', projectId] })
      toast({ title: 'Case study created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CaseStudyFormData }) =>
      api.patch(`/projects-content/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-case-studies', projectId] })
      toast({ title: 'Case study updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects-content/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-case-studies', projectId] })
      toast({ title: 'Case study deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      title: '',
      eyebrow: '',
      tags: '',
      image: '',
      description: '',
      cta_label: '',
      cta_href: '',
      link_label: '',
      link_href: '',
      order: data?.items.length ?? 0,
      is_active: true,
    })
    setFormOpen(true)
  }

  function openEdit(item: CaseStudy) {
    setEditing(item)
    reset({
      title: item.title,
      eyebrow: item.eyebrow ?? '',
      tags: item.tags ?? '',
      image: item.image ?? '',
      description: item.description ?? '',
      cta_label: item.cta_label ?? '',
      cta_href: item.cta_href ?? '',
      link_label: item.link_label ?? '',
      link_href: item.link_href ?? '',
      order: item.order,
      is_active: item.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: CaseStudyFormData) {
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

  const columns: ColumnDef<CaseStudy>[] = [
    {
      accessorKey: 'image',
      header: '',
      cell: ({ row }) =>
        row.original.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.image}
            alt={row.original.title}
            className="h-10 w-14 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-14 rounded bg-muted" />
        ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    { accessorKey: 'eyebrow', header: 'Category' },
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
        <PageHeader title="Case Studies" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet to scope case studies to. Create one first, or add{' '}
          <code>?projectId=&lt;id&gt;</code> to the URL directly.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Case Studies"
        breadcrumbs={[{ label: 'Case Studies' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Case Study
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No case studies yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Case Study' : 'New Case Study'}
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
            <FormField label="Title" error={errors.title?.message} required>
              <Input placeholder="e.g. Novotel Visakhapatnam" {...register('title')} />
            </FormField>
            <FormField label="Category / eyebrow" error={errors.eyebrow?.message}>
              <Input placeholder="e.g. 02 · Hotel" {...register('eyebrow')} />
            </FormField>
          </div>
          <FormField label="Tags" hint="Comma-separated." error={errors.tags?.message}>
            <Input placeholder="Central AC, Fire & Life Safety" {...register('tags')} />
          </FormField>
          <FormField label="Image URL" error={errors.image?.message}>
            <Input placeholder="/seed/subhadra/case-studies/novotel.jpg" {...register('image')} />
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="mt-2 h-24 w-36 rounded object-cover" />
            )}
          </FormField>
          <FormField label="Description" error={errors.description?.message}>
            <Textarea rows={4} {...register('description')} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="CTA label" error={errors.cta_label?.message}>
              <Input placeholder="Get a Similar Quote →" {...register('cta_label')} />
            </FormField>
            <FormField label="CTA href" error={errors.cta_href?.message}>
              <Input placeholder="#quote" {...register('cta_href')} />
            </FormField>
            <FormField label="Read-more label" error={errors.link_label?.message}>
              <Input placeholder="Read the full project scope →" {...register('link_label')} />
            </FormField>
            <FormField label="Read-more href" error={errors.link_href?.message}>
              <Input placeholder="#hotel" {...register('link_href')} />
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
        title="Delete case study?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function ProjectsContentPage() {
  return (
    <ModuleGuard slug="projects-content">
      <PermissionGuard permission="projects-content:view">
        <ProjectsContentPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
