'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PermissionModuleMatrix } from '@/types/models.types'

const moduleSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  label: z.string().min(2).max(100),
})

type ModuleFormData = z.infer<typeof moduleSchema>

export default function PermissionsPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editModule, setEditModule] = useState<PermissionModuleMatrix | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: matrix, isLoading } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () =>
      api.get('/permissions/matrix').then((r) => r.data.data.matrix as PermissionModuleMatrix[]),
  })

  const createMutation = useMutation({
    mutationFn: (body: ModuleFormData) => api.post('/permissions/modules', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions-matrix'] })
      toast({ title: 'Module created with 5 permissions' })
      setCreateOpen(false)
      createForm.reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ModuleFormData> }) =>
      api.patch(`/permissions/modules/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions-matrix'] })
      toast({ title: 'Module updated' })
      setEditModule(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/permissions/modules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions-matrix'] })
      toast({ title: 'Module deleted' })
      setDeleteId(null)
    },
  })

  const createForm = useForm<ModuleFormData>({ resolver: zodResolver(moduleSchema) })
  const editForm = useForm<ModuleFormData>({ resolver: zodResolver(moduleSchema) })

  function openEdit(module: PermissionModuleMatrix) {
    setEditModule(module)
    editForm.reset({ name: module.name, label: module.label })
  }

  const columns: ColumnDef<PermissionModuleMatrix>[] = [
    {
      accessorKey: 'label',
      header: 'Module',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.label}</div>
          <div className="text-xs text-muted-foreground font-mono">{row.original.name}</div>
        </div>
      ),
    },
    {
      id: 'actions_count',
      header: 'Permissions',
      cell: ({ row }) => {
        const count = Object.values(row.original.actions).filter(Boolean).length
        return <span className="text-sm">{count} / 5</span>
      },
    },
    {
      id: 'system',
      header: 'Type',
      cell: ({ row }) =>
        row.original.is_system ? (
          <StatusBadge variant="system" label="System" />
        ) : (
          <StatusBadge variant="active" label="Custom" />
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
            onClick={() => openEdit(row.original)}
            aria-label={`Edit ${row.original.label}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            disabled={row.original.is_system}
            aria-label={`Delete ${row.original.label}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const deletingModule = matrix?.find((m) => m.id === deleteId)

  return (
    <PermissionGuard permission="permissions:view">
      <div>
        <PageHeader
          title="Permissions"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add module
            </Button>
          }
        />

        <p className="text-sm text-muted-foreground mb-6">
          Each module auto-creates 5 permissions: view, add, edit, delete, publish.
        </p>

        <DataTable
          columns={columns}
          data={matrix ?? []}
          isLoading={isLoading}
          emptyMessage="No permission modules defined."
        />

        {/* Create module dialog */}
        <Modal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false)
            createForm.reset()
          }}
          title="Add Permission Module"
          footer={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false)
                  createForm.reset()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={createForm.handleSubmit((data) => createMutation.mutate(data))}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <LoadingSpinner size="sm" />}
                Create module
              </Button>
            </div>
          }
        >
          <form className="space-y-4">
            <FormField
              label="Name (slug)"
              error={createForm.formState.errors.name?.message}
              required
              hint="Lowercase, hyphens only. e.g. blog-posts"
            >
              <Input {...createForm.register('name')} placeholder="e.g. blog-posts" />
            </FormField>
            <FormField
              label="Label"
              error={createForm.formState.errors.label?.message}
              required
              hint="Human-readable name shown in the UI"
            >
              <Input {...createForm.register('label')} placeholder="e.g. Blog Posts" />
            </FormField>
            {createMutation.error && <ErrorAlert error={createMutation.error} />}
          </form>
        </Modal>

        {/* Edit module dialog */}
        <Modal
          open={!!editModule}
          onClose={() => setEditModule(null)}
          title="Edit Permission Module"
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditModule(null)}>
                Cancel
              </Button>
              <Button
                onClick={editForm.handleSubmit((data) =>
                  updateMutation.mutate({ id: editModule!.id, body: data })
                )}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <LoadingSpinner size="sm" />}
                Save changes
              </Button>
            </div>
          }
        >
          <form className="space-y-4">
            <FormField label="Name (slug)" error={editForm.formState.errors.name?.message} required>
              <Input {...editForm.register('name')} disabled={editModule?.is_system} />
              {editModule?.is_system && (
                <p className="text-xs text-muted-foreground">
                  System module names cannot be changed.
                </p>
              )}
            </FormField>
            <FormField label="Label" error={editForm.formState.errors.label?.message} required>
              <Input {...editForm.register('label')} />
            </FormField>
            {updateMutation.error && <ErrorAlert error={updateMutation.error} />}
          </form>
        </Modal>

        <ConfirmDialog
          open={deleteId !== null}
          onClose={() => setDeleteId(null)}
          onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
          title={`Delete module "${deletingModule?.label}"?`}
          description="This will delete the module and all 5 of its permissions. Roles and users referencing these permissions must have them removed first."
          isLoading={deleteMutation.isPending}
        />
      </div>
    </PermissionGuard>
  )
}
