'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { usePagination } from '@/hooks/usePagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatDate } from '@/lib/utils'
import type { IntegrationChannel, IntegrationLog, MessageStatus } from '@/types/integrations.types'

const CHANNELS: IntegrationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP']
const STATUSES: MessageStatus[] = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']

const STATUS_CLASSES: Record<MessageStatus, string> = {
  QUEUED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  READ: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status]
      )}
    >
      {status}
    </span>
  )
}

export default function IntegrationLogsPage() {
  const { page, setPage } = usePagination()
  const [channel, setChannel] = useState<IntegrationChannel | ''>('')
  const [status, setStatus] = useState<MessageStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['integration-logs', page, channel, status],
    queryFn: () =>
      api
        .get('/integrations/logs', {
          params: {
            page,
            limit: 20,
            channel: channel || undefined,
            status: status || undefined,
          },
        })
        .then(
          (r) =>
            r.data.data as {
              logs: IntegrationLog[]
              pagination: { total: number; pages: number }
            }
        ),
  })

  function clearFilters() {
    setChannel('')
    setStatus('')
    setPage(1)
  }

  const hasFilters = channel || status

  const columns: ColumnDef<IntegrationLog>[] = [
    {
      id: 'recipient',
      header: 'Recipient',
      cell: ({ row }) => <span className="text-sm">{row.original.recipient}</span>,
    },
    {
      accessorKey: 'channel',
      header: 'Channel',
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {row.original.channel}
        </span>
      ),
    },
    {
      id: 'provider',
      header: 'Provider',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.provider?.name ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <MessageStatusBadge status={row.original.status} />,
    },
    {
      id: 'error',
      header: 'Error',
      cell: ({ row }) => (
        <span className="text-sm text-red-600 dark:text-red-400">
          {row.original.error ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'attempts',
      header: 'Attempts',
      cell: ({ row }) => <span className="text-sm">{row.original.attempts}</span>,
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
  ]

  return (
    <ModuleGuard slug="integrations">
      <PermissionGuard permission="integrations:view">
        <div>
          <PageHeader title="Integration Logs" />

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Select
              value={channel || 'all'}
              onValueChange={(v) => {
                setChannel(v === 'all' ? '' : (v as IntegrationChannel))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : (v as MessageStatus))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}

            {data && (
              <span className="text-sm text-muted-foreground ml-auto">
                {data.pagination.total} entries
              </span>
            )}
          </div>

          <DataTable
            columns={columns}
            data={data?.logs ?? []}
            isLoading={isLoading}
            pagination={
              data
                ? { page, totalPages: data.pagination.pages, onPageChange: setPage }
                : undefined
            }
            emptyMessage="No integration logs yet."
          />
        </div>
      </PermissionGuard>
    </ModuleGuard>
  )
}
