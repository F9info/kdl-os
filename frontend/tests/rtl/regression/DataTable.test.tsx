import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

interface Row {
  name: string
}

const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }]

const pagination = { page: 1, totalPages: 3, onPageChange: vi.fn() }

describe('DataTable regression', () => {
  it('renders rows', () => {
    render(<DataTable columns={columns} data={[{ name: 'Alice' }]} isLoading={false} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders empty message when there is no data', () => {
    render(<DataTable columns={columns} data={[]} isLoading={false} />)

    expect(screen.getByText('No results found.')).toBeInTheDocument()
  })

  it('renders in-table error alert instead of rows', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading={false}
        error="Failed to load users"
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Failed to load users')).toBeInTheDocument()
    expect(screen.queryByText('No results found.')).not.toBeInTheDocument()
  })

  it('prefers loading skeletons over the error state', () => {
    render(<DataTable columns={columns} data={[]} isLoading error="Failed to load users" />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed to load users')).not.toBeInTheDocument()
  })

  it('extracts message from Error object', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading={false}
        error={new Error('Something broke')}
      />
    )

    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })

  it('disables pagination while loading', () => {
    render(
      <DataTable
        columns={columns}
        data={[{ name: 'Alice' }]}
        isLoading
        pagination={pagination}
      />
    )

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('disables pagination when error is set', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading={false}
        error="oops"
        pagination={pagination}
      />
    )

    screen.getAllByRole('button').forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })
})
