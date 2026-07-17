'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Search, Plus, ArrowUpDown } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
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
import { formatDate, cn, slugify } from '@/lib/utils'
import type { Type } from '@/types/models.types'
import { typeSchema, type TypeFormData } from './_schemas'

type SortField = 'name' | 'created_at' | 'is_active'

export default function TypesPage() {
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('')
  const [sortBy, setSortBy] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Type | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['types', page, debouncedSearch, statusFilter, sortBy, sortOrder],
    queryFn: () =>
      api
        .get('/types', {
          params: {
            page,
            limit: 10,
            search: debouncedSearch || undefined,
            is_active: statusFilter || undefined,
            sortBy,
            sortOrder,
          },
        })
        .then(
          (r) => r.data.data as { types: Type[]; pagination: { total: number; pages: number } }
        ),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TypeFormData>({
    resolver: zodResolver(typeSchema),
    defaultValues: { is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (payload: TypeFormData) => api.post('/types', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['types'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar-types'] })
      toast({ title: 'Type created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TypeFormData }) =>
      api.patch(`/types/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['types'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar-types'] })
      toast({ title: 'Type updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['types'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar-types'] })
      toast({ title: 'Type deleted' })
      setDeleteId(null)
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not delete type'
      toast({ title: 'Cannot delete type', description: message, variant: 'destructive' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ name: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(type: Type) {
    setEditing(type)
    reset({ name: type.name, is_active: type.is_active })
    setFormOpen(true)
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  function sortableHeader(field: SortField, label: string) {
    const active = sortBy === field
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          className={cn('h-3.5 w-3.5', active ? 'text-foreground' : 'text-muted-foreground/40')}
        />
      </button>
    )
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isActive = watch('is_active')
  const nameValue = watch('name')
  const slugPreview = nameValue ? slugify(nameValue) : ''

  const columns: ColumnDef<Type>[] = [
    {
      accessorKey: 'name',
      header: () => sortableHeader('name', 'Type'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {row.original.slug}
        </code>
      ),
    },
    {
      accessorKey: 'is_active',
      header: () => sortableHeader('is_active', 'Status'),
      cell: ({ row }) => <StatusBadge variant={row.original.is_active ? 'active' : 'inactive'} />,
    },
    {
      accessorKey: 'created_at',
      header: () => sortableHeader('created_at', 'Created'),
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

  function onSubmit(formData: TypeFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <PermissionGuard permission="types:view">
      <div>
        <PageHeader
          title="Types"
          breadcrumbs={[{ label: 'Application Settings' }, { label: 'Types' }]}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Type
            </Button>
          }
        />

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search types..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as '' | 'true' | 'false')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={data?.types ?? []}
          isLoading={isLoading}
          emptyMessage="No types found."
          pagination={
            data ? { page, totalPages: data.pagination.pages, onPageChange: setPage } : undefined
          }
        />

        <Modal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? 'Edit Type' : 'New Type'}
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
              <FormField label="Type" error={errors.name?.message} required>
                <Input placeholder="e.g. Lead Source" {...register('name')} />
              </FormField>
              <FormField label="Slug" hint="Auto-generated from the name.">
                <Input
                  value={slugPreview}
                  readOnly
                  tabIndex={-1}
                  placeholder="auto-generated"
                  className="bg-muted text-muted-foreground"
                />
              </FormField>
            </div>
            <FormField label="Status">
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
                <span className="text-sm text-muted-foreground">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </FormField>
            {formError && <ErrorAlert error={formError} />}
          </form>
        </Modal>

        <ConfirmDialog
          open={deleteId !== null}
          onClose={() => setDeleteId(null)}
          onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
          title="Delete type?"
          description="A type can only be deleted once it has no fields or linked categories. Remove or reassign them first."
          isLoading={deleteMutation.isPending}
        />
      </div>
    </PermissionGuard>
  )
}
