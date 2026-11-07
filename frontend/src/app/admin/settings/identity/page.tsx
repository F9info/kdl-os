'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useDefaultProjectId } from '@/admin/hooks/useDefaultProjectId'
import { resyncBuiltWebsite } from '@/admin/hooks/useTemplateEngine'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { FormField } from '@/components/shared/FormField'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Identity = Record<string, string>
type AssetKey = 'logo_light' | 'logo_dark' | 'favicon' | 'company_logo_light' | 'company_logo_dark'
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
  {
    key: 'app_name',
    label: 'Application name',
    hint: 'Shown in the admin sidebar and login screen.',
  },
  { key: 'app_title', label: 'Browser tab title' },
  { key: 'description', label: 'Description', multiline: true },
]
const COMPANY_FIELDS = [
  {
    key: 'company_name',
    label: 'Company name',
    hint: 'Shown on your website, print layouts and landing pages. Empty = the application name.',
  },
]
const COLOR_FIELDS = [
  { key: 'brand_primary', label: 'Primary brand color' },
  { key: 'brand_secondary', label: 'Secondary brand color' },
]
const CONTACT_FIELDS = [
  { key: 'contact_email', label: 'Contact email', type: 'email' },
  { key: 'contact_email_secondary', label: 'Secondary email', type: 'email' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_phone_secondary', label: 'Secondary phone' },
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
const LOGO_LIGHT: AssetDef = { key: 'logo_light', label: 'Application logo (light background)' }
const LOGO_DARK: AssetDef = { key: 'logo_dark', label: 'Application logo (dark background)' }
const COMPANY_LOGO_LIGHT: AssetDef = {
  key: 'company_logo_light',
  label: 'Company logo (light background)',
  hint: 'Empty = the application logo.',
}
const COMPANY_LOGO_DARK: AssetDef = {
  key: 'company_logo_dark',
  label: 'Company logo (dark background)',
}
const FAVICON: AssetDef = {
  key: 'favicon',
  label: 'Favicon',
  hint: 'Square image, .ico/.png/.svg.',
}
const CONTACT_KEYS = [
  'contact_email',
  'contact_email_secondary',
  'contact_phone',
  'contact_phone_secondary',
  'contact_address',
]
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

// Server is the source of truth; this only catches the obvious cases before a round trip.
function clientErrors(f: Identity): Record<string, string> {
  const e: Record<string, string> = {}
  for (const key of ['contact_email', 'contact_email_secondary']) {
    if (f[key] && !/^\S+@\S+\.\S+$/.test(f[key])) e[key] = 'Enter a valid email.'
  }
  for (const { key } of COLOR_FIELDS) {
    if (f[key] && !HEX.test(f[key])) e[key] = 'Use a hex color like #1a2b3c.'
  }
  return e
}

// Light, dark or follow the visitor's system, for the admin panel. Lives here (core Settings) rather than
// in the Themes screens, so an install without the Themes module can still choose.
function AppearanceSection() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const { data } = useQuery({
    queryKey: ['admin-active-theme'],
    queryFn: () =>
      api
        .get('/theme-engine/tokens', { params: { platform: 'webapp_admin' } })
        .then(
          (r) => (r.data.data.activeTheme as 'light' | 'dark' | 'system' | undefined) ?? 'system'
        ),
  })
  const mutation = useMutation({
    mutationFn: (theme: string) =>
      api.post('/theme-engine/active-theme', { platform: 'webapp_admin', theme }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-theme'] })
      // The theme provider re-reads the tokens when told to.
      window.dispatchEvent(new Event('th-tokens-refresh'))
      toast({ title: 'Appearance saved' })
    },
  })
  const editable = can('theme-engine:edit')
  return (
    <section className="space-y-4 rounded-lg border bg-card p-6" aria-labelledby="id-appearance">
      <h2 id="id-appearance" className="text-lg font-semibold">
        Appearance
      </h2>
      <p className="text-sm text-muted-foreground">How the admin panel looks.</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Appearance">
        {(['light', 'dark', 'system'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            role="radio"
            aria-checked={data === mode}
            variant={data === mode ? 'default' : 'outline'}
            disabled={!editable || mutation.isPending}
            onClick={() => mutation.mutate(mode)}
          >
            {mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}
          </Button>
        ))}
      </div>
    </section>
  )
}

export default function IdentityPage() {
  const queryClient = useQueryClient()
  const { projectId } = useDefaultProjectId()
  const { can } = usePermissions()
  const [form, setForm] = useState<Identity>({})
  const [previews, setPreviews] = useState<Partial<Record<AssetKey, string>>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<unknown>(null)
  const [uploading, setUploading] = useState(false)
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
    onSuccess: (saved, payload) => {
      const before = queryClient.getQueryData<IdentityPayload>(['identity'])?.identity ?? {}
      // Phone, email and address are baked into an already-built website's pages: refresh it.
      if (projectId && CONTACT_KEYS.some((k) => (before[k] ?? '') !== (payload[k] ?? ''))) {
        resyncBuiltWebsite(projectId).catch(() => {})
      }
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
      <ImageUploadField
        name={a.key}
        value={form[a.key] ?? ''}
        previewUrl={previews[a.key] ?? ''}
        darkBackground={a.key === 'logo_dark'}
        onChange={(v) => set(a.key, v)}
        onBusyChange={setUploading}
        emptyText="None"
        setText="Image set"
      />
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
          <div className="space-y-6">
            <ErrorAlert error={formError} />

            <section
              className="space-y-4 rounded-lg border bg-card p-6"
              aria-labelledby="id-branding"
            >
              <h2 id="id-branding" className="text-lg font-semibold">
                Application
              </h2>
              <p className="text-sm text-muted-foreground">
                The admin panel itself: its name, logo and browser tab.
              </p>
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

            <section
              className="space-y-4 rounded-lg border bg-card p-6"
              aria-labelledby="id-company"
            >
              <h2 id="id-company" className="text-lg font-semibold">
                Company
              </h2>
              <p className="text-sm text-muted-foreground">
                Your business, as visitors see it on your website and print layouts.
              </p>
              {COMPANY_FIELDS.map(renderField)}
              {renderAsset(COMPANY_LOGO_LIGHT)}
              <details className="rounded border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Advanced: dark company logo
                </summary>
                <div className="mt-3">{renderAsset(COMPANY_LOGO_DARK)}</div>
              </details>
            </section>

            <AppearanceSection />

            <section
              className="space-y-4 rounded-lg border bg-card p-6"
              aria-labelledby="id-colors"
            >
              <h2 id="id-colors" className="text-lg font-semibold">
                Colors
              </h2>
              <p className="text-sm text-muted-foreground">
                Reference colours for your company. Your website&apos;s colour palette is built from
                your logo under CMS &gt; Color Palette.
              </p>
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

            <section
              className="space-y-4 rounded-lg border bg-card p-6"
              aria-labelledby="id-contact"
            >
              <h2 id="id-contact" className="text-lg font-semibold">
                Contact
              </h2>
              {CONTACT_FIELDS.map(renderField)}
            </section>

            <details className="rounded-lg border bg-card p-6">
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
                <Button onClick={handleSave} disabled={saveMutation.isPending || uploading}>
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
