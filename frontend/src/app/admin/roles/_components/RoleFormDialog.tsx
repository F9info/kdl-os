'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { PermissionMatrix } from '@/components/shared/PermissionMatrix'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { RbacRole, PermissionModuleMatrix } from '@/types/models.types'

const roleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  permission_ids: z.array(z.string()),
})

type RoleFormData = z.infer<typeof roleSchema>

interface RoleFormDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: RoleFormData) => void
  isPending: boolean
  error: unknown
  role?: RbacRole | null
}

export function RoleFormDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  role,
}: RoleFormDialogProps) {
  const isEdit = !!role

  const { data: matrix, isLoading: matrixLoading } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () =>
      api.get('/permissions/matrix').then((r) => r.data.data.matrix as PermissionModuleMatrix[]),
    staleTime: 60_000,
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', description: '', permission_ids: [] },
  })

  const permissionIds = watch('permission_ids')

  useEffect(() => {
    if (open) {
      if (role) {
        const ids = role.permission_matrix ? Object.values(role.permission_matrix) : []
        reset({
          name: role.name,
          description: role.description ?? '',
          permission_ids: ids,
        })
      } else {
        reset({ name: '', description: '', permission_ids: [] })
      }
    }
  }, [open, role, reset])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Role' : 'Create Role'}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isPending || matrixLoading}>
            {isPending && <LoadingSpinner size="sm" />}
            {isEdit ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      }
    >
      <form className="space-y-4">
        <FormField label="Name" error={errors.name?.message} required>
          <Input
            {...register('name')}
            placeholder="e.g. Content Editor"
            disabled={isEdit && !!role?.is_system}
          />
          {isEdit && role?.is_system && (
            <p className="text-xs text-muted-foreground">System role names cannot be changed.</p>
          )}
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <Textarea {...register('description')} placeholder="Optional description" rows={2} />
        </FormField>

        <FormField label="Permissions" error={undefined}>
          {matrixLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <LoadingSpinner size="sm" />
              Loading permissions…
            </div>
          ) : (
            <PermissionMatrix
              matrix={matrix ?? []}
              value={permissionIds}
              onChange={(ids) => setValue('permission_ids', ids)}
            />
          )}
        </FormField>

        {error ? <ErrorAlert error={error} /> : null}
      </form>
    </Modal>
  )
}
