'use client'

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from './ErrorAlert'
import { Pagination } from './Pagination'

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading: boolean
  pagination?: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  emptyMessage?: string
  error?: unknown
  onRetry?: () => void
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  pagination,
  emptyMessage = 'No results found.',
  error,
  onRetry,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {columns.map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <ErrorAlert error={error} className="max-w-md" />
                    {onRetry && (
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Try again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex justify-end">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  )
}
