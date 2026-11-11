'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Layers, MoreHorizontal, Plus, Search, Upload } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePagination } from '@/admin/hooks/usePagination'
import { dmy } from '../_components/MemberFormat'
import { rupees, useMembers, useOverview, usePlans, type Member } from '@/admin/hooks/useMembership'
import { ActionModal, NativeSelect, StatusPill, enumOptions, totalPages } from '../_components/ui'
import { MemberAvatar, MemberPageHeader } from '../_components/MemberUi'
import { MemberExportModal } from '../_components/MemberExportModal'
import {
  EMPTY_FILTERS,
  MemberFilterDrawer,
  SINCE_PRESETS,
  STATUSES,
  filtersParams,
  type Filters,
} from '../_components/MemberFilters'

type Bulk = 'tag' | 'change-plan' | 'suspend' | 'send-email' | 'send-renewal-link' | null

const sinceKey = (f: Filters) =>
  !f.member_since_from && !f.member_since_to
    ? ''
    : (SINCE_PRESETS.find((p) => {
        const [a, b] = p.range()
        return a === f.member_since_from && b === f.member_since_to
      })?.value ?? 'custom')

function MembersContent() {
  const router = useRouter()
  const { page, limit, setPage, reset } = usePagination({ initialLimit: 20 })
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const [drawer, setDrawer] = useState(false)
  const [exporting, setExporting] = useState<string[] | null>(null)
  const [bulk, setBulk] = useState<Bulk>(null)
  const { data, isLoading, error } = useMembers({ ...filtersParams(filters), page, limit })
  const { data: plans } = usePlans()
  const { data: overview } = useOverview()
  const { data: pastDue } = useMembers({ status: 'PAST_DUE', limit: 1 })

  const apply = (next: Filters) => {
    setFilters(next)
    setSelected([])
    reset()
  }
  const set = (k: keyof Filters) => (v: string) => apply({ ...filters, [k]: v })
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const planOptions = (plans?.items ?? []).map((p) => ({ value: p.id, label: p.name }))
  const since = sinceKey(filters)
  const k = overview?.kpis

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
        <Link
          href={`/admin/membership/members/${m.id}`}
          className="flex items-center gap-3 hover:underline"
        >
          <MemberAvatar name={m.legal_name || m.full_name} size={32} />
          <span>
            <span className="block font-medium">{m.legal_name || m.full_name}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {m.member_type === 'ORGANISATION'
                ? `Organisation · ${m.full_name}${m.contacts?.length ? ` + ${m.contacts.length} contacts` : ''}`
                : m.email}
            </span>
          </span>
        </Link>
      ),
    },
    {
      header: 'Member no.',
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.member_no ?? '—'}</span>,
    },
    {
      header: 'Plan',
      cell: ({ row: { original: m } }) => (
        <span className="whitespace-nowrap">
          {m.subscription
            ? `${m.subscription.plan?.name ?? ''}${m.subscription.price ? ` · ${m.subscription.price.interval.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}` : ''}`
            : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: ({ row }) =>
        row.original.subscription ? <StatusPill status={row.original.subscription.status} /> : '—',
    },
    {
      header: 'Member since ↓',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{dmy(row.original.member_since)}</span>
      ),
    },
    {
      header: 'Valid till',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{dmy(row.original.subscription?.ends_at)}</span>
      ),
    },
    {
      header: 'Lifetime paid',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{rupees(row.original.lifetime_paid)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original: m } }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${m.full_name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {[
              ['', 'View member'],
              ['extend', 'Extend'],
              ['change-plan', 'Change plan'],
              ['record-payment', 'Record payment'],
              ['suspend', 'Suspend'],
            ].map(([a, label]) => (
              <DropdownMenuItem
                key={label}
                onSelect={() =>
                  router.push(`/admin/membership/members/${m.id}${a ? `?action=${a}` : ''}`)
                }
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const bulkBtn = 'rounded-md bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700'
  return (
    <div>
      <MemberPageHeader
        title="Members"
        subtitle={
          k
            ? `${k.active_members ?? 0} active · ${k.pending_approvals ?? 0} pending · ${pastDue?.total ?? 0} past due`
            : undefined
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/membership/members/import')}
            >
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button variant="outline" onClick={() => setExporting([])}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => router.push('/admin/membership/members/new')}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search members"
            style={{ paddingLeft: 36 }}
            placeholder="Search name, email, phone or member no…"
            value={filters.q}
            onChange={(e) => set('q')(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Plan"
          className="w-36"
          placeholder="All plans"
          value={filters.plan_id}
          onChange={(e) => set('plan_id')(e.target.value)}
          options={planOptions}
        />
        <NativeSelect
          aria-label="Status"
          className="w-40"
          placeholder="All statuses"
          value={filters.status}
          onChange={(e) => set('status')(e.target.value)}
          options={enumOptions(STATUSES)}
        />
        <NativeSelect
          aria-label="Member type"
          className="w-36"
          placeholder="All types"
          value={filters.member_type}
          onChange={(e) => set('member_type')(e.target.value)}
          options={enumOptions(['INDIVIDUAL', 'ORGANISATION'])}
        />
        <NativeSelect
          aria-label="Member since"
          className="w-44"
          placeholder="Member since: any"
          value={since}
          onChange={(e) => {
            const p = SINCE_PRESETS.find((x) => x.value === e.target.value)
            const [from, to] = p ? p.range() : ['', '']
            apply({ ...filters, member_since_from: from, member_since_to: to })
          }}
          options={[
            ...SINCE_PRESETS.map((p) => ({ value: p.value, label: p.label })),
            ...(since === 'custom' ? [{ value: 'custom', label: 'Custom range' }] : []),
          ]}
        />
        <Button variant="outline" onClick={() => setDrawer(true)}>
          <Layers className="h-4 w-4" /> Filters
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        error={error}
        emptyMessage="No members match these filters."
        pagination={{ page, totalPages: totalPages(data?.total, limit), onPageChange: setPage }}
      />
      {data && data.total > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
        </p>
      )}
      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="fixed bottom-8 left-1/2 z-40 flex -translate-x-1/3 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl"
        >
          <b className="text-sm">{selected.length} selected</b>
          <span className="h-5 w-px bg-slate-700" />
          <button className={bulkBtn} onClick={() => setBulk('send-email')}>
            Send email
          </button>
          <button className={bulkBtn} onClick={() => setBulk('send-renewal-link')}>
            Send renewal link
          </button>
          <button className={bulkBtn} onClick={() => setBulk('tag')}>
            Add tag
          </button>
          <button className={bulkBtn} onClick={() => setBulk('change-plan')}>
            Change plan
          </button>
          <button className={bulkBtn} onClick={() => setExporting(selected)}>
            Export
          </button>
          <button
            className="rounded-md bg-red-900 px-3 py-1.5 text-sm hover:bg-red-800"
            onClick={() => setBulk('suspend')}
          >
            Suspend
          </button>
        </div>
      )}
      <MemberFilterDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        filters={filters}
        onApply={apply}
      />
      <MemberExportModal
        open={exporting !== null}
        onClose={() => setExporting(null)}
        total={exporting?.length ? exporting.length : data?.total}
        params={exporting?.length ? { ids: exporting.join(',') } : filtersParams(filters)}
      />
      <ActionModal
        open={bulk === 'tag'}
        onClose={() => setBulk(null)}
        title={`Tag ${selected.length} members`}
        fields={[{ name: 'tag', label: 'Tag', required: true }]}
        request={(v) => ({
          path: 'members/bulk',
          data: { ids: selected, action: 'tag', tags: [String(v.tag)] },
        })}
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
            options: [{ value: '', label: 'Choose…' }, ...planOptions],
          },
        ]}
        request={(v) => ({
          path: 'members/bulk',
          data: { ids: selected, action: 'change-plan', ...v },
        })}
        success="Plan changed"
      />
      <ActionModal
        open={bulk === 'send-email'}
        onClose={() => setBulk(null)}
        title={`Email ${selected.length} members`}
        fields={[
          { name: 'subject', label: 'Subject', required: true },
          { name: 'message', label: 'Message', type: 'textarea', required: true },
        ]}
        request={(v) => ({
          path: 'members/bulk',
          data: { ids: selected, action: 'send-email', ...v },
        })}
        success="Email queued"
      />
      <ActionModal
        open={bulk === 'send-renewal-link'}
        onClose={() => setBulk(null)}
        title={`Send renewal link to ${selected.length} members`}
        description="Each member gets a pay link for their current plan."
        fields={[]}
        submitLabel="Send links"
        request={() => ({
          path: 'members/bulk',
          data: { ids: selected, action: 'send-renewal-link' },
        })}
        success="Renewal links sent"
      />
      <ActionModal
        open={bulk === 'suspend'}
        onClose={() => setBulk(null)}
        title={`Suspend ${selected.length} members`}
        description="Access to members-only content stops immediately."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]}
        destructive
        submitLabel="Suspend"
        request={(v) => ({
          path: 'members/bulk',
          data: { ids: selected, action: 'suspend', ...v },
        })}
        success="Members suspended"
      />
    </div>
  )
}

export default function MembersPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <MembersContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
