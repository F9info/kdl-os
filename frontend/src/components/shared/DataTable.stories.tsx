import type { Meta, StoryObj } from '@storybook/react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './DataTable'

interface User {
  id: number
  name: string
  email: string
  role: string
}

const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
]

const data: User[] = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'User' },
  { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'Editor' },
]

const meta: Meta<typeof DataTable> = {
  title: 'Shared/DataTable',
  component: DataTable,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DataTable>

export const Default: Story = {
  render: () => <DataTable columns={columns} data={data} isLoading={false} />,
}

export const Loading: Story = {
  render: () => <DataTable columns={columns} data={[]} isLoading={true} />,
}

export const Empty: Story = {
  render: () => (
    <DataTable columns={columns} data={[]} isLoading={false} emptyMessage="No users found." />
  ),
}

export const WithPagination: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={data}
      isLoading={false}
      pagination={{ page: 1, totalPages: 5, onPageChange: () => {} }}
    />
  ),
}
