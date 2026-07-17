'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, RotateCcw, HardDrive, FlaskConical } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Provider = 'local' | 'minio' | 's3' | 'spaces' | 'r2'

const PROVIDERS: { value: Provider; label: string; description: string }[] = [
  {
    value: 'local',
    label: 'Local Filesystem',
    description:
      'Store files on the server filesystem. Good for development and single-server deployments.',
  },
  { value: 'minio', label: 'MinIO', description: 'Self-hosted S3-compatible object storage.' },
  { value: 's3', label: 'Amazon S3', description: 'AWS Simple Storage Service.' },
  {
    value: 'spaces',
    label: 'DigitalOcean Spaces',
    description: 'S3-compatible object storage by DigitalOcean. Region auto-derives the endpoint.',
  },
  {
    value: 'r2',
    label: 'Cloudflare R2',
    description: 'Zero-egress-fee object storage. Requires R2_ACCOUNT_ID in server env.',
  },
]

type FieldKey = 'endpoint' | 'region' | 'bucket' | 'accessKey' | 'secretKey'

interface FieldDef {
  key: FieldKey
  label: string
  placeholder?: string
  hint?: string
  required: boolean
  isSecret: boolean
}

const PROVIDER_FIELDS: Record<Provider, FieldDef[]> = {
  local: [],
  minio: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      placeholder: 'http://minio:9000',
      hint: 'MinIO server URL including port.',
      required: true,
      isSecret: false,
    },
    { key: 'bucket', label: 'Bucket', placeholder: 'my-bucket', required: true, isSecret: false },
    { key: 'accessKey', label: 'Access Key', placeholder: '', required: true, isSecret: true },
    { key: 'secretKey', label: 'Secret Key', placeholder: '', required: true, isSecret: true },
  ],
  s3: [
    { key: 'region', label: 'Region', placeholder: 'us-east-1', required: true, isSecret: false },
    { key: 'bucket', label: 'Bucket', placeholder: 'my-bucket', required: true, isSecret: false },
    { key: 'accessKey', label: 'Access Key ID', placeholder: '', required: true, isSecret: true },
    {
      key: 'secretKey',
      label: 'Secret Access Key',
      placeholder: '',
      required: true,
      isSecret: true,
    },
  ],
  spaces: [
    {
      key: 'region',
      label: 'Region',
      placeholder: 'nyc3',
      hint: 'DigitalOcean region slug (e.g. nyc3, sfo3, ams3). Endpoint is auto-derived.',
      required: true,
      isSecret: false,
    },
    {
      key: 'bucket',
      label: 'Bucket / Space Name',
      placeholder: 'my-space',
      required: true,
      isSecret: false,
    },
    {
      key: 'accessKey',
      label: 'Spaces Access Key',
      placeholder: '',
      required: true,
      isSecret: true,
    },
    {
      key: 'secretKey',
      label: 'Spaces Secret Key',
      placeholder: '',
      required: true,
      isSecret: true,
    },
  ],
  r2: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      placeholder: 'https://<account-id>.r2.cloudflarestorage.com',
      hint: 'R2 endpoint from your Cloudflare dashboard.',
      required: true,
      isSecret: false,
    },
    { key: 'bucket', label: 'Bucket', placeholder: 'my-bucket', required: true, isSecret: false },
    { key: 'accessKey', label: 'Access Key ID', placeholder: '', required: true, isSecret: true },
    {
      key: 'secretKey',
      label: 'Secret Access Key',
      placeholder: '',
      required: true,
      isSecret: true,
    },
  ],
}

interface StorageSettings {
  provider: Provider | null
  endpoint: string | null
  region: string | null
  bucket: string | null
  accessKey: string | null
  secretKey: string | null
  isConfigured: boolean
}

interface FormState {
  provider: Provider | ''
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  replaceSecrets: boolean
}

interface TestResult {
  ok: boolean
  provider: string
  bucket: string
  message: string
}

