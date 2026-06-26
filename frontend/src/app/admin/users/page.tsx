'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Search } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { User, Role } from '@/types/models.types'
import { updateUserSchema, type UpdateUserFormData } from './_schemas'

export default function UsersPage() {
  const { isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch, roleFilter],
    queryFn: () =>
      api
        .get('/users', {
          params: {
            page,
            limit: 10,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined,
          },
        })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number; pages: number } }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserFormData }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User updated' })
      setEditUser(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User deleted' })
      setDeleteId(null)
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateUserFormData>({ resolver: zodResolver(updateUserSchema) })

  function openEdit(user: User) {
    setEditUser(user)
    reset({
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    })
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.role.toLowerCase() as 'user' | 'admin' | 'super_admin'}
        />
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.original.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
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

  const isActive = watch('is_active')
  const roleValue = watch('role')

  return (
    <div>
      <PageHeader title="Users" />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | '')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All roles</SelectItem>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.users ?? []}
        isLoading={isLoading}
        pagination={
          data
            ? {
                page,
                totalPages: data.pagination.pages,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title="Edit User"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit((formData) =>
                updateMutation.mutate({ id: editUser!.id, data: formData })
              )}
              disabled={updateMutation.isPending}
            >
              Save changes
            </Button>
          </div>
        }
      >
        <form className="space-y-4">
          <FormField label="Name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Email" error={errors.email?.message} required>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Role" error={errors.role?.message} required>
            <Select
              value={roleValue}
              onValueChange={(v) => setValue('role', v as Role, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                {isSuperAdmin && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Active">
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={(v) => setValue('is_active', v)}
              />
              <span className="text-sm text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </FormField>
          {updateMutation.error && <ErrorAlert error={updateMutation.error} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={`Delete user?`}
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
