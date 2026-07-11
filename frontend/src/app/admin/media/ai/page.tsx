'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
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
import {
  AI_FEATURES,
  AI_FEATURE_LABELS,
  type AiFeature,
  type AiDriverDef,
  type AiProvider,
  type AiFeatureStatus,
} from '@/types/media-ai.types'

function fieldLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface ProviderFormState {
  feature: AiFeature
  driver: string
  name: string
  is_active: boolean
  credentials: Record<string, string>
  config: Record<string, string>
  replaceCredentials: boolean
}

function defaultForm(feature: AiFeature, drivers: AiDriverDef[]): ProviderFormState {
  const driver = drivers.find((d) => d.features.includes(feature))?.driver ?? ''
  return {
    feature,
    driver,
    name: '',
    is_active: false,
    credentials: {},
    config: {},
    replaceCredentials: false,
  }
}

export default function MediaAiSettingsPage() {
  const queryClient = useQueryClient()
  const [activeFeature, setActiveFeature] = useState<AiFeature>('vision')

  const { data: drivers = [] } = useQuery({
    queryKey: ['media-ai-drivers'],
    queryFn: () => api.get('/media/ai/drivers').then((r) => r.data.data.items as AiDriverDef[]),
  })

  const { data: status } = useQuery({
    queryKey: ['media-ai-status'],
    queryFn: () =>
      api.get('/media/ai/status').then((r) => r.data.data.features as Record<AiFeature, AiFeatureStatus>),
  })

  const { data: providers, isLoading } = useQuery({
    queryKey: ['media-ai-providers'],
    queryFn: () => api.get('/media/ai/providers').then((r) => r.data.data.items as AiProvider[]),
  })

  const { data: autotagEnabled } = useQuery({
    queryKey: ['media-ai-autotag-setting'],
    queryFn: () =>
      api
        .get('/settings/media.ai_autotag')
        .then((r) => r.data.data.value === 'true')
        .catch(() => false),
  })

  const autotagMutation = useMutation({
    mutationFn: (value: boolean) =>
      api.patch('/settings/media.ai_autotag', { value: String(value) }).catch(() =>
        api.post('/settings', {
          key: 'media.ai_autotag',
          value: String(value),
          type: 'boolean',
          description: 'Auto-analyze images on upload with the configured vision provider',
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-ai-autotag-setting'] })
      toast({ title: 'Auto-tag setting updated' })
    },
    onError: () => toast({ title: 'Failed to update auto-tag setting', variant: 'destructive' }),
  })

  const [providerDialog, setProviderDialog] = useState<{ open: boolean; editing: AiProvider | null }>({
    open: false,
    editing: null,
  })
  const [form, setForm] = useState<ProviderFormState>(defaultForm('vision', []))
  const [formError, setFormError] = useState<unknown>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const featureProviders = providers?.filter((p) => p.feature === activeFeature.toUpperCase()) ?? []
  const featureDrivers = drivers.filter((d) => d.features.includes(activeFeature))

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (providerDialog.editing) {
        return api.patch(`/media/ai/providers/${providerDialog.editing.id}`, payload)
      }
      return api.post('/media/ai/providers', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-ai-providers'] })
      queryClient.invalidateQueries({ queryKey: ['media-ai-status'] })
      setProviderDialog({ open: false, editing: null })
      toast({ title: providerDialog.editing ? 'Provider updated' : 'Provider created' })
    },
    onError: (err: unknown) => setFormError(err),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/media/ai/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-ai-providers'] })
      queryClient.invalidateQueries({ queryKey: ['media-ai-status'] })
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
    setForm(defaultForm(activeFeature, drivers))
    setFormError(null)
    setProviderDialog({ open: true, editing: null })
  }

  function openEdit(p: AiProvider) {
    setForm({
      feature: activeFeature,
      driver: p.driver,
      name: p.name,
      is_active: p.is_active,
      credentials: {},
      config: Object.fromEntries(Object.entries(p.config ?? {}).map(([k, v]) => [k, String(v)])),
      replaceCredentials: false,
    })
    setFormError(null)
    setProviderDialog({ open: true, editing: p })
  }

  function handleDriverChange(driver: string) {
    setForm((f) => ({ ...f, driver, credentials: {}, config: {} }))
  }

  const activeDriverDef = featureDrivers.find((d) => d.driver === form.driver)
  const credFields = activeDriverDef?.credential_fields ?? []
  const cfgFields = activeDriverDef?.config_fields ?? []
  const isEditing = !!providerDialog.editing

  function handleSave() {
    const needsCreds = !isEditing || form.replaceCredentials

    if (!form.name.trim()) {
      setFormError('Provider name is required')
      return
    }
    if (needsCreds) {
      for (const f of credFields.filter((f) => f.required)) {
        if (!form.credentials[f.key]?.trim()) {
          setFormError(`${fieldLabel(f.key)} is required`)
          return
        }
      }
    }
    for (const f of cfgFields.filter((f) => f.required)) {
      if (!form.config[f.key]?.trim()) {
        setFormError(`${fieldLabel(f.key)} is required`)
        return
      }
    }

    const payload: Record<string, unknown> = isEditing
      ? {
          name: form.name,
          is_active: form.is_active,
          config: Object.fromEntries(Object.entries(form.config).filter(([, v]) => v.trim())),
        }
      : {
          feature: form.feature,
          driver: form.driver,
          name: form.name,
          is_active: form.is_active,
          config: Object.fromEntries(Object.entries(form.config).filter(([, v]) => v.trim())),
        }

    if (needsCreds) {
      payload.credentials = { ...form.credentials }
    }

    setFormError(null)
    saveMutation.mutate(payload)
  }

  return (
    <PermissionGuard permission="media:ai-providers">
      <div>
        <PageHeader
          title="AI Providers"
          action={
            <Button size="sm" onClick={openCreate} disabled={featureDrivers.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add Provider
            </Button>
          }
        />

        {/* Feature tabs */}
        <div className="flex gap-1 mb-6 border-b">
          {AI_FEATURES.map((feature) => (
            <button
              key={feature}
              onClick={() => setActiveFeature(feature)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
                activeFeature === feature
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {AI_FEATURE_LABELS[feature]}
              {status?.[feature]?.configured && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>

        {activeFeature === 'vision' && status?.vision?.configured && (
          <div className="flex items-center gap-3 mb-6 rounded-lg border bg-card p-4">
            <Switch
              checked={!!autotagEnabled}
              onCheckedChange={(v) => autotagMutation.mutate(v)}
              id="toggle-ai-autotag"
              disabled={autotagMutation.isPending}
            />
            <div>
              <Label htmlFor="toggle-ai-autotag" className="cursor-pointer">
                Auto-tag on upload
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically analyze new images with the active vision provider and file the
                results as suggestions for review.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : featureProviders.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            No providers configured for {AI_FEATURE_LABELS[activeFeature]}. This feature is hidden
            from the media UI until a provider is added.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureProviders.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.driver}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(p)}
                      aria-label="Edit provider"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(p.id)}
                      aria-label="Delete provider"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    p.is_active
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}
                >
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={providerDialog.open}
          onClose={() => setProviderDialog({ open: false, editing: null })}
          title={isEditing ? 'Edit Provider' : 'Add Provider'}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button variant="outline" onClick={() => setProviderDialog({ open: false, editing: null })}>
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

            <FormField label="Driver" required>
              <Select value={form.driver} onValueChange={handleDriverChange} disabled={isEditing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {featureDrivers.map((d) => (
                    <SelectItem key={d.driver} value={d.driver}>
                      {d.driver}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Display Name" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. OpenRouter production"
              />
            </FormField>

            {isEditing && !form.replaceCredentials ? (
              <div className="rounded-md border p-3 bg-muted/40 space-y-2">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Credentials
                </div>
                {credFields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{fieldLabel(f.key)}</span>
                    <span className="font-mono tracking-widest text-muted-foreground">••••••••</span>
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
                    <FormField key={f.key} label={fieldLabel(f.key)} required={f.required}>
                      <Input
                        type="password"
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

            {cfgFields.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Configuration
                </div>
                {cfgFields.map((f) => (
                  <FormField key={f.key} label={fieldLabel(f.key)} required={f.required}>
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

            <div className="flex items-center gap-3 pt-1">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                id="toggle-is_active"
              />
              <Label htmlFor="toggle-is_active" className="cursor-pointer">
                Active (one active provider per feature)
              </Label>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
          title="Delete Provider"
          description="This provider will be removed. This cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
        />
      </div>
    </PermissionGuard>
  )
}
