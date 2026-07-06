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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, cn, slugify } from '@/lib/utils'
import type { Category, Type } from '@/types/models.types'
import { categorySchema, type CategoryFormData } from './_schemas'

type SortField = 'name' | 'created_at' | 'is_active'

// Sentinel for the "no type" option — the shadcn Select cannot use an empty string value.
const NONE = '__none__'

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['categories', page, debouncedSearch, statusFilter, typeFilter, sortBy, sortOrder],
    queryFn: () =>
      api
        .get('/categories', {
          params: {
            page,
            limit: 10,
            search: debouncedSearch || undefined,
            is_active: statusFilter || undefined,
            type_id: typeFilter || undefined,
            sortBy,
            sortOrder,
          },
        })
        .then(
          (r) =>
            r.data.data as {
              categories: Category[]
              pagination: { total: number; pages: number }
            }
        ),
  })

  // Active types for the form dropdown and the type filter.
  const { data: typesData } = useQuery({
    queryKey: ['types-options'],
    queryFn: () =>
      api
        .get('/types', { params: { limit: 100, is_active: 'true', sortBy: 'name', sortOrder: 'asc' } })
        .then((r) => r.data.data as { types: Type[] }),
  })
  const typeOptions = typesData?.types ?? []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { is_active: true, type_id: '' },
  })

  const createMutation = useMutation({
    mutationFn: (payload: CategoryFormData) =>
      api.post('/categories', { ...payload, type_id: payload.type_id || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast({ title: 'Category created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryFormData }) =>
      api.patch(`/categories/${id}`, { ...payload, type_id: payload.type_id || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast({ title: 'Category updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast({ title: 'Category deleted' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ name: '', type_id: '', is_active: true })
    setFormOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    reset({
      name: category.name,
      type_id: category.type_id ?? '',
      is_active: category.is_active,
    })
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
  const typeValue = watch('type_id')
  const nameValue = watch('name')
  const slugPreview = nameValue ? slugify(nameValue) : ''

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: () => sortableHeader('name', 'Name'),
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
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) =>
        row.original.type ? (
          <Badge variant="secondary">{row.original.type.name}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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

  function onSubmit(formData: CategoryFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <PermissionGuard permission="categories.view">
    <div>
      <PageHeader
        title="Categories"
        breadcrumbs={[{ label: 'Application Settings' }, { label: 'Categories' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Category
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter || NONE}
          onValueChange={(v) => {
            setTypeFilter(v === NONE ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        data={data?.categories ?? []}
        isLoading={isLoading}
        emptyMessage="No categories found."
        pagination={
          data
            ? { page, totalPages: data.pagination.pages, onPageChange: setPage }
            : undefined
        }
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Category' : 'New Category'}
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
              <Input placeholder="e.g. Enterprise" {...register('name')} />
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
          <FormField label="Type" error={errors.type_id?.message} hint="Optional — link this category to a type.">
            <Select
              value={typeValue || NONE}
              onValueChange={(v) => setValue('type_id', v === NONE ? '' : v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No type</SelectItem>
                {typeOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Status">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
              <span className="text-sm text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </FormField>
          {formError && <ErrorAlert error={formError} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete category?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
    </PermissionGuard>
  )
}
