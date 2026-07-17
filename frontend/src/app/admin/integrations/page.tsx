'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, SendHorizonal, RotateCcw } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
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
import { cn } from '@/lib/utils'
import type { IntegrationChannel, IntegrationProvider, DriverKey } from '@/types/integrations.types'
import { DRIVER_FIELDS, CHANNEL_DRIVERS } from '@/types/integrations.types'

const CHANNELS: IntegrationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP']
const CHANNEL_LABELS: Record<IntegrationChannel, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
}

interface ProviderFormState {
  channel: IntegrationChannel
  driver: DriverKey
  name: string
  is_active: boolean
  is_default: boolean
  is_fallback: boolean
  credentials: Record<string, string>
  config: Record<string, string>
  replaceCredentials: boolean
}

function defaultForm(channel: IntegrationChannel): ProviderFormState {
  const driver = CHANNEL_DRIVERS[channel][0] as DriverKey
  return {
    channel,
    driver,
    name: '',
    is_active: false,
    is_default: false,
    is_fallback: false,
    credentials: {},
    config: {},
    replaceCredentials: false,
  }
}

interface TestSendState {
  recipient: string
  message: string
  subject: string
  result: { logId: string; status: string } | null
  error: unknown
  loading: boolean
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient()
  const [activeChannel, setActiveChannel] = useState<IntegrationChannel>('EMAIL')

  const [providerDialog, setProviderDialog] = useState<{
    open: boolean
    editing: IntegrationProvider | null
  }>({ open: false, editing: null })
  const [form, setForm] = useState<ProviderFormState>(defaultForm('EMAIL'))
  const [formError, setFormError] = useState<unknown>(null)

  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [testSendProvider, setTestSendProvider] = useState<IntegrationProvider | null>(null)
  const [testSend, setTestSend] = useState<TestSendState>({
    recipient: '',
    message: '',
    subject: '',
    result: null,
    error: null,
    loading: false,
  })

  const { data: providers, isLoading } = useQuery({
    queryKey: ['integrations-providers'],
    queryFn: () =>
      api.get('/integrations/providers').then((r) => r.data.data.items as IntegrationProvider[]),
  })

  const channelProviders = providers?.filter((p) => p.channel === activeChannel) ?? []

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (providerDialog.editing) {
        return api.patch(`/integrations/providers/${providerDialog.editing.id}`, payload)
      }
      return api.post('/integrations/providers', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-providers'] })
      setProviderDialog({ open: false, editing: null })
      toast({ title: providerDialog.editing ? 'Provider updated' : 'Provider created' })
    },
    onError: (err: unknown) => {
      setFormError(err)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-providers'] })
      setDeleteId(null)
      toast({ title: 'Provider deleted' })
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
    setForm(defaultForm(activeChannel))
    setFormError(null)
    setProviderDialog({ open: true, editing: null })
  }

  function openEdit(p: IntegrationProvider) {
    setForm({
      channel: p.channel,
      driver: p.driver as DriverKey,
      name: p.name,
      is_active: p.is_active,
      is_default: p.is_default,
      is_fallback: p.is_fallback,
      credentials: {},
      config: Object.fromEntries(Object.entries(p.config ?? {}).map(([k, v]) => [k, String(v)])),
      replaceCredentials: false,
    })
    setFormError(null)
    setProviderDialog({ open: true, editing: p })
  }

  function handleDriverChange(driver: DriverKey) {
    setForm((f) => ({ ...f, driver, credentials: {}, config: {} }))
  }

  function handleSave() {
    const fields = DRIVER_FIELDS[form.driver]
    const isEditing = !!providerDialog.editing
    const needsCreds = !isEditing || form.replaceCredentials

    if (!form.name.trim()) {
      setFormError('Provider name is required')
      return
    }

    if (needsCreds) {
      for (const f of fields.filter((f) => f.section === 'credentials' && f.required)) {
        if (!form.credentials[f.key]?.trim()) {
          setFormError(`${f.label} is required`)
          return
        }
      }
    }
    for (const f of fields.filter((f) => f.section === 'config' && f.required)) {
      if (!form.config[f.key]?.trim()) {
        setFormError(`${f.label} is required`)
        return
      }
    }

    const payload: Record<string, unknown> = {
      channel: form.channel,
      driver: form.driver,
      name: form.name,
      is_active: form.is_active,
      is_default: form.is_default,
      is_fallback: form.is_fallback,
      config: Object.fromEntries(Object.entries(form.config).filter(([, v]) => v.trim())),
    }

    if (needsCreds) {
      payload.credentials = { ...form.credentials }
    }

    setFormError(null)
    saveMutation.mutate(payload)
  }

