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
import { teamMemberSchema, type TeamMemberFormData } from './_schemas'

interface TeamMember {
  id: string
  project_id: string | null
  name: string
  role: string
  bio: string | null
  photo_url: string | null
  order: number
  is_active: boolean
  created_at: string
}

function TeamPageContent() {
  const projectId = useSearchParams().get('projectId')
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['team-members', projectId],
    queryFn: () =>
      api
        .get('/team', { params: { project_id: projectId ?? undefined } })
        .then((r) => r.data.data as { items: TeamMember[] }),
    enabled: Boolean(projectId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: { name: '', role: '', bio: '', photo_url: '', order: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: TeamMemberFormData) =>
      api.post('/team', { ...payload, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', projectId] })
      toast({ title: 'Team member created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TeamMemberFormData }) =>
      api.patch(`/team/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', projectId] })
      toast({ title: 'Team member updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', projectId] })
      toast({ title: 'Team member deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      name: '',
      role: '',
      bio: '',
      photo_url: '',
      order: data?.items.length ?? 0,
      is_active: true,
    })
    setFormOpen(true)
  }

  function openEdit(member: TeamMember) {
    setEditing(member)
    reset({
      name: member.name,
      role: member.role,
      bio: member.bio ?? '',
      photo_url: member.photo_url ?? '',
      order: member.order,
      is_active: member.is_active,
    })
    setFormOpen(true)
  }

  function onSubmit(formData: TeamMemberFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isActive = watch('is_active')
  const photoUrl = watch('photo_url')

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'photo_url',
      header: '',
      cell: ({ row }) =>
        row.original.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.photo_url}
            alt={row.original.name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted" />
        ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: 'role', header: 'Role' },
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
        <PageHeader title="Team" />
        <p className="mt-4 text-sm text-muted-foreground">
          Add <code>?projectId=&lt;id&gt;</code> to the URL to manage that project&apos;s team —
          team members are scoped per project, same as Brand Kit and Website Layout.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Team"
        breadcrumbs={[{ label: 'Team' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Team Member
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No team members yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Team Member' : 'New Team Member'}
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
              <Input placeholder="e.g. K Leela Prasad" {...register('name')} />
            </FormField>
            <FormField label="Role" error={errors.role?.message} required>
              <Input placeholder="e.g. Founder" {...register('role')} />
            </FormField>
          </div>
          <FormField label="Bio" error={errors.bio?.message}>
            <Textarea rows={3} {...register('bio')} />
          </FormField>
          <FormField
            label="Photo URL"
            error={errors.photo_url?.message}
            hint="Paste a URL or path."
          >
            <Input placeholder="/seed/subhadra/founder.png" {...register('photo_url')} />
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />
            )}
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
        title="Delete team member?"
        description="This action cannot be undone. Any page-builder blocks referencing this member will fall back to their own static content."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default function TeamPage() {
  return (
    <ModuleGuard slug="team">
      <PermissionGuard permission="team:view">
        <TeamPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
