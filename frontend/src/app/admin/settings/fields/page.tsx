'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Search, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { slugify } from '@/lib/utils'
import { INPUT_TYPE_LABELS, INPUT_TYPE_OPTIONS, isOptionType } from '@/lib/inputTypes'
import type { SettingField, Type, Category, InputType } from '@/types/models.types'
import { fieldDefSchema, type FieldDefFormData } from './_schemas'

// shadcn Select cannot use an empty-string value; use a sentinel for "no category".
const NONE = '__none__'

export default function FieldsPage() {
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [inputTypeFilter, setInputTypeFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SettingField | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['setting-fields', page, debouncedSearch, typeFilter, inputTypeFilter],
    queryFn: () =>
      api
        .get('/setting-fields', {
          params: {
            page,
            limit: 10,
            search: debouncedSearch || undefined,
            type_id: typeFilter || undefined,
            input_type: inputTypeFilter || undefined,
            sortBy: 'sort',
            sortOrder: 'asc',
          },
        })
        .then(
          (r) =>
            r.data.data as {
              fields: SettingField[]
              pagination: { total: number; pages: number }
            }
        ),
  })

  // Types & categories for the form selects and filters.
  const { data: typesData } = useQuery({
    queryKey: ['types-options'],
    queryFn: () =>
      api
        .get('/types', { params: { limit: 100, is_active: 'true', sortBy: 'name', sortOrder: 'asc' } })
        .then((r) => r.data.data as { types: Type[] }),
  })
  const typeOptions = typesData?.types ?? []

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-options'],
    queryFn: () =>
      api
        .get('/categories', { params: { limit: 200, sortBy: 'name', sortOrder: 'asc' } })
        .then((r) => r.data.data as { categories: Category[] }),
  })
  const categoryOptions = categoriesData?.categories ?? []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FieldDefFormData>({
    resolver: zodResolver(fieldDefSchema),
    defaultValues: { input_type: 'textbox', type_id: '', category_id: '' },
  })

  const createMutation = useMutation({
    mutationFn: (payload: FieldDefFormData) => api.post('/setting-fields', toApi(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting-fields'] })
      toast({ title: 'Field created' })
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FieldDefFormData }) =>
      api.patch(`/setting-fields/${id}`, toApi(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting-fields'] })
      toast({ title: 'Field updated' })
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/setting-fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting-fields'] })
      toast({ title: 'Field deleted' })
      setDeleteId(null)
    },
  })

  // Normalize empty selects to null and drop options when not applicable.
  function toApi(payload: FieldDefFormData) {
    return {
      field_name: payload.field_name,
      input_type: payload.input_type,
      type_id: payload.type_id,
      category_id: payload.category_id || null,
      options: isOptionType(payload.input_type) ? payload.options || null : null,
    }
  }

  function openCreate() {
    setEditing(null)
    reset({ field_name: '', input_type: 'textbox', type_id: '', category_id: '', options: '' })
    setFormOpen(true)
  }

  function openEdit(field: SettingField) {
    setEditing(field)
    reset({
      field_name: field.field_name,
      input_type: field.input_type,
      type_id: field.type_id,
      category_id: field.category_id ?? '',
      options: field.options ?? '',
    })
    setFormOpen(true)
  }

  const formError = editing ? updateMutation.error : createMutation.error
  const isSaving = createMutation.isPending || updateMutation.isPending
  const inputType = watch('input_type')
  const typeId = watch('type_id')
  const categoryId = watch('category_id')
  const nameValue = watch('field_name')
  const slugPreview = nameValue ? slugify(nameValue) : ''

  const columns: ColumnDef<SettingField>[] = [
    {
      accessorKey: 'sort',
      header: '#',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.sort}</span>,
    },
    {
      accessorKey: 'field_name',
      header: 'Field Name',
      cell: ({ row }) => <span className="font-medium">{row.original.field_name}</span>,
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
      accessorKey: 'input_type',
      header: 'Input Type',
      cell: ({ row }) => <Badge variant="secondary">{INPUT_TYPE_LABELS[row.original.input_type]}</Badge>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) =>
        row.original.type ? (
          <span className="text-sm">{row.original.type.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) =>
        row.original.category ? (
          <span className="text-sm">{row.original.category.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
            aria-label={`Edit ${row.original.field_name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.field_name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  function onSubmit(formData: FieldDefFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  // Categories filtered to the chosen Type (plus uncategorized ones).
  const formCategories = categoryOptions.filter((c) => !typeId || !c.type_id || c.type_id === typeId)

  return (
    <PermissionGuard permission="setting-fields:view">
    <div>
      <PageHeader
        title="Fields"
        breadcrumbs={[{ label: 'Application Settings' }, { label: 'Fields' }]}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Field
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
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
          value={inputTypeFilter || NONE}
          onValueChange={(v) => {
            setInputTypeFilter(v === NONE ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All input types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All input types</SelectItem>
            {INPUT_TYPE_OPTIONS.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.fields ?? []}
        isLoading={isLoading}
        emptyMessage="No fields found. Create one to start building a settings screen."
        pagination={
          data ? { page, totalPages: data.pagination.pages, onPageChange: setPage } : undefined
        }
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Field' : 'New Field'}
        size="lg"
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
            <FormField label="Field Name" error={errors.field_name?.message} required>
              <Input placeholder="e.g. Site Logo" {...register('field_name')} />
            </FormField>
            <FormField label="Slug" hint="Auto-generated from the field name.">
              <Input
                value={slugPreview}
                readOnly
                tabIndex={-1}
                placeholder="auto-generated"
                className="bg-muted text-muted-foreground"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Input Type" error={errors.input_type?.message} required>
              <Select
                value={inputType}
                onValueChange={(v) => setValue('input_type', v as InputType, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INPUT_TYPE_OPTIONS.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Type" error={errors.type_id?.message} required hint="The settings screen this field belongs to.">
              <Select
                value={typeId || NONE}
                onValueChange={(v) => setValue('type_id', v === NONE ? '' : v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Select a type</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {isOptionType(inputType) && (
            <FormField
              label="Options"
              error={errors.options?.message}
              required
              hint="Comma-separated, e.g. Small, Medium, Large"
            >
              <Textarea placeholder="Option A, Option B, Option C" {...register('options')} />
            </FormField>
          )}

          <FormField label="Category" hint="Optional grouping label.">
            <Select
              value={categoryId || NONE}
              onValueChange={(v) => setValue('category_id', v === NONE ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No category</SelectItem>
                {formCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {formError && <ErrorAlert error={formError} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete field?"
        description="This permanently deletes the field definition and its saved value (and any uploaded files)."
        isLoading={deleteMutation.isPending}
      />
    </div>
    </PermissionGuard>
  )
}