  async function handleTestSend() {
    if (!testSendProvider) return
    setTestSend((s) => ({ ...s, loading: true, result: null, error: null }))
    try {
      const resp = await api.post(`/integrations/providers/${testSendProvider.id}/test`, {
        to: testSend.recipient,
        body: testSend.message,
        subject: testSend.subject || undefined,
      })
      setTestSend((s) => ({
        ...s,
        loading: false,
        result: { logId: resp.data.data.log_id, status: 'QUEUED' },
      }))
    } catch (err: unknown) {
      setTestSend((s) => ({ ...s, loading: false, error: err }))
    }
  }

  const credFields = DRIVER_FIELDS[form.driver]?.filter((f) => f.section === 'credentials') ?? []
  const cfgFields = DRIVER_FIELDS[form.driver]?.filter((f) => f.section === 'config') ?? []
  const isEditing = !!providerDialog.editing

  return (
    <ModuleGuard slug="integrations">
      <PermissionGuard permission="integrations:view">
        <div>
          <PageHeader
            title="Integrations"
            action={
              <PermissionGuard permission="integrations:add">
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Provider
                </Button>
              </PermissionGuard>
            }
          />

          {/* Channel tabs */}
          <div className="flex gap-1 mb-6 border-b">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeChannel === ch
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>

          {/* Provider cards */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : channelProviders.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No providers configured for {CHANNEL_LABELS[activeChannel]}.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {channelProviders.map((p) => (
                <div key={p.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {p.driver}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <PermissionGuard permission="integrations:edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(p)}
                          aria-label="Edit provider"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission="integrations:edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setTestSendProvider(p)
                            setTestSend({
                              recipient: '',
                              message: '',
                              subject: '',
                              result: null,
                              error: null,
                              loading: false,
                            })
                          }}
                          aria-label="Test send"
                        >
                          <SendHorizonal className="h-3.5 w-3.5" />
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission="integrations:delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(p.id)}
                          aria-label="Delete provider"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </PermissionGuard>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.is_active && (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 text-xs font-medium">
                        Active
                      </span>
                    )}
                    {p.is_default && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">
                        Default
                      </span>
                    )}
                    {p.is_fallback && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                        Fallback
                      </span>
                    )}
                    {!p.is_active && !p.is_default && !p.is_fallback && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Provider Dialog */}
          <Modal
            open={providerDialog.open}
            onClose={() => setProviderDialog({ open: false, editing: null })}
            title={isEditing ? 'Edit Provider' : 'Add Provider'}
            size="lg"
            footer={
              <div className="flex gap-2 justify-end w-full">
                <Button
                  variant="outline"
                  onClick={() => setProviderDialog({ open: false, editing: null })}
                >
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

              <FormField label="Channel" required>
                <Select
                  value={form.channel}
                  onValueChange={(v) => {
                    const ch = v as IntegrationChannel
                    const driver = CHANNEL_DRIVERS[ch][0] as DriverKey
                    setForm((f) => ({ ...f, channel: ch, driver, credentials: {}, config: {} }))
                  }}
                  disabled={isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        {CHANNEL_LABELS[ch]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Driver" required>
                <Select
                  value={form.driver}
                  onValueChange={(v) => handleDriverChange(v as DriverKey)}
                  disabled={isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_DRIVERS[form.channel].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Display Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. MSG91 Production"
                />
              </FormField>

              {/* Credential fields — saved creds show •••• with Replace button; new/replace shows inputs */}
              {isEditing && !form.replaceCredentials ? (
                <div className="rounded-md border p-3 bg-muted/40 space-y-2">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Credentials
                  </div>
                  {credFields.map((f) => (
                    <div key={f.key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span
                        className="font-mono tracking-widest text-muted-foreground"
                        data-testid={`saved-credential-${f.key}`}
                      >
                        ••••••••
                      </span>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setForm((f) => ({ ...f, replaceCredentials: true }))}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Replace Credentials
                  </Button>
                </div>
              ) : (
                credFields.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Credentials
                    </div>
                    {credFields.map((f) => (
                      <FormField key={f.key} label={f.label} required={f.required}>
                        <Input
                          type={
                            f.type === 'password'
                              ? 'password'
                              : f.type === 'number'
                                ? 'number'
                                : 'text'
                          }
                          value={form.credentials[f.key] ?? ''}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              credentials: { ...prev.credentials, [f.key]: e.target.value },
                            }))
                          }
                          autoComplete="new-password"
                        />
                      </FormField>
                    ))}
                  </div>
                )
              )}

              {/* Config fields */}
              {cfgFields.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Configuration
                  </div>
                  {cfgFields.map((f) => (
                    <FormField key={f.key} label={f.label} required={f.required}>
                      <Input
                        type="text"
                        value={form.config[f.key] ?? ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, [f.key]: e.target.value },
                          }))
                        }
                      />
                    </FormField>
                  ))}
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                {(
                  [
                    { key: 'is_active', label: 'Active' },
                    { key: 'is_default', label: 'Default for channel' },
                    { key: 'is_fallback', label: 'Fallback' },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Switch
                      checked={form[key]}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                      id={`toggle-${key}`}
                    />
                    <Label htmlFor={`toggle-${key}`} className="cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </Modal>

          {/* Test Send Dialog */}
          <Modal
            open={!!testSendProvider}
            onClose={() => setTestSendProvider(null)}
            title={`Test Send — ${testSendProvider?.name ?? ''}`}
            footer={
              <div className="flex gap-2 justify-end w-full">
                <Button variant="outline" onClick={() => setTestSendProvider(null)}>
                  Close
                </Button>
                <Button
                  onClick={handleTestSend}
                  disabled={testSend.loading || !testSend.recipient || !testSend.message}
                >
                  {testSend.loading ? 'Sending…' : 'Send Test'}
                </Button>
              </div>
            }
          >
            <div className="space-y-4 py-2">
              <ErrorAlert error={testSend.error} />
              {testSend.result && (
                <div className="rounded-md border bg-green-50 dark:bg-green-950 p-3 text-sm space-y-1">
                  <div className="font-medium text-green-800 dark:text-green-300">
                    Sent successfully
                  </div>
                  <div className="text-muted-foreground">
                    Status: <span className="font-mono">{testSend.result.status}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Log entry:{' '}
                    <a
                      href={`/admin/integrations/logs?id=${testSend.result.logId}`}
                      className="underline text-primary"
                    >
                      {testSend.result.logId}
                    </a>
                  </div>
                </div>
              )}
              <FormField label="Recipient" required>
                <Input
                  value={testSend.recipient}
                  onChange={(e) => setTestSend((s) => ({ ...s, recipient: e.target.value }))}
                  placeholder={
                    testSendProvider?.channel === 'EMAIL' ? 'test@example.com' : '+91XXXXXXXXXX'
                  }
                />
              </FormField>
              {testSendProvider?.channel === 'EMAIL' && (
                <FormField label="Subject">
                  <Input
                    value={testSend.subject}
                    onChange={(e) => setTestSend((s) => ({ ...s, subject: e.target.value }))}
                    placeholder="Test message"
                  />
                </FormField>
              )}
              <FormField label="Message" required>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  value={testSend.message}
                  onChange={(e) => setTestSend((s) => ({ ...s, message: e.target.value }))}
                  placeholder="Hello, this is a test message."
                />
              </FormField>
            </div>
          </Modal>

          {/* Delete Confirm */}
          <ConfirmDialog
            open={!!deleteId}
            onClose={() => setDeleteId(null)}
            onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
            title="Delete Provider"
            description="This provider will be removed. Logs referencing it will retain the association. This cannot be undone."
            confirmLabel="Delete"
            variant="destructive"
          />
        </div>
      </PermissionGuard>
    </ModuleGuard>
  )
}
