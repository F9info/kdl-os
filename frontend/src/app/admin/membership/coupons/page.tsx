'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/admin/hooks/usePagination'
import {
  rupees,
  useAdminAction,
  useCoupons,
  usePlans,
  type Coupon,
} from '@/admin/hooks/useMembership'
import { useDebounced, fmtDate } from '../_components/BillingBits'
import { FilterBar, NativeSelect, totalPages } from '../_components/ui'
import { StatusPill } from '../_components/ui'

const off = (c: Coupon) =>
  c.discount_type === 'PERCENT' ? `${c.value}% off` : `${rupees(c.value)} off`

type Draft = {
  code: string
  description: string
  discount_type: 'PERCENT' | 'FIXED'
  value: string
  plan_slugs: string[]
  max_redemptions: string
  per_member_limit: string
  valid_from: string
  valid_to: string
}
const EMPTY: Draft = {
  code: '',
  description: '',
  discount_type: 'PERCENT',
  value: '',
  plan_slugs: [],
  max_redemptions: '',
  per_member_limit: '1',
  valid_from: '',
  valid_to: '',
}

function CouponForm({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<Draft>(EMPTY)
  const { data: plans } = usePlans()
  const action = useAdminAction()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  // Fixed discounts are typed in rupees and stored in paise.
  const value = d.discount_type === 'FIXED' ? Math.round(Number(d.value) * 100) : Number(d.value)

  const save = () =>
    action.mutate(
      {
        path: 'coupons',
        data: {
          code: d.code,
          description: d.description || null,
          discount_type: d.discount_type,
          value,
          plan_slugs: d.plan_slugs,
          max_redemptions: d.max_redemptions ? Number(d.max_redemptions) : null,
          per_member_limit: Number(d.per_member_limit) || 1,
          valid_from: d.valid_from || null,
          valid_to: d.valid_to ? `${d.valid_to}T23:59:59` : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Coupon created', description: d.code.toUpperCase() })
          onClose()
        },
      }
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="New coupon"
      description="Members enter the code at checkout. The discount comes off the plan price before GST."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!d.code.trim() || !(value > 0) || action.isPending}>
            {action.isPending ? 'Saving…' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.error && <ErrorAlert error={action.error} />}
        <FormField label="Code" required>
          <Input
            value={d.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="WELCOME20"
            maxLength={40}
          />
        </FormField>
        <FormField label="Description (internal)">
          <Input value={d.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Discount type">
            <NativeSelect
              aria-label="Discount type"
              value={d.discount_type}
              onChange={(e) => set('discount_type', e.target.value as Draft['discount_type'])}
              options={[
                { value: 'PERCENT', label: 'Percentage' },
                { value: 'FIXED', label: 'Fixed amount (₹)' },
              ]}
            />
          </FormField>
          <FormField
            label={d.discount_type === 'PERCENT' ? 'Percent off (1 to 100)' : 'Rupees off'}
            required
          >
            <Input
              type="number"
              min={1}
              value={d.value}
              onChange={(e) => set('value', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Applies to">
          <div className="flex flex-wrap gap-2">
            {(plans?.items ?? []).map((p) => {
              const on = d.plan_slugs.includes(p.slug)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set(
                      'plan_slugs',
                      on ? d.plan_slugs.filter((s) => s !== p.slug) : [...d.plan_slugs, p.slug]
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-primary bg-primary/10 font-semibold' : ''}`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Leave all unselected to allow every plan.
          </p>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Total uses (blank = unlimited)">
            <Input
              type="number"
              min={1}
              value={d.max_redemptions}
              onChange={(e) => set('max_redemptions', e.target.value)}
            />
          </FormField>
          <FormField label="Uses per member">
            <Input
              type="number"
              min={1}
              value={d.per_member_limit}
              onChange={(e) => set('per_member_limit', e.target.value)}
            />
          </FormField>
          <FormField label="Valid from">
            <Input
              type="date"
              value={d.valid_from}
              onChange={(e) => set('valid_from', e.target.value)}
            />
          </FormField>
          <FormField label="Valid until">
            <Input
              type="date"
              value={d.valid_to}
              onChange={(e) => set('valid_to', e.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  )
}

function CouponsContent() {
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [q, setQ] = useState('')
  const [active, setActive] = useState('')
  const [adding, setAdding] = useState(false)
  const [del, setDel] = useState<Coupon | null>(null)
  const dq = useDebounced(q)
  const { data, isLoading, error } = useCoupons({ q: dq, active, page, limit })
  const action = useAdminAction()

  const toggle = (c: Coupon) =>
    action.mutate({ method: 'patch', path: `coupons/${c.id}`, data: { is_active: !c.is_active } })

  const columns = useMemo<ColumnDef<Coupon>[]>(
    () => [
      {
        header: 'Code',
        cell: ({ row: { original: c } }) => (
          <div>
            <div className="font-mono font-semibold">{c.code}</div>
            {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
          </div>
        ),
      },
      { header: 'Discount', cell: ({ row: { original: c } }) => off(c) },
      {
        header: 'Plans',
        cell: ({ row: { original: c } }) =>
          c.plan_slugs.length ? c.plan_slugs.join(', ') : 'All plans',
      },
      {
        header: 'Used',
        cell: ({ row: { original: c } }) => (
          <span>
            {c.redeemed}
            {c.max_redemptions ? ` / ${c.max_redemptions}` : ''}
            {c.discount_given > 0 && (
              <span className="block text-xs text-muted-foreground">
                {rupees(c.discount_given)} given
              </span>
            )}
          </span>
        ),
      },
      {
        header: 'Valid',
        cell: ({ row: { original: c } }) =>
          c.valid_from || c.valid_to
            ? `${c.valid_from ? fmtDate(c.valid_from) : 'Now'} to ${c.valid_to ? fmtDate(c.valid_to) : 'no end'}`
            : 'Always',
      },
      {
        header: 'Status',
        cell: ({ row: { original: c } }) => (
          <StatusPill status={c.is_active ? 'ACTIVE' : 'ARCHIVED'} />
        ),
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row: { original: c } }) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggle(c)}
              disabled={action.isPending}
            >
              {c.is_active ? 'Turn off' : 'Turn on'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDel(c)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action.isPending]
  )

  return (
    <div>
      <PageHeader
        title="Coupons"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> New coupon
          </Button>
        }
      />
      <FilterBar>
        <Input
          aria-label="Search coupons"
          className="w-72"
          placeholder="Search by code or note…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            reset()
          }}
        />
        <NativeSelect
          aria-label="Status"
          className="w-40"
          placeholder="All statuses"
          value={active}
          onChange={(e) => {
            setActive(e.target.value)
            reset()
          }}
          options={[
            { value: 'true', label: 'On' },
            { value: 'false', label: 'Off' },
          ]}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No coupons yet. Click New coupon to create a discount code."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
      />
      {adding && <CouponForm onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Delete ${del?.code}?`}
        description="A coupon that members have already used is switched off instead, so payment history keeps its reference."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (!del) return
          action.mutate(
            { method: 'delete', path: `coupons/${del.id}` },
            { onSuccess: () => toast({ title: 'Coupon removed' }) }
          )
          setDel(null)
        }}
      />
    </div>
  )
}

export default function CouponsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <CouponsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
