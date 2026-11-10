'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { useAdminAction, useProviders, type Provider } from '@/admin/hooks/useMembership'
import { ProviderForm } from '../_components/ProviderForm'
import { PROVIDER_PRESETS } from '../_components/providerPresets'
import { StatusPill, humanize } from '../_components/ui'

function PaymentMethodsContent() {
  const { data, isLoading, error } = useProviders()
  const action = useAdminAction()
  const [picking, setPicking] = useState(false)
  const [form, setForm] = useState<{ kind: string; provider?: Provider } | null>(null)
  const [archive, setArchive] = useState<Provider | null>(null)
  const items = [...(data?.items ?? [])].sort((a, b) => a.sort - b.sort)

  const run = (path: string, ok: string) =>
    action.mutate({ path }, { onSuccess: () => toast({ title: ok }) })

  function move(i: number, d: number) {
    const ids = items.map((p) => p.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    action.mutate({ method: 'patch', path: 'payment-providers/order', data: { ids } })
  }

  return (
    <div>
      <PageHeader
        title="Payment methods"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Payment methods' },
        ]}
        action={
          <Button onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" /> Add provider
          </Button>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {action.error && <ErrorAlert error={action.error} />}
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No payment methods yet. Add one to take payments.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">
                  {p.label}
                  {p.is_default && <span className="ml-2 text-xs text-primary">Default</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PROVIDER_PRESETS[p.provider]?.label ?? humanize(p.provider)} · {humanize(p.type)}
                  {p.type === 'GATEWAY' && ` · ${humanize(p.mode)} mode`}
                  {p.last_test_at &&
                    ` · tested ${formatDate(p.last_test_at)} ${p.last_test_ok ? 'OK' : 'failed'}`}
                </p>
              </div>
              <StatusPill status={p.status} />
              <div className="flex flex-wrap gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${p.label} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${p.label} down`}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${p.label}`}
                  onClick={() => setForm({ kind: p.provider, provider: p })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {p.type === 'GATEWAY' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(`payment-providers/${p.id}/test`, 'Test sent')}
                  >
                    Test
                  </Button>
                )}
                {p.status === 'PUBLISHED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(`payment-providers/${p.id}/hide`, 'Provider hidden')}
                  >
                    Hide
                  </Button>
                ) : (
                  p.status !== 'ARCHIVED' && (
                    <Button
                      size="sm"
                      onClick={() => run(`payment-providers/${p.id}/publish`, 'Provider published')}
                    >
                      Publish
                    </Button>
                  )
                )}
                {p.status !== 'ARCHIVED' && (
                  <Button size="sm" variant="outline" onClick={() => setArchive(p)}>
                    Archive
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={picking} onClose={() => setPicking(false)} title="Add provider">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
            <Button
              key={key}
              variant="outline"
              className="justify-start"
              onClick={() => {
                setPicking(false)
                setForm({ kind: key })
              }}
            >
              {p.label}
              <span className="ml-auto text-xs text-muted-foreground">{humanize(p.type)}</span>
            </Button>
          ))}
        </div>
      </Modal>
      <ProviderForm
        kind={form?.kind ?? null}
        provider={form?.provider}
        onClose={() => setForm(null)}
      />
      <ConfirmDialog
        open={archive !== null}
        onClose={() => setArchive(null)}
        title="Archive provider?"
        description="Members stop seeing it at checkout. Past payments keep their history."
        confirmLabel="Archive"
        isLoading={action.isPending}
        onConfirm={() =>
          archive &&
          action.mutate(
            { path: `payment-providers/${archive.id}/archive` },
            {
              onSuccess: () => {
                toast({ title: 'Provider archived' })
                setArchive(null)
              },
            }
          )
        }
      />
    </div>
  )
}

export default function PaymentMethodsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <PaymentMethodsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
