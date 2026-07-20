'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, Settings, Image, UserCheck, type LucideIcon } from 'lucide-react'
import api from '@/lib/axios'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types/models.types'
import type { ColumnDef } from '@tanstack/react-table'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  isLoading: boolean
}

function StatsCard({ title, value, icon: Icon, isLoading }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

const recentColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorKey: 'roles',
    header: 'Role',
    cell: ({ row }) => {
      const slug = row.original.roles?.[0]?.slug ?? 'user'
      const variant = slug.replace('-', '_') as 'user' | 'admin' | 'super_admin'
      return <StatusBadge variant={variant} />
    },
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => <StatusBadge variant={row.original.is_active ? 'active' : 'inactive'} />,
  },
  {
    accessorKey: 'created_at',
    header: 'Joined',
    cell: ({ row }) => formatDate(row.original.created_at),
  },
]

export default function DashboardPage() {
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: () =>
      api
        .get('/users', { params: { limit: 1 } })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number } }),
  })

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['users', 'active-stats'],
    queryFn: () =>
      api
        .get('/users', { params: { limit: 1, is_active: true } })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number } }),
  })

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', 'stats'],
    queryFn: () => api.get('/settings').then((r) => r.data.data as { settings: unknown[] }),
  })

  const { data: recentUsers, isLoading: recentLoading } = useQuery({
    queryKey: ['users', 'recent'],
    queryFn: () =>
      api
        .get('/users', { params: { limit: 5, page: 1 } })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number } }),
  })

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', 'stats'],
    queryFn: () =>
      api
        .get('/media', { params: { limit: 1, scope: 'all' } })
        .then((r) => r.data.data as { pagination: { total: number } }),
  })

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Gap between stat cards follows Template Engine Layout > Card Spacing
          via te-card-grid (te-layout.css); gap-4 was the old static value. */}
      <div className="te-card-grid grid md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={usersData?.pagination.total ?? 0}
          icon={Users}
          isLoading={usersLoading}
        />
        <StatsCard
          title="Active Users"
          value={activeData?.pagination.total ?? 0}
          icon={UserCheck}
          isLoading={activeLoading}
        />
        <StatsCard
          title="Settings"
          value={settingsData?.settings.length ?? 0}
          icon={Settings}
          isLoading={settingsLoading}
        />
        <StatsCard
          title="Media Files"
          value={mediaData?.pagination.total ?? 0}
          icon={Image}
          isLoading={mediaLoading}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Recent Users</h2>
        <DataTable
          columns={recentColumns}
          data={recentUsers?.users ?? []}
          isLoading={recentLoading}
        />
      </div>
    </div>
  )
}
