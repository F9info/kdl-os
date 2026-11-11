'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  rupees,
  toPaise,
  useAdminAction,
  useFieldGroups,
  useSettings,
  type AccessRule,
  type AccessTarget,
  type Benefit,
  type MemberType,
  type Plan,
  type PlanFieldGroup,
  type Price,
} from '@/admin/hooks/useMembership'
import { priceSchema, type PriceFormData } from '../_schemas'
import { Card, NativeSelect, enumOptions, humanize } from './ui'

const INTERVALS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME']
const GST_RATES = [0, 5, 12, 18, 28]

function totalWithGst(amountRupees: number, rate: number, mode: 'INCLUSIVE' | 'EXCLUSIVE') {
  return mode === 'INCLUSIVE' ? amountRupees : amountRupees * (1 + rate / 100)
}

/** The default price is the flagged one; until the API flags one, the first active price. */
export function defaultPriceId(prices: Price[]) {
  return (prices.find((p) => p.is_default && p.is_active) ?? prices.find((p) => p.is_active))?.id
}

/** Native HTML5 drag-reorder for a list; returns handlers for each row. */
function useDragList<T>(items: T[], setItems: (n: T[]) => void) {
  const [from, setFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return {
    over,
    from,
    row: (i: number) => ({
      draggable: true,
      onDragStart: () => setFrom(i),
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        setOver(i)
      },
      onDragEnd: () => {
        setFrom(null)
        setOver(null)
      },
      onDrop: () => {
        if (from !== null && from !== i) {
          const n = [...items]
          const [m] = n.splice(from, 1)
          n.splice(i, 0, m!)
          setItems(n)
        }
        setFrom(null)
        setOver(null)
      },
    }),
  }
}

