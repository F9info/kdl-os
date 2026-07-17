import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import userEvent from '@testing-library/user-event'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

interface Row {
  name: string
}

const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }]

describe('DataTable regression', () => {
  it('renders rows', () => {
    render(<DataTable columns={columns} data={[{ name: 'Alice' }]} isLoading={false} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders empty message when there is no data', () => {
    render(<DataTable columns={columns} data={[]} isLoading={false} />)

    expect(screen.getByText('No results found.')).toBeInTheDocument()
  })

  it('renders error state with retry action instead of rows', async () => {
    const onRetry = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading={false}
        error="Failed to load users"
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('Failed to load users')).toBeInTheDocument()
    expect(screen.queryByText('No results found.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders error without a retry button when onRetry is omitted', () => {
    render(<DataTable columns={columns} data={[]} isLoading={false} error="Failed to load users" />)

    expect(screen.getByText('Failed to load users')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('prefers loading skeletons over the error state', () => {
    render(<DataTable columns={columns} data={[]} isLoading error="Failed to load users" />)

    expect(screen.queryByText('Failed to load users')).not.toBeInTheDocument()
  })
})
