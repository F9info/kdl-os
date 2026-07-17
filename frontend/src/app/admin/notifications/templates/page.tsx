'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  NotificationTemplate,
  NotificationCategory,
  NotificationChannel,
} from '@/types/notifications.types'

const CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']
const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: 'In-App',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
}

interface TemplateForm {
  slug: string
  category_id: string
  name: string
  variables: string
  in_app_body: string
  email_subject: string
  email_body: string
  sms_body: string
  whatsapp_body: string
  is_active: boolean
}

function emptyForm(): TemplateForm {
  return {
    slug: '',
    category_id: '',
    name: '',
    variables: '',
    in_app_body: '',
    email_subject: '',
    email_body: '',
    sms_body: '',
    whatsapp_body: '',
    is_active: true,
  }
}

export default function NotificationTemplatesPage() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; editing: NotificationTemplate | null }>({
    open: false,
    editing: null,
  })
  const [form, setForm] = useState<TemplateForm>(emptyForm())
  const [formError, setFormError] = useState<unknown>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState('')
  const [previewResult, setPreviewResult] = useState<Record<string, string> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeChannel, setActiveChannel] = useState<NotificationChannel>('IN_APP')

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () =>
      api
        .get('/notifications/templates')
        .then((r) => r.data.data.templates as NotificationTemplate[]),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['notification-categories'],
    queryFn: () =>
      api
        .get('/notifications/categories')
        .then((r) => r.data.data.categories as NotificationCategory[]),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      dialog.editing
        ? api.patch(`/notifications/templates/${dialog.editing.id}`, payload)
        : api.post('/notifications/templates', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      setDialog({ open: false, editing: null })
      toast({ title: dialog.editing ? 'Template updated' : 'Template created' })
    },
    onError: (err: unknown) => setFormError(err),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      setDeleteId(null)
      toast({ title: 'Template deleted' })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Delete failed'
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setForm(emptyForm())
    setFormError(null)
    setDialog({ open: true, editing: null })
  }

  function openEdit(t: NotificationTemplate) {
    setForm({
      slug: t.slug,
      category_id: t.category_id,
      name: t.name,
      variables: t.variables.join(', '),
      in_app_body: t.in_app_body ?? '',
      email_subject: t.email_subject ?? '',
      email_body: t.email_body ?? '',
      sms_body: t.sms_body ?? '',
      whatsapp_body: t.whatsapp_body ?? '',
      is_active: t.is_active,
    })
    setFormError(null)
    setDialog({ open: true, editing: t })
  }

  function handleSave() {
    if (!form.slug.trim() || !form.name.trim() || !form.category_id) {
      setFormError('Slug, name, and category are required')
      return
    }
    const payload = {
      ...form,
      variables: form.variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      in_app_body: form.in_app_body || null,
      email_subject: form.email_subject || null,
      email_body: form.email_body || null,
      sms_body: form.sms_body || null,
      whatsapp_body: form.whatsapp_body || null,
    }
    setFormError(null)
    saveMutation.mutate(payload)
  }

  async function handlePreview() {
    if (!previewId) return
    try {
      let data: Record<string, string> = {}
      try {
        data = JSON.parse(previewData)
      } catch {
        data = {}
      }
      const resp = await api.post(`/notifications/templates/${previewId}/preview`, { data })
      setPreviewResult(resp.data.data.preview)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Preview failed'
      toast({ title: 'Preview failed', description: msg, variant: 'destructive' })
    }
  }

  const channelBodyField: Record<NotificationChannel, keyof TemplateForm> = {
    IN_APP: 'in_app_body',
    EMAIL: 'email_body',
    SMS: 'sms_body',
    WHATSAPP: 'whatsapp_body',
  }

  return (
    <ModuleGuard slug="notifications">
      <PermissionGuard permission="notifications:view">
        <div className="p-6">
          <PageHeader
            title="Notification Templates"
            action={
              <PermissionGuard permission="notifications:add">
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Template
                </Button>
              </PermissionGuard>
            }
          />

          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No templates yet.</div>
          ) : (
            <div className="mt-6 rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium">Slug</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t, i) => (
                    <tr key={t.id} className={i < templates.length - 1 ? 'border-b' : ''}>
                      <td className="p-3 font-mono text-xs">{t.slug}</td>
                      <td className="p-3">{t.name}</td>
                      <td className="p-3 text-muted-foreground">{t.category?.name}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
                        >
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setPreviewId(t.id)
                              setPreviewData('')
                              setPreviewResult(null)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <PermissionGuard permission="notifications:edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="notifications:delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(t.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create/Edit Dialog */}
          <Modal
            open={dialog.open}
            onClose={() => setDialog({ open: false, editing: null })}
            title={dialog.editing ? 'Edit Template' : 'New Template'}
            size="lg"
            footer={
              <div className="flex gap-2 justify-end w-full">
                <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            }
          >
            <div className="space-y-4 py-2">
              <ErrorAlert error={formError} />
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Slug" required>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="user.welcome"
                    disabled={!!dialog.editing}
                  />
                </FormField>
                <FormField label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Welcome"
                  />
                </FormField>
              </div>
              <FormField label="Category" required>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Variables (comma-separated)">
                <Input
                  value={form.variables}
                  onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
                  placeholder="user_name, reset_link"
                />
              </FormField>

              {/* Channel tabs */}
              <div>
                <div className="flex gap-1 border-b mb-3">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setActiveChannel(ch)}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${activeChannel === ch ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                    >
                      {CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
                {activeChannel === 'EMAIL' && (
                  <FormField label="Email Subject">
                    <Input
                      value={form.email_subject}
                      onChange={(e) => setForm((f) => ({ ...f, email_subject: e.target.value }))}
                      placeholder="Welcome, {{user_name}}!"
                    />
                  </FormField>
                )}
                <FormField label={`${CHANNEL_LABELS[activeChannel]} Body`}>
                  <textarea
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                    value={form[channelBodyField[activeChannel]] as string}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [channelBodyField[activeChannel]]: e.target.value }))
                    }
                    placeholder="Use {{variable}} placeholders"
                  />
                </FormField>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  id="is_active"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </Modal>

          {/* Preview Dialog */}
          <Modal
            open={!!previewId}
            onClose={() => {
              setPreviewId(null)
              setPreviewResult(null)
            }}
            title="Preview Template"
            footer={
              <div className="flex gap-2 justify-end w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewId(null)
                    setPreviewResult(null)
                  }}
                >
                  Close
                </Button>
                <Button onClick={handlePreview}>Preview</Button>
              </div>
            }
          >
            <div className="space-y-4 py-2">
              <FormField label="Sample data (JSON)">
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  value={previewData}
                  onChange={(e) => setPreviewData(e.target.value)}
                  placeholder={'{"user_name": "Alice"}'}
                />
              </FormField>
              {previewResult && (
                <div className="space-y-3">
                  {Object.entries(previewResult).map(([ch, content]) => (
                    <div key={ch} className="rounded-md border p-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                        {ch}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal>

          <ConfirmDialog
            open={!!deleteId}
            onClose={() => setDeleteId(null)}
            onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
            title="Delete Template"
            description="This template will be permanently deleted. This cannot be undone."
            confirmLabel="Delete"
            variant="destructive"
          />
        </div>
      </PermissionGuard>
    </ModuleGuard>
  )
}