function settingsToForm(data: StorageSettings): FormState {
  return {
    provider: data.provider ?? '',
    endpoint: data.endpoint ?? '',
    region: data.region ?? '',
    bucket: data.bucket ?? '',
    accessKey: '',
    secretKey: '',
    replaceSecrets: false,
  }
}

export default function StorageSettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>({
    provider: '',
    endpoint: '',
    region: '',
    bucket: '',
    accessKey: '',
    secretKey: '',
    replaceSecrets: false,
  })
  const [formError, setFormError] = useState<unknown>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testError, setTestError] = useState<unknown>(null)
  const initialized = useRef(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['storage-settings'],
    queryFn: () => api.get('/storage-settings').then((r) => r.data.data as StorageSettings),
  })

  useEffect(() => {
    if (settings && !initialized.current) {
      setForm(settingsToForm(settings))
      initialized.current = true
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put('/storage-settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-settings'] })
      toast({ title: 'Storage settings saved' })
      setFormError(null)
      setForm((prev) => ({ ...prev, accessKey: '', secretKey: '', replaceSecrets: false }))
    },
    onError: (err: unknown) => {
      setFormError(err)
    },
  })

  const testMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/storage-settings/test', payload).then((r) => r.data.data as TestResult),
    onSuccess: (data: TestResult) => {
      setTestResult(data)
      setTestError(null)
    },
    onError: (err: unknown) => {
      setTestError(err)
      setTestResult(null)
    },
  })

  const currentProvider = form.provider as Provider | ''
  const fields = currentProvider ? PROVIDER_FIELDS[currentProvider] : []
  const secretFields = fields.filter((f) => f.isSecret)
  const nonSecretFields = fields.filter((f) => !f.isSecret)
  const hasSecrets = secretFields.length > 0
  const hasExistingSecrets =
    settings?.isConfigured && settings.provider === currentProvider && hasSecrets
  const showSecretInputs = !hasExistingSecrets || form.replaceSecrets

  function setFormField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  function buildTestPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = { provider: currentProvider }
    if (currentProvider !== 'local') {
      payload.endpoint = form.endpoint || null
      payload.region = form.region || null
      payload.bucket = form.bucket || null
      if (showSecretInputs && form.accessKey) payload.accessKey = form.accessKey
      if (showSecretInputs && form.secretKey) payload.secretKey = form.secretKey
    }
    return payload
  }

  function handleSave() {
    if (!currentProvider) {
      setFormError('Select a storage provider.')
      return
    }

    if (currentProvider !== 'local') {
      for (const f of nonSecretFields.filter((f) => f.required)) {
        const val = form[f.key as keyof FormState] as string
        if (!val?.trim()) {
          setFormError(`${f.label} is required.`)
          return
        }
      }
      if (showSecretInputs) {
        for (const f of secretFields.filter((f) => f.required && !hasExistingSecrets)) {
          const val = form[f.key as keyof FormState] as string
          if (!val?.trim()) {
            setFormError(`${f.label} is required.`)
            return
          }
        }
      }
    }

    const payload: Record<string, unknown> = { provider: currentProvider }
    if (currentProvider !== 'local') {
      payload.endpoint = form.endpoint || null
      payload.region = form.region || null
      payload.bucket = form.bucket || null
      if (showSecretInputs) {
        if (form.accessKey || !hasExistingSecrets) payload.accessKey = form.accessKey || null
        if (form.secretKey || !hasExistingSecrets) payload.secretKey = form.secretKey || null
      }
    }

    setFormError(null)
    setTestResult(null)
    setTestError(null)
    saveMutation.mutate(payload)
  }

  function handleTest() {
    if (!currentProvider) {
      setTestError('Select a provider before testing.')
      return
    }
    if (currentProvider !== 'local') {
      for (const f of nonSecretFields.filter((f) => f.required)) {
        const val = form[f.key as keyof FormState] as string
        if (!val?.trim()) {
          setTestError(`${f.label} is required.`)
          return
        }
      }
      if (showSecretInputs) {
        for (const f of secretFields.filter((f) => f.required && !hasExistingSecrets)) {
          const val = form[f.key as keyof FormState] as string
          if (!val?.trim()) {
            setTestError(`${f.label} is required.`)
            return
          }
        }
      }
    }
    setTestResult(null)
    setTestError(null)
    testMutation.mutate(buildTestPayload())
  }

  return (
    <PermissionGuard permission="settings:view">
      <div>
        <PageHeader title="Storage Settings" />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <ErrorAlert error={formError} />

            <FormField label="Storage Provider" required>
              <Select
                value={form.provider}
                onValueChange={(v) => {
                  const newProvider = v as Provider
                  const isSaved = settings?.provider === newProvider && settings?.isConfigured
                  setForm((f) => ({
                    ...f,
                    provider: newProvider,
                    endpoint: isSaved ? (settings?.endpoint ?? '') : '',
                    region: isSaved ? (settings?.region ?? '') : '',
                    bucket: isSaved ? (settings?.bucket ?? '') : '',
                    accessKey: '',
                    secretKey: '',
                    replaceSecrets: false,
                  }))
                  setTestResult(null)
                  setTestError(null)
                  setFormError(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider…" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentProvider && (
                <p className="text-xs text-muted-foreground">
                  {PROVIDERS.find((p) => p.value === currentProvider)?.description}
                </p>
              )}
            </FormField>

            {currentProvider === 'local' && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground mb-1">
                  <HardDrive className="h-4 w-4" />
                  Local Filesystem
                </div>
                Files are stored on the server and served via HMAC-signed URLs. No credentials
                required.
              </div>
            )}

            {currentProvider && currentProvider !== 'local' && (
              <>
                {nonSecretFields.map((f) => (
                  <FormField key={f.key} label={f.label} required={f.required} hint={f.hint}>
                    <Input
                      value={form[f.key as keyof FormState] as string}
                      onChange={(e) => setFormField(f.key as keyof FormState, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  </FormField>
                ))}

                {hasSecrets && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Credentials
                    </div>

                    {!showSecretInputs ? (
                      <div className="rounded-md border p-3 bg-muted/40 space-y-2">
                        {secretFields.map((f) => (
                          <div key={f.key} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{f.label}</span>
                            <span className="font-mono tracking-widest text-muted-foreground">
                              {settings?.accessKey && f.key === 'accessKey'
                                ? settings.accessKey
                                : '••••••••'}
                            </span>
                          </div>
                        ))}
                        <PermissionGuard permission="settings:edit">
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setForm((f) => ({ ...f, replaceSecrets: true }))}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Replace Credentials
                          </Button>
                        </PermissionGuard>
                      </div>
                    ) : (
                      secretFields.map((f) => (
                        <FormField
                          key={f.key}
                          label={f.label}
                          required={f.required && !hasExistingSecrets}
                          hint={
                            hasExistingSecrets ? 'Leave blank to keep existing value.' : undefined
                          }
                        >
                          <Input
                            type="password"
                            value={form[f.key as keyof FormState] as string}
                            onChange={(e) => setFormField(f.key as keyof FormState, e.target.value)}
                            autoComplete="new-password"
                          />
                        </FormField>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {testResult && (
              <div
                className={cn(
                  'rounded-md border p-3 text-sm flex items-start gap-2',
                  testResult.ok
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                    : 'bg-destructive/10 border-destructive/20'
                )}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <span
                  className={
                    testResult.ok ? 'text-green-800 dark:text-green-300' : 'text-destructive'
                  }
                >
                  {testResult.message}
                </span>
              </div>
            )}

            <ErrorAlert error={testError} />

            {currentProvider && (
              <PermissionGuard permission="settings:edit">
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
                  </Button>
                  {currentProvider !== 'local' && (
                    <Button
                      variant="outline"
                      onClick={handleTest}
                      disabled={testMutation.isPending}
                    >
                      <FlaskConical className="h-4 w-4 mr-1.5" />
                      {testMutation.isPending ? 'Testing…' : 'Test Connection'}
                    </Button>
                  )}
                </div>
              </PermissionGuard>
            )}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
