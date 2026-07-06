'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Search, KeyRound, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { PermissionMatrix } from '@/components/shared/PermissionMatrix'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
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
import { cn } from '@/lib/utils'
import type { User, UserStatus, RbacRole, PermissionModuleMatrix, OverrideMode, UserPermissionOverride } from '@/types/models.types'
import {
  createUserSchema,
  type CreateUserFormData,
  updateUserSchema,
  type UpdateUserFormData,
  resetPasswordSchema,
  type ResetPasswordFormData,
} from './_schemas'

type EditTab = 'details' | 'overrides'

interface OverrideState {
  [permissionId: string]: OverrideMode | null
}

export default function UsersPage() {
  const { isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [editTab, setEditTab] = useState<EditTab>('details')
  const [overrides, setOverrides] = useState<OverrideState>({})
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch, statusFilter],
    queryFn: () =>
      api
        .get('/users', {
          params: {
            page,
            limit: 10,
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
          },
        })
        .then(
          (r) =>
            r.data.data as {
              users: User[]
              pagination: { total: number; pages: number }
            }
        ),
  })

  const { data: roles } = useQuery({
    queryKey: ['roles-all'],
    queryFn: () =>
      api.get('/roles', { params: { limit: 100 } }).then((r) => r.data.data.roles as RbacRole[]),
  })

  const { data: matrix } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () =>
      api.get('/permissions/matrix').then((r) => r.data.data.matrix as PermissionModuleMatrix[]),
    enabled: editTab === 'overrides' && !!editUser,
  })

  const { data: existingOverrides } = useQuery({
    queryKey: ['user-overrides', editUser?.id],
    queryFn: () =>
      api.get(`/users/${editUser!.id}/overrides`).then(
        (r) => r.data.data.overrides as UserPermissionOverride[]
      ),
    enabled: editTab === 'overrides' && !!editUser,
  })

  const createMutation = useMutation({
    mutationFn: (data: Omit<CreateUserFormData, 'confirm_password'>) =>
      api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User created' })
      setCreateOpen(false)
      createForm.reset()
    },
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

  const overridesMutation = useMutation({
    mutationFn: ({
      id,
      overrideList,
    }: {
      id: string
      overrideList: { permission_id: string; mode: OverrideMode }[]
    }) => api.put(`/users/${id}/overrides`, { overrides: overrideList }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user-overrides'] })
      toast({ title: 'Permission overrides saved' })
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

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      toast({ title: 'Password reset successfully' })
      setResetPasswordUser(null)
      resetForm.reset()
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

  const resetForm = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema) })

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { status: 'ACTIVE', is_active: true, role_ids: [] },
  })

  const createSelectedRoleIds = createForm.watch('role_ids') ?? []
  const createIsActive = createForm.watch('is_active')
  const createStatus = createForm.watch('status')

  const selectedRoleIds = watch('role_ids') ?? []
  const isActiveValue = watch('is_active')
  const statusValue = watch('status')

  function openEdit(user: User) {
    setEditUser(user)
    setEditTab('details')
    setOverrides({})
    reset({
      name: user.name,
      email: user.email,
      role_ids: user.roles?.map((r) => r.id) ?? [],
      status: user.status ?? 'ACTIVE',
      is_active: user.is_active,
    })
  }

  useEffect(() => {
    if (existingOverrides && editTab === 'overrides') {
      const seed: OverrideState = {}
      existingOverrides.forEach((o) => { seed[o.permission_id] = o.mode })
      setOverrides(seed)
    }
  }, [existingOverrides, editTab])

  function toggleCreateRoleId(roleId: string) {
    const current = createSelectedRoleIds
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId]
    createForm.setValue('role_ids', next, { shouldValidate: true })
  }

  function toggleRoleId(roleId: string) {
    const current = selectedRoleIds
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId]
    setValue('role_ids', next, { shouldValidate: true })
  }

  function buildOverrideList(): { permission_id: string; mode: OverrideMode }[] {
    return Object.entries(overrides)
      .filter(([, mode]) => mode !== null)
      .map(([permission_id, mode]) => ({ permission_id, mode: mode as OverrideMode }))
  }

  function getGrantIds(): string[] {
    return Object.entries(overrides)
      .filter(([, m]) => m === 'GRANT')
      .map(([id]) => id)
  }

  function getDenyIds(): string[] {
    return Object.entries(overrides)
      .filter(([, m]) => m === 'DENY')
      .map(([id]) => id)
  }

  function userStatusVariant(status: UserStatus): 'active' | 'suspended' | 'pending' {
    if (status === 'ACTIVE') return 'active'
    if (status === 'SUSPENDED') return 'suspended'
    return 'pending'
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
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => {
        const userRoles = row.original.roles ?? []
        if (!userRoles.length) {
          return <span className="text-muted-foreground text-xs">No roles</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {userRoles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground"
              >
                {r.name}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status ?? 'ACTIVE'
        return <StatusBadge variant={userStatusVariant(status)} />
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Active',
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={`Edit ${row.original.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {isSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setResetPasswordUser(row.original)}
              aria-label={`Reset password for ${row.original.name}`}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          )}
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

  const flatMatrix = matrix ?? []

  return (
    <PermissionGuard permission="users.view">
    <div>
      <PageHeader
        title="Users"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add user
          </Button>
        }
      />

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
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as UserStatus | '')}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
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

      {/* Create user modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          createForm.reset()
        }}
        title="Add User"
        size="lg"
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
              onClick={createForm.handleSubmit(({ confirm_password: _cp, ...data }) =>
                createMutation.mutate(data)
              )}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <LoadingSpinner size="sm" />}
              Create user
            </Button>
          </div>
        }
      >
        <form className="space-y-4">
          <FormField label="Name" error={createForm.formState.errors.name?.message} required>
            <Input {...createForm.register('name')} />
          </FormField>
          <FormField label="Email" error={createForm.formState.errors.email?.message} required>
            <Input type="email" {...createForm.register('email')} />
          </FormField>
          <FormField label="Password" error={createForm.formState.errors.password?.message} required>
            <Input type="password" {...createForm.register('password')} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm password" error={createForm.formState.errors.confirm_password?.message} required>
            <Input type="password" {...createForm.register('confirm_password')} autoComplete="new-password" />
          </FormField>

          <FormField label="Roles" error={createForm.formState.errors.role_ids?.message} required>
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {(roles ?? []).map((role) => {
                if (!isSuperAdmin && role.slug === 'super-admin') return null
                const checked = createSelectedRoleIds.includes(role.id)
                return (
                  <label key={role.id} className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCreateRoleId(role.id)}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                    <span className="text-sm font-medium">{role.name}</span>
                    {role.is_system && (
                      <span className="text-xs text-muted-foreground">(system)</span>
                    )}
                  </label>
                )
              })}
              {!roles?.length && (
                <p className="text-sm text-muted-foreground">Loading roles…</p>
              )}
            </div>
          </FormField>

          <FormField label="Status" required>
            <Select
              value={createStatus}
              onValueChange={(v) => createForm.setValue('status', v as UserStatus, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Active">
            <div className="flex items-center gap-2">
              <Switch
                checked={createIsActive}
                onCheckedChange={(v) => createForm.setValue('is_active', v)}
              />
              <span className="text-sm text-muted-foreground">
                {createIsActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </FormField>

          {createMutation.error && <ErrorAlert error={createMutation.error} />}
        </form>
      </Modal>

      {/* Edit user modal */}
      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title={`Edit User — ${editUser?.name ?? ''}`}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            {editTab === 'details' && (
              <Button
                onClick={handleSubmit((formData) =>
                  updateMutation.mutate({ id: editUser!.id, data: formData })
                )}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <LoadingSpinner size="sm" />}
                Save changes
              </Button>
            )}
            {editTab === 'overrides' && (
              <Button
                onClick={() =>
                  overridesMutation.mutate({
                    id: editUser!.id,
                    overrideList: buildOverrideList(),
                  })
                }
                disabled={overridesMutation.isPending}
              >
                {overridesMutation.isPending && <LoadingSpinner size="sm" />}
                Save overrides
              </Button>
            )}
          </div>
        }
      >
        {/* Tab bar */}
        <div className="flex gap-1 border-b mb-4">
          {(['details', 'overrides'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setEditTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                editTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'details' ? 'Details' : 'Permission Overrides'}
            </button>
          ))}
        </div>

        {editTab === 'details' && (
          <form className="space-y-4">
            <FormField label="Name" error={errors.name?.message} required>
              <Input {...register('name')} />
            </FormField>
            <FormField label="Email" error={errors.email?.message} required>
              <Input type="email" {...register('email')} />
            </FormField>

            <FormField label="Roles" error={errors.role_ids?.message} required>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {(roles ?? []).map((role) => {
                  if (!isSuperAdmin && role.slug === 'super-admin') return null
                  const checked = selectedRoleIds.includes(role.id)
                  return (
                    <label
                      key={role.id}
                      className="flex items-center gap-3 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRoleId(role.id)}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                      <span className="text-sm font-medium">{role.name}</span>
                      {role.is_system && (
                        <span className="text-xs text-muted-foreground">(system)</span>
                      )}
                    </label>
                  )
                })}
                {!roles?.length && (
                  <p className="text-sm text-muted-foreground">Loading roles…</p>
                )}
              </div>
            </FormField>

            <FormField label="Status" error={undefined} required>
              <Select
                value={statusValue}
                onValueChange={(v) => setValue('status', v as UserStatus, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Active">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isActiveValue}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <span className="text-sm text-muted-foreground">
                  {isActiveValue ? 'Active' : 'Inactive'}
                </span>
              </div>
            </FormField>

            {updateMutation.error && <ErrorAlert error={updateMutation.error} />}
          </form>
        )}

        {editTab === 'overrides' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Per-user overrides supplement role permissions. <strong>GRANT</strong> adds a
              permission regardless of roles. <strong>DENY</strong> removes a permission even if
              granted by a role. Saving replaces all existing overrides.
            </p>

            {!flatMatrix.length ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    GRANT permissions
                  </p>
                  <PermissionMatrix
                    matrix={flatMatrix}
                    value={getGrantIds()}
                    onChange={(ids) => {
                      setOverrides((prev) => {
                        const next: OverrideState = { ...prev }
                        // Clear GRANT for all matrix permissions first
                        flatMatrix.forEach((m) =>
                          Object.values(m.actions).forEach((id) => {
                            if (id && next[id] === 'GRANT') next[id] = null
                          })
                        )
                        // Set new GRANTs (but don't override DENYs)
                        ids.forEach((id) => {
                          if (next[id] !== 'DENY') next[id] = 'GRANT'
                        })
                        return next
                      })
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    DENY permissions
                  </p>
                  <PermissionMatrix
                    matrix={flatMatrix}
                    value={getDenyIds()}
                    onChange={(ids) => {
                      setOverrides((prev) => {
                        const next: OverrideState = { ...prev }
                        flatMatrix.forEach((m) =>
                          Object.values(m.actions).forEach((id) => {
                            if (id && next[id] === 'DENY') next[id] = null
                          })
                        )
                        ids.forEach((id) => {
                          if (next[id] !== 'GRANT') next[id] = 'DENY'
                        })
                        return next
                      })
                    }}
                  />
                </div>
              </div>
            )}

            {overridesMutation.error && <ErrorAlert error={overridesMutation.error} />}
          </div>
        )}
      </Modal>

      {/* Reset password dialog */}
      <Modal
        open={resetPasswordUser !== null}
        onClose={() => {
          setResetPasswordUser(null)
          resetForm.reset()
        }}
        title={`Reset Password — ${resetPasswordUser?.name ?? ''}`}
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordUser(null)
                resetForm.reset()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={resetForm.handleSubmit(({ password }) =>
                resetPasswordMutation.mutate({ id: resetPasswordUser!.id, password })
              )}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending && <LoadingSpinner size="sm" />}
              Reset password
            </Button>
          </div>
        }
      >
        <form className="space-y-4">
          <FormField
            label="New password"
            error={resetForm.formState.errors.password?.message}
            required
          >
            <Input type="password" {...resetForm.register('password')} autoComplete="new-password" />
          </FormField>
          <FormField
            label="Confirm password"
            error={resetForm.formState.errors.confirm_password?.message}
            required
          >
            <Input type="password" {...resetForm.register('confirm_password')} autoComplete="new-password" />
          </FormField>
          {resetPasswordMutation.error && <ErrorAlert error={resetPasswordMutation.error} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete user?"
        description="This will soft-delete the user. They will no longer be able to log in."
        isLoading={deleteMutation.isPending}
      />
    </div>
    </PermissionGuard>
  )
}
