'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Identity = Record<string, string>
type AssetKey = 'logo_light' | 'logo_dark' | 'favicon'
interface IdentityPayload {
  identity: Identity
  resolved: Record<AssetKey, string>
}

const TEXT_FIELDS: {
  key: string
  label: string
  hint?: string
  multiline?: boolean
  type?: string
}[] = [
  { key: 'app_name', label: 'Application name', hint: 'Shown in the sidebar and login screen.' },
  { key: 'app_title', label: 'Browser tab title' },
  { key: 'description', label: 'Description', multiline: true },
]
const COLOR_FIELDS = [
  { key: 'brand_primary', label: 'Primary brand color' },
  { key: 'brand_secondary', label: 'Secondary brand color' },
]
const CONTACT_FIELDS = [
  { key: 'contact_email', label: 'Contact email', type: 'email' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_address', label: 'Address', multiline: true },
]
const SOCIAL_FIELDS = [
  { key: 'social_facebook', label: 'Facebook URL' },
  { key: 'social_x', label: 'X (Twitter) URL' },
  { key: 'social_instagram', label: 'Instagram URL' },
  { key: 'social_linkedin', label: 'LinkedIn URL' },
  { key: 'social_youtube', label: 'YouTube URL' },
]
interface AssetDef {
  key: AssetKey
  label: string
  hint?: string
}
const LOGO_LIGHT: AssetDef = { key: 'logo_light', label: 'Logo (light background)' }
const LOGO_DARK: AssetDef = { key: 'logo_dark', label: 'Logo (dark background)' }
const FAVICON: AssetDef = {
  key: 'favicon',
  label: 'Favicon',
  hint: 'Square image, .ico/.png/.svg.',
}
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

// Server is the source of truth; this only catches the obvious cases before a round trip.
function clientErrors(f: Identity): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.contact_email && !/^\S+@\S+\.\S+$/.test(f.contact_email))
    e.contact_email = 'Enter a valid email.'
  for (const { key } of COLOR_FIELDS) {
    if (f[key] && !HEX.test(f[key])) e[key] = 'Use a hex color like #1a2b3c.'
  }
  return e
}

export default function IdentityPage() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [form, setForm] = useState<Identity>({})
  const [previews, setPreviews] = useState<Partial<Record<AssetKey, string>>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<unknown>(null)
  const [uploading, setUploading] = useState<AssetKey | null>(null)
  const initialized = useRef(false)

  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['identity'],
    queryFn: () => api.get('/identity').then((r) => r.data.data as IdentityPayload),
  })

  useEffect(() => {
    if (data && !initialized.current) {
      setForm(data.identity)
      setPreviews(data.resolved)
      initialized.current = true
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload: Identity) =>
      api.put('/identity', payload).then((r) => r.data.data as IdentityPayload),
    onSuccess: (saved) => {
      queryClient.setQueryData(['identity'], saved)
      queryClient.invalidateQueries({ queryKey: ['app-config'] })
      setForm(saved.identity)
      setPreviews(saved.resolved)
      setErrors({})
      setFormError(null)
      toast({ title: 'Identity saved' })
    },
    onError: (err: unknown) => {
      const fieldErrors = (
        err as { response?: { data?: { errors?: { fieldErrors?: Record<string, string[]> } } } }
      )?.response?.data?.errors?.fieldErrors
      if (fieldErrors) {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? 'Invalid value'])
          )
        )
        setFormError('Some fields are invalid.')
      } else {
        setFormError(err)
      }
    },
  })

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function upload(key: AssetKey, file: File) {
    setUploading(key)
    setFormError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await api.post('/setting-fields/upload', body)
      const { path, url } = res.data.data as { path: string; url: string }
      set(key, path)
      setPreviews((p) => ({ ...p, [key]: url }))
    } catch (err) {
      setFormError(err)
    } finally {
      setUploading(null)
    }
  }

  function clearAsset(key: AssetKey) {
    set(key, '')
    setPreviews((p) => ({ ...p, [key]: '' }))
  }

  function handleSave() {
    const found = clientErrors(form)
    setErrors(found)
    if (Object.keys(found).length) {
      setFormError('Fix the highlighted fields.')
      return
    }
    setFormError(null)
    saveMutation.mutate(form)
  }

  const renderField = (f: {
    key: string
    label: string
    hint?: string
    multiline?: boolean
    type?: string
  }) => (
    <FormField key={f.key} label={f.label} hint={f.hint} error={errors[f.key]}>
      {f.multiline ? (
        <Textarea value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={3} />
      ) : (
        <Input
          type={f.type ?? 'text'}
          value={form[f.key] ?? ''}
          onChange={(e) => set(f.key, e.target.value)}
        />
      )}
    </FormField>
  )

  const renderAsset = (a: AssetDef) => (
    <FormField key={a.key} label={a.label} hint={a.hint} error={errors[a.key]}>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
          {previews[a.key] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews[a.key]}
              alt={`${a.label} preview`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              data-testid={`upload-${a.key}`}
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(a.key, file)
                e.target.value = ''
              }}
            />
            <span
              className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent"
              aria-disabled={uploading !== null}
            >
              {uploading === a.key ? 'Uploading…' : form[a.key] ? 'Replace' : 'Upload'}
            </span>
          </label>
          {form[a.key] && (
            <Button type="button" variant="ghost" size="sm" onClick={() => clearAsset(a.key)}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </FormField>
  )

  return (
    <PermissionGuard permission="settings:view">
      <div className="max-w-3xl">
        <PageHeader title="Application Identity" />
        <p className="mb-6 text-sm text-muted-foreground">
          Your application&apos;s name, logos and contact details. These apply across the whole
          application.
        </p>

        {isLoading ? (
          <LoadingSpinner />
        ) : loadError ? (
          <ErrorAlert error={loadError} />
        ) : (
          <div className="space-y-8">
            <ErrorAlert error={formError} />

            <section className="space-y-4" aria-labelledby="id-branding">
              <h2 id="id-branding" className="text-lg font-semibold">
                Branding
              </h2>
              {TEXT_FIELDS.map(renderField)}
              {renderAsset(LOGO_LIGHT)}
              {renderAsset(FAVICON)}
              <details className="rounded border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Advanced: dark logo
                </summary>
                <div className="mt-3">{renderAsset(LOGO_DARK)}</div>
              </details>
            </section>

            <section className="space-y-4" aria-labelledby="id-colors">
              <h2 id="id-colors" className="text-lg font-semibold">
                Colors
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {COLOR_FIELDS.map((f) => (
                  <FormField key={f.key} label={f.label} error={errors[f.key]}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${f.label} picker`}
                        className="h-9 w-12 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                        value={
                          /^#[0-9a-f]{6}$/i.test(form[f.key] ?? '')
                            ? (form[f.key] as string)
                            : '#000000'
                        }
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                      <Input
                        value={form[f.key] ?? ''}
                        placeholder="#1a2b3c"
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    </div>
                  </FormField>
                ))}
              </div>
            </section>

            <section className="space-y-4" aria-labelledby="id-contact">
              <h2 id="id-contact" className="text-lg font-semibold">
                Contact
              </h2>
              {CONTACT_FIELDS.map(renderField)}
            </section>

            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Advanced: social links and legal
              </summary>
              <div className="mt-4 space-y-4">
                {SOCIAL_FIELDS.map(renderField)}
                {renderField({ key: 'copyright', label: 'Copyright notice' })}
              </div>
            </details>

            {can('settings:edit') && (
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || uploading !== null}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save identity'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
