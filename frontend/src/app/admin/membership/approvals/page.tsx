'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Check } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { DataTable } from '@/admin/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { rupees, useAdminAction, useAdminList, usePlans } from '@/admin/hooks/useMembership'
import {
  ApprovalDrawer,
  ApproveModal,
  RejectModal,
  paymentOf,
  planLine,
  type Application,
} from '../_components/ApprovalsParts'
import { PersonCell, useDebounced, waiting } from '../_components/BillingBits'
import { BulkConfirm } from '../_components/BillingModals'
import { FilterBar, NativeSelect } from '../_components/ui'

function ApprovalsContent() {
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState('')
  const [paid, setPaid] = useState('')
  const dq = useDebounced(q)
  const { data, isLoading, error } = useAdminList<Application>('approvals', { q: dq, limit: 100 })
  const { data: plans } = usePlans()
  const [sel, setSel] = useState<string[]>([])
  const [drawer, setDrawer] = useState<string | null>(null)
  const [approve, setApprove] = useState<Application | null>(null)
  const [reject, setReject] = useState<Application | null>(null)
  const [bulk, setBulk] = useState<'approve' | 'reject' | null>(null)
  const act = useAdminAction()

  const items = useMemo(
    () =>
      (data?.items ?? []).filter((a) => {
        if (plan && a.plan?.name !== plan) return false
        const isPaid = paymentOf(a)?.status === 'PAID'
        return paid === 'paid' ? isPaid : paid === 'unpaid' ? !isPaid : true
      }),
    [data, plan, paid]
  )
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function runBulk(kind: 'approve' | 'reject', reason?: string) {
    let ok = 0
    for (const id of sel) {
      try {
        await act.mutateAsync({
          path: `approvals/${id}/${kind}`,
          data: kind === 'reject' ? { reason: reason || 'Rejected', refund: true } : undefined,
        })
        ok++
      } catch {
        /* keep going; the failures are reported below */
      }
    }
    toast({
      title: `${ok} of ${sel.length} ${kind === 'approve' ? 'approved' : 'rejected'}`,
      variant: ok === sel.length ? undefined : 'destructive',
    })
    setSel([])
    setBulk(null)
  }

  const columns: ColumnDef<Application>[] = [
    {
      id: 'sel',
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={items.length > 0 && sel.length === items.length}
          onChange={(e) => setSel(e.target.checked ? items.map((i) => i.id) : [])}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.member.full_name}`}
          checked={sel.includes(row.original.id)}
          onChange={() => toggle(row.original.id)}
        />
      ),
    },
    {
      header: 'Applicant',
      cell: ({ row: { original: a } }) => (
        <button
          type="button"
          className="text-left"
          onClick={() => setDrawer(a.id)}
          aria-label={`Open application of ${a.member.full_name}`}
        >
          <PersonCell name={a.member.full_name} sub={a.member.email} />
        </button>
      ),
    },
    { header: 'Plan', cell: ({ row }) => planLine(row.original) || '—' },
    {
      header: 'Payment',
      cell: ({ row }) => {
        const p = paymentOf(row.original)
        return p?.status === 'PAID' ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            Paid {rupees(p.amount)}
          </span>
        ) : (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            {p ? 'Unpaid' : 'No payment'}
          </span>
        )
      },
    },
    {
      header: 'Details',
      cell: ({ row: { original: a } }) => (
        <div className="text-xs">
          {a.member.legal_name && <p>Org: {a.member.legal_name}</p>}
          {a.member.city && <p>City: {a.member.city}</p>}
          {!a.member.legal_name && !a.member.city && '—'}
        </div>
      ),
    },
    { header: 'Waiting', cell: ({ row }) => waiting(row.original.created_at) },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original: a } }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setApprove(a)}
            aria-label={`Approve ${a.member.full_name}`}
          >
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive text-destructive"
            onClick={() => setReject(a)}
            aria-label={`Reject ${a.member.full_name}`}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Approvals"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: `Plans with manual approval · ${data?.total ?? 0} waiting` },
        ]}
        action={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-destructive text-destructive"
              disabled={sel.length === 0}
              onClick={() => setBulk('reject')}
            >
              Reject selected
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={sel.length === 0}
              onClick={() => setBulk('approve')}
            >
              <Check className="h-4 w-4" /> Approve selected
            </Button>
          </div>
        }
      />
      <FilterBar>
        <Input
          aria-label="Search applicant"
          className="w-72"
          placeholder="Search applicant…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <NativeSelect
          aria-label="Plan"
          className="w-40"
          placeholder="All plans"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          options={(plans?.items ?? []).map((p) => ({ value: p.name, label: p.name }))}
        />
        <NativeSelect
          aria-label="Payment"
          className="w-44"
          placeholder="Paid & unpaid"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          options={[
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid' },
          ]}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        error={error}
        emptyMessage="No applications waiting for review."
      />
      <ApprovalDrawer
        id={drawer}
        onClose={() => setDrawer(null)}
        onApprove={(a) => {
          setDrawer(null)
          setApprove(a)
        }}
        onReject={(a) => {
          setDrawer(null)
          setReject(a)
        }}
      />
      <ApproveModal app={approve} onClose={() => setApprove(null)} />
      <RejectModal app={reject} onClose={() => setReject(null)} />
      <BulkConfirm
        kind={bulk}
        count={sel.length}
        pending={act.isPending}
        onClose={() => setBulk(null)}
        onConfirm={runBulk}
      />
    </div>
  )
}

export default function ApprovalsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <ApprovalsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
