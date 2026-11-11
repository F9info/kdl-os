'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, GripVertical, Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { useAdminAction, usePlans, useProviders } from '@/admin/hooks/useMembership'
import { Chips } from '../_components/BillingBits'
import type { ProviderRow } from '../_components/ProviderForm'
import {
  ProviderArchiveModal,
  ProviderDeleteModal,
  ProviderPicker,
  ProviderPublishModal,
} from '../_components/ProviderModals'
import { PROVIDER_PRESETS } from '../_components/providerPresets'
import { Card, humanize } from '../_components/ui'

const paymentsOf = (p: ProviderRow) => p.usage?.payments ?? p.payment_count ?? 0
const REGION = { INDIA: 'India', OUTSIDE_INDIA: 'Outside India', ALL: 'Everywhere' }
const TYPE = (p: ProviderRow) => (p.type === 'GATEWAY' ? 'Gateway' : 'Manual')
const STATUS_VARIANT = {
  PUBLISHED: 'active',
  DRAFT: 'pending',
  HIDDEN: 'inactive',
  ARCHIVED: 'suspended',
} as const

function PaymentMethodsContent() {
  const router = useRouter()
  const { data, isLoading, error } = useProviders()
  const { data: plans } = usePlans()
  const action = useAdminAction()
  const [chip, setChip] = useState('ALL')
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState('')
  const [publish, setPublish] = useState<ProviderRow | null>(null)
  const [del, setDel] = useState<ProviderRow | null>(null)
  const [archive, setArchive] = useState<ProviderRow | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const all = [...((data?.items ?? []) as ProviderRow[])].sort((a, b) => a.sort - b.sort)
  const count = (s: string) => all.filter((p) => p.status === s).length
  const items =
    chip === 'ALL'
      ? all.filter((p) => p.status !== 'ARCHIVED')
      : all.filter((p) => p.status === chip)
  const planNames = (p: ProviderRow) =>
    p.plan_ids?.length
      ? (plans?.items ?? [])
          .filter((x) => p.plan_ids!.includes(x.id))
          .map((x) => x.name)
          .join(', ')
      : 'All plans'
  const audience = (p: ProviderRow) =>
    [
      planNames(p),
      p.member_types.length === 1 ? humanize(p.member_types[0]!) + 's' : 'Everyone',
      REGION[p.regions],
    ].join(' · ')

  const run = (path: string, ok: string, after?: () => void) =>
    action.mutate(
      { path },
      {
        onSuccess: () => {
          toast({ title: ok })
          after?.()
        },
      }
    )

  function drop(overId: string) {
    if (!dragId || dragId === overId) return
    const ids = all.map((p) => p.id)
    ids.splice(ids.indexOf(overId), 0, ids.splice(ids.indexOf(dragId), 1)[0]!)
    action.mutate({ method: 'patch', path: 'payment-providers/order', data: { ids } })
    setDragId(null)
  }

  const published = all.filter((p) => p.status === 'PUBLISHED')
  const forPreview = (region: 'INDIA' | 'OUTSIDE_INDIA', type: 'INDIVIDUAL' | 'ORGANISATION') =>
    published.filter(
      (p) =>
        (p.regions === 'ALL' || p.regions === region) &&
        (p.member_types.length === 0 || p.member_types.includes(type))
    )
  const inactiveOutside = all.filter(
    (p) => p.status !== 'PUBLISHED' && p.status !== 'ARCHIVED' && p.regions === 'OUTSIDE_INDIA'
  )

  const Preview = ({
    title,
    list,
    note,
  }: {
    title: string
    list: ProviderRow[]
    note?: string
  }) => (
    <Card title={title}>
      <p className="-mt-3 mb-2 text-xs text-muted-foreground">What members see at checkout</p>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published provider for this audience yet.
        </p>
      ) : (
        list.map((p) => (
          <div key={p.id} className="mb-1 flex items-center gap-2 rounded-md border p-2 text-sm">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: PROVIDER_PRESETS[p.provider]?.color ?? '#64748b' }}
            >
              {PROVIDER_PRESETS[p.provider]?.letter ?? p.label.slice(0, 1)}
            </span>
            <span className="flex-1">
              <span className="block font-medium">{p.label}</span>
              {p.description && (
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              )}
            </span>
            <span className={p.is_default ? 'text-primary' : 'text-muted-foreground'}>
              {p.is_default ? '●' : '○'}
            </span>
          </div>
        ))
      )}
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </Card>
  )

  return (
    <div>
      <PageHeader
        title="Payment methods"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Payment methods — the providers members can pay with' },
        ]}
        action={
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/membership" target="_blank">
                <Eye className="h-4 w-4" /> Preview checkout
              </Link>
            </Button>
            <Button onClick={() => setPicking(true)}>
              <Plus className="h-4 w-4" /> Add payment method
            </Button>
          </div>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {action.error && !publish && !del && !archive ? <ErrorAlert error={action.error} /> : null}
      <Card
        title={`Providers · ${all.filter((p) => p.status !== 'ARCHIVED').length}`}
        action={
          <Chips
            value={chip}
            onChange={setChip}
            tabs={[
              { key: 'ALL', label: 'All' },
              { key: 'PUBLISHED', label: 'Published', count: count('PUBLISHED') },
              { key: 'DRAFT', label: 'Draft', count: count('DRAFT') },
              { key: 'HIDDEN', label: 'Hidden', count: count('HIDDEN') },
            ]}
          />
        }
      >
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Only <b>Published</b> providers appear at checkout, in this order. Drag to reorder.
        </p>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payment methods yet. Add one to take payments.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-6">
                    <span className="sr-only">Reorder</span>
                  </th>
                  <th className="py-2">Provider</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Currency</th>
                  <th>Shown to</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const preset = PROVIDER_PRESETS[p.provider]
                  const used = paymentsOf(p) > 0
                  return (
                    <tr
                      key={p.id}
                      draggable={chip === 'ALL'}
                      onDragStart={() => setDragId(p.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => drop(p.id)}
                      className="border-b last:border-0"
                    >
                      <td className="cursor-grab text-muted-foreground" aria-hidden>
                        <GripVertical className="h-4 w-4" />
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/admin/membership/payment-methods/${p.id}`}
                          className="flex min-w-56 items-center gap-3"
                        >
                          <span
                            aria-hidden
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ background: preset?.color ?? '#64748b' }}
                          >
                            {preset?.letter ?? p.label.slice(0, 1)}
                          </span>
                          <span>
                            <span className="flex items-center gap-2 font-semibold">
                              {p.label}
                              {p.is_default && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  Default
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {p.description ?? preset?.tag}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.type === 'GATEWAY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}
                        >
                          {TYPE(p)}
                        </span>
                      </td>
                      <td>
                        {p.type === 'GATEWAY' ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.mode === 'LIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}
                          >
                            {humanize(p.mode)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{p.currency}</td>
                      <td className="max-w-56 text-xs">{audience(p)}</td>
                      <td>
                        <StatusBadge
                          variant={STATUS_VARIANT[p.status]}
                          label={humanize(p.status)}
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {paymentsOf(p).toLocaleString('en-IN')} payments
                        </p>
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/membership/payment-methods/${p.id}`}>Edit</Link>
                          </Button>
                          {p.status === 'PUBLISHED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                run(`payment-providers/${p.id}/hide`, 'Provider hidden')
                              }
                            >
                              Hide
                            </Button>
                          ) : (
                            p.status !== 'ARCHIVED' && (
                              <Button size="sm" onClick={() => setPublish(p)}>
                                Publish
                              </Button>
                            )
                          )}
                          {p.status !== 'ARCHIVED' &&
                            (p.status !== 'PUBLISHED' && !used ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/40 text-destructive"
                                onClick={() => setDel(p)}
                              >
                                Delete
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setArchive(p)}>
                                Archive
                              </Button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Providers with payments can only be archived (hidden, history kept). Providers never used
          can be deleted. Keys are stored encrypted and never shown in full.
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Preview title="Individual · India" list={forPreview('INDIA', 'INDIVIDUAL')} />
        <Preview title="Organisation · India" list={forPreview('INDIA', 'ORGANISATION')} />
        <Preview
          title="Outside India"
          list={forPreview('OUTSIDE_INDIA', 'INDIVIDUAL')}
          note={
            inactiveOutside.length > 0
              ? `After ${inactiveOutside.map((p) => p.label).join(' & ')} ${inactiveOutside.length === 1 ? 'is' : 'are'} published`
              : undefined
          }
        />
        <Card title="Health · last 24 h">
          <HealthRows items={all} />
        </Card>
      </div>
      <ProviderPicker
        open={picking}
        onClose={() => setPicking(false)}
        added={all.map((p) => p.provider)}
        value={pick}
        onChange={setPick}
        onContinue={() => router.push(`/admin/membership/payment-methods/new?provider=${pick}`)}
      />
      <ProviderPublishModal
        open={publish !== null}
        onClose={() => setPublish(null)}
        label={publish?.label ?? ''}
        description={publish?.description ?? undefined}
        mode={publish?.mode ?? 'TEST'}
        regions={publish?.regions ?? 'INDIA'}
        planNames={publish ? planNames(publish).split(', ') : []}
        position={publish ? all.findIndex((x) => x.id === publish.id) + 1 : undefined}
        color={publish ? PROVIDER_PRESETS[publish.provider]?.color : undefined}
        letter={publish ? PROVIDER_PRESETS[publish.provider]?.letter : undefined}
        error={publish ? action.error : null}
        pending={action.isPending}
        onConfirm={() =>
          publish &&
          run(`payment-providers/${publish.id}/publish`, 'Provider published', () =>
            setPublish(null)
          )
        }
      />
      <ProviderDeleteModal
        provider={
          del && { label: del.label, status: humanize(del.status), mode: humanize(del.mode) }
        }
        payments={del ? paymentsOf(del) : 0}
        onClose={() => setDel(null)}
        pending={action.isPending}
        error={del ? action.error : null}
        onConfirm={() =>
          del &&
          action.mutate(
            { method: 'delete', path: `payment-providers/${del.id}` },
            {
              onSuccess: () => {
                toast({ title: 'Provider deleted' })
                setDel(null)
              },
            }
          )
        }
      />
      <ProviderArchiveModal
        label={archive?.label ?? null}
        onClose={() => setArchive(null)}
        pending={action.isPending}
        error={archive ? action.error : null}
        onConfirm={() =>
          archive &&
          run(`payment-providers/${archive.id}/archive`, 'Provider archived', () =>
            setArchive(null)
          )
        }
      />
    </div>
  )
}

/** Health card: per-provider usage figures from the API (webhooks, failed, to verify). */
function HealthRows({ items }: { items: ProviderRow[] }) {
  const h = items as Array<
    ProviderRow & {
      health?: { webhooks?: number; failed?: number; recovered?: number; to_verify?: number }
    }
  >
  const rows = h.filter((p) => p.health)
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No payment activity in the last 24 hours.</p>
    )
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((p) => (
        <li key={p.id} className="flex justify-between border-b pb-2 last:border-0">
          <span>{p.type === 'GATEWAY' ? `${p.label} webhooks` : p.label}</span>
          <span className="text-muted-foreground">
            {p.health!.webhooks != null && `${p.health!.webhooks} · verified`}
            {p.health!.failed != null &&
              `${p.health!.failed} failed · ${p.health!.recovered ?? 0} recovered`}
            {p.health!.to_verify != null && `${p.health!.to_verify} to verify`}
          </span>
        </li>
      ))}
    </ul>
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
