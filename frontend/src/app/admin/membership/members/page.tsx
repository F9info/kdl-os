'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Plus, Upload } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePagination } from '@/admin/hooks/usePagination'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { rupees, useMembers, usePlans, type Member } from '@/admin/hooks/useMembership'
import { AddMemberModal } from '../_components/AddMemberModal'
import { ImportWizard } from '../_components/ImportWizard'
import {
  ActionModal,
  FilterBar,
  NativeSelect,
  StatusPill,
  enumOptions,
  totalPages,
} from '../_components/ui'

const STATUSES = [
  'ACTIVE',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'PAST_DUE',
  'EXPIRED',
  'CANCELLED',
  'SUSPENDED',
  'REJECTED',
]

const EMPTY_FILTERS = {
  q: '',
  status: '',
  plan_id: '',
  member_type: '',
  member_since_from: '',
  member_since_to: '',
  valid_till_from: '',
  valid_till_to: '',
}

async function downloadCsv(params: Record<string, string>) {
  const res = await api.get('/membership/admin/members/export', {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'members.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function MembersContent() {
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [bulk, setBulk] = useState<'tag' | 'change-plan' | null>(null)
  const { data, isLoading, error } = useMembers({ ...filters, page, limit })
  const { data: plans } = usePlans()

  const set = (k: keyof typeof EMPTY_FILTERS) => (v: string) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setSelected([])
    reset()
  }
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const columns: ColumnDef<Member>[] = [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={Boolean(data?.items.length) && selected.length === data?.items.length}
          onChange={(e) =>
            setSelected(e.target.checked ? (data?.items ?? []).map((m) => m.id) : [])
          }
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.full_name}`}
          checked={selected.includes(row.original.id)}
          onChange={() => toggle(row.original.id)}
        />
      ),
    },
    {
      header: 'Member',
      cell: ({ row: { original: m } }) => (
        <div>
          <Link href={`/admin/membership/members/${m.id}`} className="font-medium hover:underline">
            {m.legal_name || m.full_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {m.member_type === 'ORGANISATION'
              ? `Organisation · ${m.full_name}${m.contacts?.length ? ` + ${m.contacts.length} contacts` : ''}`
              : m.email}
          </p>
        </div>
      ),
    },
    { header: 'Member no.', cell: ({ row }) => row.original.member_no ?? '—' },
    {
      header: 'Plan',
      cell: ({ row: { original: m } }) =>
        m.subscription
          ? `${m.subscription.plan?.name ?? ''}${m.subscription.price ? ` · ${m.subscription.price.interval.toLowerCase()}` : ''}`
          : '—',
    },
    {
      header: 'Status',
      cell: ({ row }) =>
        row.original.subscription ? <StatusPill status={row.original.subscription.status} /> : '—',
    },
    {
      header: 'Member since',
      cell: ({ row }) => (row.original.member_since ? formatDate(row.original.member_since) : '—'),
    },
    {
      header: 'Valid till',
      cell: ({ row }) =>
        row.original.subscription?.ends_at ? formatDate(row.original.subscription.ends_at) : '—',
    },
    { header: 'Lifetime paid', cell: ({ row }) => rupees(row.original.lifetime_paid) },
  ]

  return (
    <div>
      <PageHeader
        title="Members"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Members' }]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button variant="outline" onClick={() => downloadCsv(filtersParams(filters))}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </div>
        }
      />
      <FilterBar>
        <Input
          aria-label="Search members"
          className="w-64"
          placeholder="Search name, email, phone or member no…"
          value={filters.q}
          onChange={(e) => set('q')(e.target.value)}
        />
        <NativeSelect
          aria-label="Plan"
          className="w-40"
          placeholder="All plans"
          value={filters.plan_id}
          onChange={(e) => set('plan_id')(e.target.value)}
          options={(plans?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <NativeSelect
          aria-label="Status"
          className="w-44"
          placeholder="All statuses"
          value={filters.status}
          onChange={(e) => set('status')(e.target.value)}
          options={enumOptions(STATUSES)}
        />
        <NativeSelect
          aria-label="Member type"
          className="w-40"
          placeholder="All types"
          value={filters.member_type}
          onChange={(e) => set('member_type')(e.target.value)}
          options={enumOptions(['INDIVIDUAL', 'ORGANISATION'])}
        />
        {(['member_since', 'valid_till'] as const).map((k) => (
          <fieldset key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
            <legend className="sr-only">
              {k === 'member_since' ? 'Member since' : 'Valid till'}
            </legend>
            {k === 'member_since' ? 'Member since' : 'Valid till'}
            <Input
              type="date"
              aria-label={`${k} from`}
              className="w-36"
              value={filters[`${k}_from`]}
              onChange={(e) => set(`${k}_from`)(e.target.value)}
            />
            <Input
              type="date"
              aria-label={`${k} to`}
              className="w-36"
              value={filters[`${k}_to`]}
              onChange={(e) => set(`${k}_to`)(e.target.value)}
            />
          </fieldset>
        ))}
      </FilterBar>
      {selected.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
          <span>{selected.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => setBulk('tag')}>
            Add tag
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulk('change-plan')}>
            Change plan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCsv({ ids: selected.join(',') })}
          >
            Export selected
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No members match these filters."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
      />
      <AddMemberModal open={adding} onClose={() => setAdding(false)} />
      <ImportWizard open={importing} onClose={() => setImporting(false)} />
      <ActionModal
        open={bulk === 'tag'}
        onClose={() => setBulk(null)}
        title={`Tag ${selected.length} members`}
        fields={[{ name: 'tag', label: 'Tag', required: true }]}
        request={(v) => ({ path: 'members/bulk', data: { ids: selected, action: 'tag', ...v } })}
        success="Tag added"
      />
      <ActionModal
        open={bulk === 'change-plan'}
        onClose={() => setBulk(null)}
        title={`Change plan for ${selected.length} members`}
        fields={[
          {
            name: 'plan_id',
            label: 'New plan',
            type: 'select',
            required: true,
            options: [
              { value: '', label: 'Choose…' },
              ...(plans?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
            ],
          },
        ]}
        request={(v) => ({
          path: 'members/bulk',
          data: { ids: selected, action: 'change-plan', ...v },
        })}
        success="Plan changed"
      />
    </div>
  )
}

const filtersParams = (f: typeof EMPTY_FILTERS) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))

export default function MembersPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <MembersContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
