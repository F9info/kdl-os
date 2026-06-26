'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Setting } from '@/types/models.types'
import { settingSchema, type SettingFormData } from './_schemas'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [editSetting, setEditSetting] = useState<Setting | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api.get('/settings').then((r) => r.data.data as { settings: Setting[] }),
  })

  const createMutation = useMutation({
    mutationFn: (data: SettingFormData) => api.post('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast({ title: 'Setting created' })
      createReset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SettingFormData> }) =>
      api.patch(`/settings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast({ title: 'Setting updated' })
      setEditSetting(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast({ title: 'Setting deleted' })
      setDeleteId(null)
    },
  })

  const {
    register: createRegister,
    handleSubmit: createHandleSubmit,
    reset: createReset,
    setValue: createSetValue,
    watch: createWatch,
    formState: { errors: createErrors },
  } = useForm<SettingFormData>({
    resolver: zodResolver(settingSchema),
    defaultValues: { type: 'string', is_public: false },
  })

  const {
    register: editRegister,
    handleSubmit: editHandleSubmit,
    reset: editReset,
    setValue: editSetValue,
    watch: editWatch,
    formState: { errors: editErrors },
  } = useForm<SettingFormData>({ resolver: zodResolver(settingSchema) })

  function openEdit(setting: Setting) {
    setEditSetting(setting)
    editReset({
      key: setting.key,
      value: setting.value,
      type: setting.type,
      description: setting.description ?? undefined,
      is_public: setting.is_public,
    })
  }

  function togglePublic(setting: Setting) {
    updateMutation.mutate({ id: setting.id, data: { is_public: !setting.is_public } })
  }

  const createType = createWatch('type')
  const editType = editWatch('type')

  const columns: ColumnDef<Setting>[] = [
    {
      accessorKey: 'key',
      header: 'Key',
      cell: ({ row }) => (
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {row.original.key}
        </code>
      ),
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: ({ row }) => (
        <span className="truncate max-w-[200px] block text-sm">{row.original.value}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
    },
    {
      accessorKey: 'is_public',
      header: 'Public',
      cell: ({ row }) => (
        <Switch
          checked={row.original.is_public}
          onCheckedChange={() => togglePublic(row.original)}
          aria-label={`Toggle public for ${row.original.key}`}
        />
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
            aria-label={`Edit ${row.original.key}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={`Delete ${row.original.key}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={data?.settings ?? []}
            isLoading={isLoading}
            emptyMessage="No settings configured."
          />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Setting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={createHandleSubmit((d) => createMutation.mutate(d))}
                className="space-y-3"
              >
                <FormField label="Key" error={createErrors.key?.message} required>
                  <Input
                    placeholder="app_name"
                    {...createRegister('key')}
                    className="font-mono text-sm"
                  />
                </FormField>
                <FormField label="Value" error={createErrors.value?.message} required>
                  <Input placeholder="value" {...createRegister('value')} />
                </FormField>
                <FormField label="Type" error={createErrors.type?.message} required>
                  <Select
                    value={createType}
                    onValueChange={(v) =>
                      createSetValue('type', v as SettingFormData['type'], { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Description" error={createErrors.description?.message}>
                  <Input placeholder="Optional description" {...createRegister('description')} />
                </FormField>
                <div className="flex items-center gap-2">
                  <Switch
                    onCheckedChange={(v) => createSetValue('is_public', v)}
                    aria-label="Is public"
                  />
                  <span className="text-sm text-muted-foreground">Public</span>
                </div>
                {createMutation.error && <ErrorAlert error={createMutation.error} />}
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        open={editSetting !== null}
        onClose={() => setEditSetting(null)}
        title="Edit Setting"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditSetting(null)}>
              Cancel
            </Button>
            <Button
              onClick={editHandleSubmit((formData) =>
                updateMutation.mutate({ id: editSetting!.id, data: formData })
              )}
              disabled={updateMutation.isPending}
            >
              Save
            </Button>
          </div>
        }
      >
        <form className="space-y-4">
          <FormField label="Key" error={editErrors.key?.message} required>
            <Input className="font-mono text-sm" {...editRegister('key')} />
          </FormField>
          <FormField label="Value" error={editErrors.value?.message} required>
            <Input {...editRegister('value')} />
          </FormField>
          <FormField label="Type" error={editErrors.type?.message} required>
            <Select
              value={editType}
              onValueChange={(v) =>
                editSetValue('type', v as SettingFormData['type'], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Description" error={editErrors.description?.message}>
            <Input {...editRegister('description')} />
          </FormField>
          <div className="flex items-center gap-2">
            <Switch
              checked={editWatch('is_public')}
              onCheckedChange={(v) => editSetValue('is_public', v)}
              aria-label="Is public"
            />
            <span className="text-sm text-muted-foreground">Public</span>
          </div>
          {updateMutation.error && <ErrorAlert error={updateMutation.error} />}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete setting?"
        description="This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