export function PricingTab({ plan }: { plan: Plan }) {
  const action = useAdminAction()
  const { data: settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const [makeDefault, setMakeDefault] = useState(false)
  const prices = plan.prices ?? []
  const defId = defaultPriceId(prices)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PriceFormData>({
    resolver: zodResolver(priceSchema),
    defaultValues: { interval: 'YEARLY', amount: 0, gst_rate: 18, tax_mode: 'EXCLUSIVE' },
  })
  const [amount, rate, mode] = watch(['amount', 'gst_rate', 'tax_mode'])
  const gst = mode === 'EXCLUSIVE' ? (amount || 0) * ((rate || 0) / 100) : 0

  function onSubmit(v: PriceFormData) {
    action.mutate(
      {
        path: `plans/${plan.id}/prices`,
        data: { ...v, amount: toPaise(v.amount), is_active: visible, is_default: makeDefault },
      },
      {
        onSuccess: () => {
          toast({ title: 'Price added' })
          setOpen(false)
          reset()
        },
      }
    )
  }

  const patchPrice = (id: string, data: Record<string, unknown>, title: string) =>
    action.mutate(
      { method: 'patch', path: `prices/${id}`, data },
      { onSuccess: () => toast({ title }) }
    )

  return (
    <>
      <Card
        title="Prices"
        action={
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add price
          </Button>
        }
      >
        {prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-muted-foreground">
                {[
                  'Interval',
                  'Amount',
                  'GST',
                  'Tax mode',
                  'Customer pays',
                  'Default',
                  'Status',
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-3">{humanize(p.interval)}</td>
                  <td className="px-3">{rupees(p.amount)}</td>
                  <td className="px-3">{p.gst_rate}%</td>
                  <td className="px-3">{humanize(p.tax_mode)}</td>
                  <td className="px-3 font-semibold">
                    {rupees(Math.round(totalWithGst(p.amount, p.gst_rate, p.tax_mode)))}
                  </td>
                  <td className="px-3">
                    {p.id === defId ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Default
                      </span>
                    ) : p.is_active ? (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Make ${humanize(p.interval)} default`}
                        onClick={() =>
                          patchPrice(p.id, { is_default: true }, 'Default price changed')
                        }
                      >
                        —
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3">
                    <button
                      type="button"
                      aria-label={`${p.is_active ? 'Hide' : 'Show'} ${humanize(p.interval)} price`}
                      onClick={() =>
                        patchPrice(
                          p.id,
                          { is_active: !p.is_active },
                          p.is_active ? 'Price hidden' : 'Price shown'
                        )
                      }
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        p.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {p.is_active ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${humanize(p.interval)} price`}
                      onClick={() => action.mutate({ method: 'delete', path: `prices/${p.id}` })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Tax">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Default GST rate</dt>
            <dd className="font-medium">{settings?.general.gst_rate_default ?? 18}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tax mode</dt>
            <dd className="font-medium">Set per price (exclusive adds GST at checkout)</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seller details</dt>
            <dd>
              <Link href="/admin/membership/settings" className="text-primary">
                Settings
              </Link>
            </dd>
          </div>
        </dl>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add price"
        description={`${plan.name} plan`}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
              Add price
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Billing interval">
            <NativeSelect options={enumOptions(INTERVALS)} {...register('interval')} />
          </FormField>
          <FormField label="Amount (INR)" error={errors.amount?.message}>
            <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="GST">
              <NativeSelect
                options={GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
                {...register('gst_rate', { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Tax mode">
              <NativeSelect
                options={[
                  { value: 'EXCLUSIVE', label: 'Exclusive' },
                  { value: 'INCLUSIVE', label: 'Inclusive' },
                ]}
                {...register('tax_mode')}
              />
            </FormField>
          </div>
          {mode === 'EXCLUSIVE' && (
            <p className="flex justify-between text-sm text-muted-foreground">
              <span>
                CGST {(rate || 0) / 2}% + SGST {(rate || 0) / 2}%
              </span>
              <span>{rupees(toPaise(gst))}</span>
            </p>
          )}
          <p className="flex justify-between text-sm font-medium">
            <span>Customer pays</span>
            <span>{rupees(toPaise(totalWithGst(amount || 0, rate || 0, mode)))}</span>
          </p>
          <label className="flex items-center justify-between text-sm">
            Show on pricing page
            <Switch
              aria-label="Show on pricing page"
              checked={visible}
              onCheckedChange={setVisible}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            Make default
            <Switch
              aria-label="Make default"
              checked={makeDefault}
              onCheckedChange={setMakeDefault}
            />
          </label>
          {action.error && <ErrorAlert error={action.error} />}
        </form>
      </Modal>
    </>
  )
}

export function BenefitsTab({ plan }: { plan: Plan }) {
  const action = useAdminAction()
  const [items, setItems] = useState<Benefit[]>(plan.benefits ?? [])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Benefit>({ text: '', description: '', highlighted: false })
  const drag = useDragList(items, setItems)
  const patch = (i: number, p: Partial<Benefit>) =>
    setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)))
  return (
    <Card
      title="Benefits (drag to reorder)"
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add benefit
        </Button>
      }
    >
      {items.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No benefits yet.</p>}
      <ul className="mb-4 space-y-2">
        {items.map((b, i) => (
          <li
            key={b.id ?? i}
            {...drag.row(i)}
            className={cn(
              'flex items-center gap-3 rounded-md border p-3',
              drag.from === i && 'opacity-40',
              drag.over === i && drag.from !== i && 'bg-muted'
            )}
          >
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" aria-hidden />
            <div className="flex-1 space-y-1">
              <Input
                aria-label={`Benefit ${i + 1}`}
                value={b.text}
                onChange={(e) => patch(i, { text: e.target.value })}
              />
              <Input
                aria-label={`Benefit ${i + 1} description`}
                placeholder="Description"
                className="h-8 text-xs"
                value={b.description ?? ''}
                onChange={(e) => patch(i, { description: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={b.highlighted}
                onChange={(e) => patch(i, { highlighted: e.target.checked })}
              />
              Highlight
            </label>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove benefit"
              onClick={() => setItems((l) => l.filter((_, k) => k !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {action.error && <ErrorAlert error={action.error} />}
      <Button
        disabled={action.isPending}
        onClick={() =>
          action.mutate(
            {
              method: 'put',
              path: `plans/${plan.id}/benefits`,
              data: items.map((b, sort) => ({
                text: b.text,
                description: b.description || undefined,
                highlighted: b.highlighted,
                sort,
              })),
            },
            { onSuccess: () => toast({ title: 'Benefits saved' }) }
          )
        }
      >
        Save benefits
      </Button>
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add benefit"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.text.trim()}
              onClick={() => {
                setItems((l) => [...l, { ...draft, text: draft.text.trim() }])
                setDraft({ text: '', description: '', highlighted: false })
                setAdding(false)
              }}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Label" required>
            <Input
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          </FormField>
          <FormField label="Description">
            <Input
              value={draft.description ?? ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </FormField>
          <label className="flex items-center justify-between text-sm">
            Highlight on card
            <Switch
              aria-label="Highlight on card"
              checked={draft.highlighted}
              onCheckedChange={(v) => setDraft({ ...draft, highlighted: v })}
            />
          </label>
        </div>
      </Modal>
    </Card>
  )
}

const STEPS: Array<{ title: string; note: string; orgOnly?: boolean }> = [
  { title: 'Account', note: 'Social login or email' },
  { title: 'Joining as', note: 'Individual or Organisation' },
  { title: 'Details', note: 'Professional — or Business details' },
  { title: 'Documents', note: 'Organisations only', orgOnly: true },
  { title: 'Contacts', note: 'Organisations only', orgOnly: true },
  { title: 'Review & pay', note: 'GST invoice to the member or company' },
]

export function JoinFormTab({ plan }: { plan: Plan }) {
  const action = useAdminAction()
  const { data: groups } = useFieldGroups()
  const [rows, setRows] = useState<PlanFieldGroup[]>(plan.field_groups ?? [])
  const has = (g: string, t: MemberType) =>
    rows.find((r) => r.group_id === g && r.member_type === t)
  const toggle = (g: string, t: MemberType, on: boolean) =>
    setRows((l) =>
      on
        ? [...l, { group_id: g, member_type: t, required: false }]
        : l.filter((r) => !(r.group_id === g && r.member_type === t))
    )
  const setRequired = (g: string, t: MemberType, required: boolean) =>
    setRows((l) => l.map((r) => (r.group_id === g && r.member_type === t ? { ...r, required } : r)))
  const orgAllowed = plan.member_types.includes('ORGANISATION')
  const choice = plan.member_types.length > 1 ? 'BOTH' : plan.member_types[0]
  return (
    <>
      <Card
        title={`What ${plan.name} asks when someone joins`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/membership/settings">
              <Plus className="h-4 w-4" /> Add pack
            </Link>
          </Button>
        }
      >
        <div className="mb-4 flex items-center gap-3 text-sm">
          <span>Who can join</span>
          <div
            role="group"
            aria-label="Who can join"
            className="inline-flex overflow-hidden rounded-md border"
          >
            {[
              ['INDIVIDUAL', 'Individual', ['INDIVIDUAL']],
              ['ORGANISATION', 'Organisation', ['ORGANISATION']],
              ['BOTH', 'Both', ['INDIVIDUAL', 'ORGANISATION']],
            ].map(([v, label, types]) => (
              <button
                key={v as string}
                type="button"
                aria-pressed={choice === v}
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(
                    { method: 'patch', path: `plans/${plan.id}`, data: { member_types: types } },
                    { onSuccess: () => toast({ title: 'Saved' }) }
                  )
                }
                className={cn(
                  'px-3 py-1.5',
                  choice === v ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
                )}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Pack</th>
              <th className="font-medium">For</th>
              <th className="font-medium">Fields</th>
              {plan.member_types.map((t) => (
                <th key={t} className="font-medium">
                  Ask · {humanize(t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(groups?.items ?? []).map((g) => (
              <tr key={g.id} className="border-t">
                <td className="px-3 py-3 font-medium">{g.name}</td>
                <td>{humanize(g.applies_to)}</td>
                <td>{g.fields?.length ?? 0}</td>
                {plan.member_types.map((t) => {
                  const applies = g.applies_to === 'BOTH' || g.applies_to === t
                  const row = has(g.id, t)
                  return (
                    <td key={t}>
                      {applies ? (
                        <span className="flex items-center gap-3">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              aria-label={`Ask ${g.name} for ${humanize(t)}`}
                              checked={Boolean(row)}
                              onChange={(e) => toggle(g.id, t, e.target.checked)}
                            />
                            Ask
                          </label>
                          {row && (
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={row.required}
                                onChange={(e) => setRequired(g.id, t, e.target.checked)}
                              />
                              Required
                            </label>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {action.error && <ErrorAlert error={action.error} />}
        <div className="flex gap-2">
          <Button
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                { method: 'put', path: `plans/${plan.id}/field-groups`, data: rows },
                { onSuccess: () => toast({ title: 'Join form saved' }) }
              )
            }
          >
            Save join form
          </Button>
          <Button asChild variant="outline">
            <Link href={`/membership/join/${plan.slug}`} target="_blank">
              Preview as visitor
            </Link>
          </Button>
        </div>
      </Card>
      <Card title={`Sign-up steps for ${plan.name}`}>
        <ol className="space-y-3 text-sm">
          {STEPS.filter((s) => orgAllowed || !s.orgOnly).map((s, i) => (
            <li key={s.title} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {i + 1}
              </span>
              <span className="font-medium">{s.title}</span>
              <span className="text-muted-foreground">{s.note}</span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  )
}

const TARGETS: AccessTarget[] = ['PAGE', 'SECTION', 'MEDIA', 'URL_PATTERN']

/** Access rules of one plan (also reused by the Access rules page, one rule editor for both). */
export function AccessRulesEditor({ planId, initial }: { planId: string; initial: AccessRule[] }) {
  const action = useAdminAction()
  const [rules, setRules] = useState<AccessRule[]>(initial)
  const update = (i: number, patch: Partial<AccessRule>) =>
    setRules((l) => l.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  return (
    <div>
      {rules.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No rules yet.</p>}
      <ul className="mb-4 space-y-2">
        {rules.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label={`Rule ${i + 1} type`}
              className="w-40"
              options={enumOptions(TARGETS)}
              value={r.target}
              onChange={(e) => update(i, { target: e.target.value as AccessTarget })}
            />
            <Input
              aria-label={`Rule ${i + 1} value`}
              className="w-64"
              placeholder={r.target === 'URL_PATTERN' ? '/members/*' : 'slug or id'}
              value={r.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <NativeSelect
              aria-label={`Rule ${i + 1} non-members see`}
              className="w-44"
              options={[
                { value: 'EXCERPT_CTA', label: 'Excerpt + CTA' },
                { value: 'BLUR', label: 'Blur' },
                { value: 'HIDDEN', label: 'Hidden' },
              ]}
              value={r.non_member_view ?? 'EXCERPT_CTA'}
              onChange={(e) =>
                update(i, { non_member_view: e.target.value as AccessRule['non_member_view'] })
              }
            />
            <Input
              aria-label={`Rule ${i + 1} label`}
              className="w-48"
              placeholder="Label"
              value={r.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove rule"
              onClick={() => setRules((l) => l.filter((_, k) => k !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {action.error && <ErrorAlert error={action.error} />}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setRules((l) => [...l, { target: 'PAGE', value: '', label: '' }])}
        >
          <Plus className="h-4 w-4" /> Add rule
        </Button>
        <Button
          disabled={action.isPending || rules.some((r) => !r.value.trim())}
          onClick={() =>
            action.mutate(
              {
                method: 'put',
                path: `plans/${planId}/access-rules`,
                data: rules.map((r) => ({
                  target: r.target,
                  value: r.value.trim(),
                  label: r.label || undefined,
                  non_member_view: r.non_member_view ?? 'EXCERPT_CTA',
                })),
              },
              { onSuccess: () => toast({ title: 'Access rules saved' }) }
            )
          }
        >
          Save rules
        </Button>
      </div>
    </div>
  )
}

export function AccessTab({ plan }: { plan: Plan }) {
  const action = useAdminAction()
  const save = (data: Record<string, unknown>) =>
    action.mutate(
      { method: 'patch', path: `plans/${plan.id}`, data },
      { onSuccess: () => toast({ title: 'Saved' }) }
    )
  return (
    <>
      <Card title={`Content unlocked by ${plan.name}`}>
        <AccessRulesEditor planId={plan.id} initial={plan.access_rules ?? []} />
      </Card>
      <Card>
        <div className="space-y-3 text-sm">
          <label className="flex items-center justify-between gap-4">
            <span>
              Role on activation
              <span className="block text-xs text-muted-foreground">
                Role is removed automatically when membership ends
              </span>
            </span>
            <Input
              aria-label="Role on activation"
              className="w-56"
              placeholder="Site role"
              defaultValue={plan.role_on_activation ?? ''}
              onBlur={(e) =>
                e.target.value !== (plan.role_on_activation ?? '') &&
                save({ role_on_activation: e.target.value || null })
              }
            />
          </label>
          <label className="flex items-center justify-between">
            Show &quot;{plan.name}&quot; badge on profile
            <Switch
              aria-label="Show badge on profile"
              checked={Boolean(plan.show_badge_on_profile)}
              onCheckedChange={(v) => save({ show_badge_on_profile: v })}
            />
          </label>
          <label className="flex items-center justify-between">
            Allow access during grace period
            <Switch
              aria-label="Allow access during grace period"
              checked={Boolean(plan.grace_access)}
              onCheckedChange={(v) => save({ grace_access: v })}
            />
          </label>
          {action.error && <ErrorAlert error={action.error} />}
        </div>
      </Card>
    </>
  )
}
