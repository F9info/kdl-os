'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  rupees,
  toPaise,
  useAdminAction,
  useFieldGroups,
  type AccessRule,
  type AccessTarget,
  type Benefit,
  type MemberType,
  type Plan,
  type PlanFieldGroup,
} from '@/admin/hooks/useMembership'
import { priceSchema, type PriceFormData } from '../_schemas'
import { Card, NativeSelect, enumOptions, humanize } from './ui'

const INTERVALS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME']

function totalWithGst(amountRupees: number, rate: number, mode: 'INCLUSIVE' | 'EXCLUSIVE') {
  return mode === 'INCLUSIVE' ? amountRupees : amountRupees * (1 + rate / 100)
}

export function PricingTab({ plan }: { plan: Plan }) {
  const action = useAdminAction()
  const [open, setOpen] = useState(false)
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

  function onSubmit(v: PriceFormData) {
    action.mutate(
      { path: `plans/${plan.id}/prices`, data: { ...v, amount: toPaise(v.amount) } },
      {
        onSuccess: () => {
          toast({ title: 'Price added' })
          setOpen(false)
          reset()
        },
      }
    )
  }

  return (
    <Card
      title="Prices"
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add price
        </Button>
      }
    >
      {(plan.prices ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No prices yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Interval</th>
              <th>Amount</th>
              <th>GST</th>
              <th>Customer pays</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.prices!.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2">{humanize(p.interval)}</td>
                <td>{rupees(p.amount)}</td>
                <td>
                  {p.gst_rate}% ({humanize(p.tax_mode)})
                </td>
                <td>{rupees(Math.round(totalWithGst(p.amount, p.gst_rate, p.tax_mode)))}</td>
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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add price"
        footer={
          <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
            Add price
          </Button>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Interval">
            <NativeSelect options={enumOptions(INTERVALS)} {...register('interval')} />
          </FormField>
          <FormField label="Amount (INR)" error={errors.amount?.message}>
            <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="GST %">
              <Input type="number" {...register('gst_rate', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Tax">
              <NativeSelect
                options={[
                  { value: 'EXCLUSIVE', label: 'Added on top' },
                  { value: 'INCLUSIVE', label: 'Included' },
                ]}
                {...register('tax_mode')}
              />
            </FormField>
          </div>
          <p className="text-sm text-muted-foreground">
            Customer pays {rupees(toPaise(totalWithGst(amount || 0, rate || 0, mode)))}
          </p>
          {action.error && <ErrorAlert error={action.error} />}
        </form>
      </Modal>
    </Card>
  )
}

export function BenefitsTab({ plan }: { plan: Plan }) {
  const action = useAdminAction()
  const [items, setItems] = useState<Benefit[]>(plan.benefits ?? [])
  const [text, setText] = useState('')
  const move = (i: number, d: number) =>
    setItems((l) => {
      const n = [...l]
      const j = i + d
      if (j < 0 || j >= n.length) return l
      ;[n[i], n[j]] = [n[j]!, n[i]!]
      return n
    })
  return (
    <Card title="Benefits (shown in this order)">
      <ul className="mb-4 space-y-2">
        {items.map((b, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Benefit ${i + 1}`}
              value={b.text}
              onChange={(e) =>
                setItems((l) => l.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))
              }
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={b.highlighted}
                onChange={(e) =>
                  setItems((l) =>
                    l.map((x, k) => (k === i ? { ...x, highlighted: e.target.checked } : x))
                  )
                }
              />
              Highlight
            </label>
            <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => move(i, -1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => move(i, 1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
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
      <div className="mb-4 flex gap-2">
        <Input placeholder="Add a benefit" value={text} onChange={(e) => setText(e.target.value)} />
        <Button
          variant="outline"
          disabled={!text.trim()}
          onClick={() => {
            setItems((l) => [...l, { text: text.trim(), highlighted: false }])
            setText('')
          }}
        >
          Add
        </Button>
      </div>
      {action.error && <ErrorAlert error={action.error} />}
      <Button
        disabled={action.isPending}
        onClick={() =>
          action.mutate(
            {
              method: 'put',
              path: `plans/${plan.id}/benefits`,
              data: items.map((b, sort) => ({ text: b.text, highlighted: b.highlighted, sort })),
            },
            { onSuccess: () => toast({ title: 'Benefits saved' }) }
          )
        }
      >
        Save benefits
      </Button>
    </Card>
  )
}

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
  return (
    <Card title={`What ${plan.name} asks when someone joins`}>
      <p className="mb-3 text-sm text-muted-foreground">
        Member types allowed: {plan.member_types.map(humanize).join(', ')}. Manage packs in Settings
        → Sign-up &amp; profile.
      </p>
      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2">Pack</th>
            <th>For</th>
            <th>Fields</th>
            {plan.member_types.map((t) => (
              <th key={t}>Ask · {humanize(t)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(groups?.items ?? []).map((g) => (
            <tr key={g.id} className="border-t">
              <td className="py-2 font-medium">{g.name}</td>
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
    </Card>
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
  return (
    <Card title="Content this plan unlocks">
      <AccessRulesEditor planId={plan.id} initial={plan.access_rules ?? []} />
    </Card>
  )
}
