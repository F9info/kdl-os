'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { type AuthProvider, errorMessage, useCommAction } from '@/admin/hooks/useMembershipComm'
import { type SocialPreset } from './socialPresets'
import { Card } from './ui'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Keys form for one provider (add, edit, and the built-in keys page). Secrets are write-only:
 * a blank secret on edit means "keep what is stored".
 */
export function SocialForm({
  preset,
  provider,
  onSaved,
  embedded,
}: {
  preset: SocialPreset
  provider?: AuthProvider | null
  onSaved?: (key: string) => void
  embedded?: boolean
}) {
  const action = useCommAction()
  const key = provider?.key ?? ''
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const [v, setV] = useState({
    label: provider?.label ?? preset.label,
    button_text: provider?.button_text ?? `Continue with ${preset.label}`,
    icon: provider?.icon ?? preset.icon,
    color: provider?.color ?? preset.color,
    enabled: provider?.enabled ?? false,
    trust_email: provider?.trust_email ?? false,
    config: { ...(provider?.config ?? {}) } as Record<string, string>,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const slugKey = key || slug(v.label) || preset.preset
  const redirect = `${origin}/api/membership/auth/oauth/${slugKey}/callback`

  function build() {
    const shape: Record<string, z.ZodTypeAny> = {
      label: z.string().min(1, 'Display name is required'),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be like #334155'),
    }
    for (const f of preset.fields) {
      const need = f.required && !(f.secret && provider?.has_secret)
      shape[f.name] = need ? z.string().min(1, `${f.label} is required`) : z.string().optional()
    }
    const r = z.object(shape).safeParse({ label: v.label, color: v.color, ...v.config })
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])))
      return null
    }
    setErrors({})
    const config = Object.fromEntries(Object.entries(v.config).filter(([, val]) => val !== ''))
    return {
      key: slugKey,
      preset: preset.preset,
      type: preset.type,
      label: v.label,
      button_text: v.button_text,
      icon: v.icon,
      color: v.color,
      enabled: v.enabled,
      trust_email: v.trust_email,
      config,
    }
  }

  function save(then?: (k: string) => void) {
    const body = build()
    if (!body) return
    action.mutate(
      key
        ? { method: 'patch', path: `auth/providers/${key}`, data: body }
        : { path: 'auth/providers', data: body },
      {
        onSuccess: () => {
          toast({ title: 'Provider saved' })
          ;(then ?? onSaved)?.(body.key)
        },
      }
    )
  }
  const test = (k: string) =>
    action.mutate(
      { path: `auth/providers/${k}/test` },
      {
        onSuccess: () => toast({ title: 'Test sign-in succeeded' }),
        onError: (e) => toast({ title: errorMessage(e), variant: 'destructive' }),
      }
    )
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch })
  const isOtp = preset.type === 'OTP'

  return (
    <div className="space-y-4">
      {!embedded && (
        <Card title="Button on the website">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Display name" required error={errors.label}>
              <Input value={v.label} onChange={(e) => set({ label: e.target.value })} />
            </FormField>
            <FormField label="Button text">
              <Input value={v.button_text} onChange={(e) => set({ button_text: e.target.value })} />
            </FormField>
            <FormField label="Icon">
              <Input value={v.icon} maxLength={3} onChange={(e) => set({ icon: e.target.value })} />
            </FormField>
            <FormField label="Colour" error={errors.color}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick colour"
                  value={/^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : '#334155'}
                  onChange={(e) => set({ color: e.target.value })}
                  className="h-10 w-12 rounded border"
                />
                <Input value={v.color} onChange={(e) => set({ color: e.target.value })} />
              </div>
            </FormField>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Preview</p>
          <span className="mt-1 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ background: v.color }}
            >
              {v.icon}
            </span>
            {v.button_text}
          </span>
        </Card>
      )}
      <Card
        title={
          embedded
            ? v.label
            : `Connection (${preset.type === 'OAUTH2' ? 'OAuth 2.0' : preset.type === 'OTP' ? 'Mobile OTP' : 'OpenID Connect'})`
        }
      >
        <div className="space-y-4">
          {preset.fields.map((f) => (
            <FormField
              key={f.name}
              label={f.label}
              required={f.required}
              error={errors[f.name]}
              hint={
                f.secret && provider?.has_secret
                  ? 'Stored (encrypted). Leave blank to keep it.'
                  : undefined
              }
            >
              {f.area ? (
                <Textarea
                  rows={4}
                  value={v.config[f.name] ?? ''}
                  onChange={(e) => set({ config: { ...v.config, [f.name]: e.target.value } })}
                />
              ) : (
                <Input
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="off"
                  placeholder={f.placeholder}
                  value={v.config[f.name] ?? ''}
                  onChange={(e) => set({ config: { ...v.config, [f.name]: e.target.value } })}
                />
              )}
            </FormField>
          ))}
          {!isOtp && (
            <FormField label="Redirect URI (copy to the provider)" hint={preset.hint}>
              <Input readOnly value={redirect} onFocus={(e) => e.target.select()} />
            </FormField>
          )}
          {!isOtp && (
            <label className="flex items-center justify-between text-sm">
              <span>
                <b className="font-medium">Trust email as verified</b>
                <span className="block text-xs text-muted-foreground">
                  Skip the email-code step for this provider
                </span>
              </span>
              <Switch checked={v.trust_email} onCheckedChange={(x) => set({ trust_email: x })} />
            </label>
          )}
          <label className="flex items-center justify-between text-sm">
            <span>
              <b className="font-medium">Enabled</b>
              <span className="block text-xs text-muted-foreground">
                Turn on after a successful test
              </span>
            </span>
            <Switch checked={v.enabled} onCheckedChange={(x) => set({ enabled: x })} />
          </label>
        </div>
      </Card>
      {action.error ? <ErrorAlert error={action.error} /> : null}
      <div className="flex justify-end gap-2">
        {!isOtp && (
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() => (key ? test(key) : save(test))}
          >
            Test sign-in
          </Button>
        )}
        <Button disabled={action.isPending} onClick={() => save()}>
          {embedded ? 'Save' : 'Save provider'}
        </Button>
      </div>
    </div>
  )
}
