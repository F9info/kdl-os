'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Overview } from '@/admin/hooks/useMembership'
import { rupees } from '@/admin/hooks/useMembership'
import { cn, formatDate } from '@/lib/utils'
import { StatusPill, humanize } from './ui'

export const RANGES = ['7d', '30d', '90d', '1y'] as const
export type Range = (typeof RANGES)[number]

export function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex overflow-hidden rounded-md border"
    >
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cn(
            'px-3 py-2 text-sm',
            value === r ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  note,
  tone,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  note?: ReactNode
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {note && (
        <p
          className={cn(
            'mt-1 text-xs font-medium',
            tone === 'good' && 'text-green-600',
            tone === 'bad' && 'text-destructive'
          )}
        >
          {note}
        </p>
      )}
    </div>
  )
}

/** "▲ 6.2% vs last 30 days" or nothing when the API has no delta yet. */
export function delta(pct: number | undefined, range: Range) {
  if (pct === undefined || pct === null || Number.isNaN(pct)) return undefined
  const label = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': 'year' }[range]
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% vs last ${label}`
}

const PALETTE = ['bg-primary', 'bg-indigo-500', 'bg-indigo-300', 'bg-sky-400', 'bg-teal-400']

export function ChurnChart({ growth }: { growth: Overview['growth'] }) {
  const max = Math.max(1, ...growth.map((g) => g.count + (g.churned ?? 0)))
  return (
    <div>
      <div className="mb-2 flex justify-end gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-primary" /> New
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-red-300" /> Churned
        </span>
      </div>
      <div
        className="flex h-48 items-end gap-2"
        role="img"
        aria-label="New members versus churn by month"
      >
        {growth.map((g) => (
          <div key={g.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-40 w-full flex-col justify-end">
              <div
                className="w-full rounded-t-sm bg-red-300"
                style={{ height: `${((g.churned ?? 0) / max) * 100}%` }}
              />
              <div className="w-full bg-primary" style={{ height: `${(g.count / max) * 100}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(`${g.month}-01T00:00:00Z`).toLocaleString('en', {
                month: 'short',
                timeZone: 'UTC',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlanMixBars({ rows }: { rows: Overview['plan_mix'] }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...sorted.map((r) => r.count))
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>
  return (
    <ul className="space-y-3">
      {sorted.map((r, i) => (
        <li key={r.plan.id} className="text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <i className={cn('h-2 w-2 rounded-full', PALETTE[i % PALETTE.length])} />
              {r.plan.name ?? '-'}
            </span>
            <b className="tabular-nums">{r.count}</b>
          </div>
          <div className="h-1.5 rounded bg-muted">
            <div
              className={cn('h-1.5 rounded', PALETTE[i % PALETTE.length])}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function RecentMembersTable({ rows }: { rows: Overview['recent_members'] }) {
  if (rows.length === 0) return <p className="p-5 text-sm text-muted-foreground">No members yet.</p>
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-left text-muted-foreground">
        <tr>
          {['Member', 'Plan', 'Status', 'Member since', 'Paid'].map((h) => (
            <th key={h} className="px-4 py-3 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const plan = m.plan?.name ?? m.subscription?.plan?.name
          const status = (m.status ?? m.subscription?.status) as string | undefined
          return (
            <tr key={m.id} className="border-t">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/membership/members/${m.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
                    {initials(m.full_name)}
                  </span>
                  <span>
                    <span className="block font-medium">{m.full_name}</span>
                    <span className="block text-xs text-muted-foreground">{m.email}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                {plan ?? '—'}
                {plan && m.interval ? ` · ${humanize(m.interval)}` : ''}
              </td>
              <td className="px-4 py-3">{status ? <StatusPill status={status} /> : '—'}</td>
              <td className="px-4 py-3">{m.member_since ? formatDate(m.member_since) : '—'}</td>
              <td className="px-4 py-3 tabular-nums">
                {m.paid_total === undefined || m.paid_total === null ? '—' : rupees(m.paid_total)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
