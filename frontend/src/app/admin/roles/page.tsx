'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/hooks/usePagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import type { RbacRole } from '@/types/models.types'
import { RoleFormDialog } from './_components/RoleFormDialog'

export default function RolesPage() {
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRole, setEditRole] = useState<RbacRole | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['roles', page],
    queryFn: () =>
      api
        .get('/roles', { params: { page, limit: 20 } })
        .then(
          (r) =>
            r.data.data as {
              roles: RbacRole[]
              pagination: { total: number; pages: number }
            }
        ),
  })

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string; permission_ids: string[] }) =>
      api.post('/roles', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast({ title: 'Role created' })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { name: string; description?: string; permission_ids: string[] }
    }) => api.patch(`/roles/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast({ title: 'Role updated' })
      setEditRole(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast({ title: 'Role deleted' })
      setDeleteId(null)
    },
  })

  const { data: editRoleDetail } = useQuery({
    queryKey: ['role', editRole?.id],
    queryFn: () =>
      api.get(`/roles/${editRole!.id}`).then((r) => r.data.data.role as RbacRole),
    enabled: !!editRole?.id,
  })

  const columns: ColumnDef<RbacRole>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.slug}</div>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.description ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'user_count',
      header: 'Users',
      cell: ({ row }) => row.original.user_count ?? 0,
    },
    {
      accessorKey: 'permission_count',
      header: 'Permissions',
      cell: ({ row }) => row.original.permission_count ?? 0,
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
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditRole(row.original)}
            aria-label={`Edit ${row.original.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            disabled={row.original.is_system}
            aria-label={`Delete ${row.original.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const deletingRole = data?.roles.find((r) => r.id === deleteId)

  return (
    <div>
      <PageHeader
        title="Roles"
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create role
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.roles ?? []}
        isLoading={isLoading}
        pagination={
          data
            ? { page, totalPages: data.pagination.pages, onPageChange: setPage }
            : undefined
        }
        emptyMessage="No roles found."
      />

      <RoleFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(formData) => createMutation.mutate(formData)}
        isPending={createMutation.isPending}
        error={createMutation.error}
        role={null}
      />

      <RoleFormDialog
        open={!!editRole}
        onClose={() => setEditRole(null)}
        onSubmit={(formData) =>
          updateMutation.mutate({ id: editRole!.id, body: formData })
        }
        isPending={updateMutation.isPending}
        error={updateMutation.error}
        role={editRoleDetail ?? editRole}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={`Delete "${deletingRole?.name}"?`}
        description={
          (deletingRole?.user_count ?? 0) > 0
            ? `This role has ${deletingRole?.user_count} user(s) assigned. Remove the role assignments first.`
            : 'This action cannot be undone.'
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
