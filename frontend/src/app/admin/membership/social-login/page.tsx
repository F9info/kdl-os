'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  useAuthProviders,
  useCommAction,
  errorMessage,
  type AuthProvider,
} from '@/admin/hooks/useMembershipComm'
import { Guarded } from '../_components/CommShell'
import { ADD_PRESETS, SOCIAL_PRESETS, presetOf } from '../_components/socialPresets'

const Mark = ({ p }: { p: AuthProvider }) => (
  <span
    className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-bold text-white"
    style={{ background: p.color ?? presetOf(p)?.color ?? '#334155' }}
  >
    {p.icon ?? presetOf(p)?.icon ?? p.label.charAt(0)}
  </span>
)

function SocialContent() {
  const router = useRouter()
  const { data, isLoading, error } = useAuthProviders()
  const action = useCommAction()
  const [adding, setAdding] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const items = [...(data?.items ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))

  const toggle = (p: AuthProvider, enabled: boolean) =>
    action.mutate(
      { method: 'patch', path: `auth/providers/${p.key}`, data: { enabled } },
      { onError: (e) => toast({ title: errorMessage(e), variant: 'destructive' }) }
    )
  function drop(onto: string) {
    if (!drag || drag === onto) return
    const keys = items.map((p) => p.key).filter((k) => k !== drag)
    keys.splice(
      keys.indexOf(onto) +
        (items.findIndex((p) => p.key === drag) < items.findIndex((p) => p.key === onto) ? 1 : 0),
      0,
      drag
    )
    action.mutate({ method: 'put', path: 'auth/providers/reorder', data: { keys } })
    setDrag(null)
  }
  const status = (p: AuthProvider) => p.status ?? (p.has_secret ? 'Connected' : 'Keys missing')

  return (
    <div>
      <PageHeader
        title="Social login"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Social login' },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/membership/social-login/keys">Built-in keys</Link>
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add provider
            </Button>
          </div>
        }
      />
      <p className="-mt-4 mb-5 text-sm text-muted-foreground">
        Providers shown on the website sign-up and login
      </p>
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No providers yet. Add one to let members sign in with it.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Members</th>
                  <th className="px-3 py-2 font-medium">Enabled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.key}
                    draggable
                    onDragStart={() => setDrag(p.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => drop(p.key)}
                    className="border-b last:border-0"
                  >
                    <td className="pl-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4 cursor-grab" aria-label="Drag to reorder" />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <Mark p={p} />
                        <b className="font-semibold">{p.label}</b>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {presetOf(p)?.builtin
                          ? 'Built-in'
                          : `Added · ${p.type === 'OAUTH2' ? 'OAuth 2.0' : 'OpenID Connect'}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${status(p) === 'Keys missing' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {status(p)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.members != null ? p.members.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Switch
                        aria-label={`Enable ${p.label}`}
                        checked={p.enabled}
                        onCheckedChange={(v) => toggle(p, v)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/membership/social-login/${p.key}`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Website preview — login buttons</h3>
          <div className="flex flex-wrap gap-2">
            {items
              .filter((p) => p.enabled)
              .map((p) => (
                <span
                  key={p.key}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                >
                  <Mark p={p} />
                  {p.label}
                </span>
              ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Drag rows to change button order. Only enabled providers are shown.
          </p>
        </>
      )}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add provider"
        description="Pick a preset. You can connect any OpenID Connect or OAuth 2.0 provider."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {ADD_PRESETS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => router.push(`/admin/membership/social-login/new?preset=${k}`)}
              className="flex items-center gap-2 rounded-lg border p-3 text-left text-sm hover:bg-accent"
            >
              <span
                className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-bold text-white"
                style={{ background: SOCIAL_PRESETS[k]!.color }}
              >
                {SOCIAL_PRESETS[k]!.icon || ''}
              </span>
              {SOCIAL_PRESETS[k]!.label}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default function SocialLoginPage() {
  return (
    <Guarded>
      <SocialContent />
    </Guarded>
  )
}
