'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Plan } from '@/admin/hooks/useMembership'
import { cn } from '@/lib/utils'
import { StatusPill, humanize, priceSummary } from './ui'

export const memberCount = (p: Plan) => p.member_count ?? p._count?.subscriptions ?? 0

/** Native HTML5 drag-to-reorder (no dnd lib in the repo); calls onReorder with the new id order on drop. */
export function PlansTable({
  plans,
  onReorder,
  onArchive,
}: {
  plans: Plan[]
  onReorder: (ids: string[]) => void
  onArchive: (p: Plan) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return
    const ids = plans.map((p) => p.id).filter((id) => id !== dragId)
    ids.splice(
      ids.indexOf(targetId) +
        (plans.findIndex((p) => p.id === dragId) < plans.findIndex((p) => p.id === targetId)
          ? 1
          : 0),
      0,
      dragId
    )
    onReorder(ids)
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-3" aria-label="Reorder" />
            {['Plan', 'Pricing (+GST)', 'Approval', 'Visibility', 'Members', 'Status'].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-muted-foreground">
                No plans yet. Create your first plan.
              </td>
            </tr>
          )}
          {plans.map((p) => (
            <tr
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => {
                e.preventDefault()
                setOverId(p.id)
              }}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
              onDrop={() => {
                drop(p.id)
                setDragId(null)
                setOverId(null)
              }}
              className={cn(
                'border-t',
                dragId === p.id && 'opacity-40',
                overId === p.id && dragId !== p.id && 'bg-muted'
              )}
            >
              <td className="cursor-grab px-3 py-4 text-muted-foreground" aria-hidden>
                <GripVertical className="h-4 w-4" />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/membership/plans/${p.id}`}
                    className="font-semibold hover:underline"
                  >
                    {p.name}
                  </Link>
                  {(p.badge || p.is_featured) && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {p.badge || 'Most popular'}
                    </span>
                  )}
                </div>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              </td>
              <td className="px-4 py-3">{priceSummary(p)}</td>
              <td className="px-4 py-3">{humanize(p.approval_mode)}</td>
              <td className="px-4 py-3">
                {p.visibility === 'HIDDEN' ? 'Invite' : humanize(p.visibility)}
              </td>
              <td className="px-4 py-3 tabular-nums">{memberCount(p)}</td>
              <td className="px-4 py-3">
                <StatusPill status={p.visibility === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'} />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/membership/plans/${p.id}`} aria-label={`Edit ${p.name}`}>
                      Edit
                    </Link>
                  </Button>
                  {p.visibility !== 'ARCHIVED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Archive ${p.name}`}
                      onClick={() => onArchive(p)}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
