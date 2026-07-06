'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import type { ActivityLog } from '@/types/models.types'

export default function ActivityLogPage() {
  const { page, setPage } = usePagination()
  const [actorSearch, setActorSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const debouncedActor = useDebounce(actorSearch)
  const debouncedModule = useDebounce(moduleFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['activity-log', page, debouncedActor, debouncedModule, fromDate, toDate],
    queryFn: () =>
      api
        .get('/activity-log', {
          params: {
            page,
            limit: 20,
            actor: debouncedActor || undefined,
            module: debouncedModule || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
          },
        })
        .then(
          (r) =>
            r.data.data as {
              logs: ActivityLog[]
              pagination: { total: number; pages: number }
            }
        ),
  })

  function clearFilters() {
    setActorSearch('')
    setModuleFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const columns: ColumnDef<ActivityLog>[] = [
    {
      id: 'actor',
      header: 'Actor',
      cell: ({ row }) =>
        row.original.actor ? (
          <div>
            <div className="font-medium text-sm">{row.original.actor.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.actor.email}</div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">System</span>
        ),
    },
    {
      accessorKey: 'module',
      header: 'Module',
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {row.original.module}
        </span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <span className="text-sm capitalize">{row.original.action}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.description ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'ip_address',
      header: 'IP',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">
          {row.original.ip_address ?? '—'}
        </span>
      ),
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

  const hasFilters = actorSearch || moduleFilter || fromDate || toDate

  return (
    <PermissionGuard permission="activity-log.view">
    <div>
      <PageHeader title="Activity Log" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by actor…"
            value={actorSearch}
            onChange={(e) => { setActorSearch(e.target.value); setPage(1) }}
            className="pl-9 w-48"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by module…"
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setPage(1) }}
            className="pl-9 w-44"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
            className="w-36"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1) }}
            className="w-36"
          />
        </div>

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
        emptyMessage="No activity logged yet."
      />
    </div>
    </PermissionGuard>
  )
}
