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
import { faqSchema, type FaqFormData } from './_schemas'

interface FaqEntry {
  id: string
  project_id: string | null
  question: string
  answer: string
  order: number
  is_active: boolean
}

function FaqPageContent() {
  const projectId = useSearchParams().get('projectId')
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FaqEntry | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['faq-entries', projectId],
    queryFn: () =>
      api
        .get('/faq', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: FaqEntry[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FaqFormData>({
    resolver: zodResolver(faqSchema),
    defaultValues: { question: '', answer: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: FaqFormData) => api.post('/faq', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-entries', projectId] })
      toast({ title: 'FAQ created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FaqFormData }) =>
      api.patch(`/faq/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-entries', projectId] })
      toast({ title: 'FAQ updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/faq/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-entries', projectId] })
      toast({ title: 'FAQ deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ question: '', answer: '', order: data?.items.length ?? 0, is_active: true })
    setFormOpen(true)
  }

  function openEdit(entry: FaqEntry) {
    setEditing(entry)
    reset({
      question: entry.question,
      answer: entry.answer,
      order: entry.order,
      is_active: entry.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: FaqFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isActive = watch('is_active')

  const columns: ColumnDef<FaqEntry>[] = [
    {
      accessorKey: 'question',
      header: 'Question',
      cell: ({ row }) => <span className="font-medium">{row.original.question}</span>,
    },
    {
      accessorKey: 'answer',
      header: 'Answer',
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">
          {row.original.answer}
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
            aria-label={`Edit ${row.original.question}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.question}`}
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
        <PageHeader title="FAQ" />
        <p className="mt-4 text-sm text-muted-foreground">
          Add <code>?projectId=&lt;id&gt;</code> to the URL to manage that project&apos;s FAQs —
          scoped per project, same as Team and Brand Kit.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="FAQ"
        breadcrumbs={[{ label: 'FAQ' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New FAQ
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No FAQs yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit FAQ' : 'New FAQ'}
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
          <FormField label="Question" error={errors.question?.message} required>
            <Input placeholder="e.g. How fast can I get a quote?" {...register('question')} />
          </FormField>
          <FormField label="Answer" error={errors.answer?.message} required>
            <Textarea rows={4} {...register('answer')} />
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
        title="Delete FAQ?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function FaqPage() {
  return (
    <ModuleGuard slug="faq">
      <PermissionGuard permission="faq:view">
        <FaqPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
