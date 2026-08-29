'use client'

// B6 — Workflow status badge + transition action buttons

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkflowStatus =
  'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED'

interface Transition {
  label: string
  to: WorkflowStatus
  permission: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
  REVIEW: 'bg-blue-100 text-blue-700 border-blue-300',
  APPROVED: 'bg-green-100 text-green-700 border-green-300',
  REJECTED: 'bg-red-100 text-red-700 border-red-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  EXPIRED: 'bg-orange-100 text-orange-700 border-orange-300',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-300',
}

const TRANSITIONS: Record<WorkflowStatus, Transition[]> = {
  DRAFT: [{ label: 'Submit for Review', to: 'REVIEW', permission: 'media:review:submit' }],
  REVIEW: [
    { label: 'Approve', to: 'APPROVED', permission: 'media:review:approve' },
    { label: 'Reject', to: 'REJECTED', permission: 'media:review:reject' },
  ],
  APPROVED: [{ label: 'Publish', to: 'PUBLISHED', permission: 'media:review:publish' }],
  PUBLISHED: [{ label: 'Archive', to: 'ARCHIVED', permission: 'media:review:archive' }],
  REJECTED: [],
  EXPIRED: [],
  ARCHIVED: [],
}

// ─── API helper ───────────────────────────────────────────────────────────────

function patchWorkflow(mediaId: string, status: WorkflowStatus) {
  return api.patch(`/media/${mediaId}/workflow`, { status })
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkflowBadgeProps {
  status: string
  mediaId: string
  onTransitioned?: () => void
  permissions?: string[]
}

export function WorkflowBadge({
  status,
  mediaId,
  onTransitioned,
  permissions = [],
}: WorkflowBadgeProps) {
  const queryClient = useQueryClient()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const normalizedStatus = (status?.toUpperCase() ?? 'DRAFT') as WorkflowStatus
  const styleClass = STATUS_STYLES[normalizedStatus] ?? STATUS_STYLES.DRAFT
  const transitions = TRANSITIONS[normalizedStatus] ?? []

  // Filter to only permitted transitions
  const allowedTransitions = transitions.filter(
    (t) => permissions.length === 0 || permissions.includes(t.permission)
  )

  const transitionMut = useMutation({
    mutationFn: (to: WorkflowStatus) => patchWorkflow(mediaId, to),
    onSuccess: (_data, to) => {
      toast({ title: `Status updated to ${to}` })
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
      setDropdownOpen(false)
      onTransitioned?.()
    },
    onError: () => toast({ title: 'Transition failed', variant: 'destructive' }),
  })

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Status badge */}
      <Badge variant="outline" className={cn('text-xs font-medium border px-2 py-0.5', styleClass)}>
        {normalizedStatus}
      </Badge>

      {/* Transition dropdown trigger */}
      {allowedTransitions.length > 0 && (
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setDropdownOpen((v) => !v)}
            title="Workflow actions"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>

          {dropdownOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-background border rounded-md shadow-md min-w-[160px] overflow-hidden">
                {allowedTransitions.map((t) => (
                  <button
                    key={t.to}
                    type="button"
                    disabled={transitionMut.isPending}
                    onClick={() => transitionMut.mutate(t.to)}
                    className={cn(
                      'w-full text-left text-sm px-3 py-2 hover:bg-accent transition-colors',
                      transitionMut.isPending && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
