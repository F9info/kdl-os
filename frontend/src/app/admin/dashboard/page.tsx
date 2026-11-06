'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, Settings, Image, UserCheck, type LucideIcon } from 'lucide-react'
import api from '@/lib/axios'
import Link from 'next/link'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useModules } from '@/admin/hooks/useModules'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { DataTable } from '@/admin/components/shared/DataTable'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
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

// Quick actions follow what the signed-in role can actually open, so a Developer (builds the
// project) and an Admin (runs the content) get different dashboards without role names in code.
// A link needs its permission AND its module to be enabled.
interface QuickAction {
  label: string
  href: string
  permission: string
  module?: string
}
const QUICK_GROUPS: { title: string; actions: QuickAction[] }[] = [
  {
    title: 'Build',
    actions: [
      { label: 'Modules', href: '/admin/modules', permission: 'modules:view' },
      {
        label: 'Themes',
        href: '/admin/theme-engine',
        permission: 'theme-engine:edit',
        module: 'theme-engine',
      },
      {
        label: 'Integrations',
        href: '/admin/integrations',
        permission: 'integrations:view',
        module: 'integrations',
      },
    ],
  },
  {
    title: 'Frontend',
    actions: [
      { label: 'Website', href: '/admin/brands', permission: 'menus:view', module: 'menus' },
      { label: 'Pages', href: '/admin/pages', permission: 'menus:view', module: 'menus' },
      {
        label: 'Sections',
        href: '/admin/page-builder/section-builder',
        permission: 'page-builder:view',
        module: 'page-builder',
      },
      { label: 'Media', href: '/admin/media', permission: 'media:view' },
      { label: 'Users', href: '/admin/users', permission: 'users:view' },
    ],
  },
]

export default function DashboardPage() {
  // Each card calls an API behind its own permission. Asking for data the user may not see only
  // produced 403s and a misleading "0", so only query and show what the role can actually view.
  const { can } = usePermissions()
  const canUsers = can('users:view')
  const canSettings = can('settings:view')
  const canMedia = can('media:view')
  const { isEnabled } = useModules()
  const groups = QUICK_GROUPS.map((g) => ({
    ...g,
    actions: g.actions.filter((a) => can(a.permission) && (!a.module || isEnabled(a.module))),
  })).filter((g) => g.actions.length > 0)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'stats'],
    enabled: canUsers,
    queryFn: () =>
      api
        .get('/users', { params: { limit: 1 } })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number } }),
  })

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['users', 'active-stats'],
    enabled: canUsers,
    queryFn: () =>
      api
        .get('/users', { params: { limit: 1, is_active: true } })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number } }),
  })

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', 'stats'],
    enabled: canSettings,
    queryFn: () => api.get('/settings').then((r) => r.data.data as { settings: unknown[] }),
  })

  const { data: recentUsers, isLoading: recentLoading } = useQuery({
    queryKey: ['users', 'recent'],
    enabled: canUsers,
    queryFn: () =>
      api
        .get('/users', { params: { limit: 5, page: 1 } })
        .then((r) => r.data.data as { users: User[]; pagination: { total: number } }),
  })

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', 'stats'],
    enabled: canMedia,
    queryFn: () =>
      api
        .get('/media', { params: { limit: 1, scope: 'all' } })
        .then((r) => r.data.data as { pagination: { total: number } }),
  })

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Gap between stat cards follows Theme Engine Layout > Card Spacing
          via th-card-grid (te-layout.css); gap-4 was the old static value. */}
      <div className="th-card-grid grid md:grid-cols-2 lg:grid-cols-4">
        {canUsers && (
          <StatsCard
            title="Total Users"
            value={usersData?.pagination.total ?? 0}
            icon={Users}
            isLoading={usersLoading}
          />
        )}
        {canUsers && (
          <StatsCard
            title="Active Users"
            value={activeData?.pagination.total ?? 0}
            icon={UserCheck}
            isLoading={activeLoading}
          />
        )}
        {canSettings && (
          <StatsCard
            title="Settings"
            value={settingsData?.settings.length ?? 0}
            icon={Settings}
            isLoading={settingsLoading}
          />
        )}
        {canMedia && (
          <StatsCard
            title="Media Files"
            value={mediaData?.pagination.total ?? 0}
            icon={Image}
            isLoading={mediaLoading}
          />
        )}
      </div>

      {groups.length > 0 && (
        <div className="mt-8 grid gap-6 md:grid-cols-2" data-testid="quick-actions">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="text-lg font-semibold mb-3">{g.title}</h2>
              <div className="flex flex-wrap gap-2">
                {g.actions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!canUsers && !canSettings && !canMedia && (
        <p className="text-sm text-muted-foreground" data-testid="dashboard-empty">
          Welcome. Use the menu to open the areas you have access to.
        </p>
      )}

      {canUsers && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Users</h2>
          <DataTable
            columns={recentColumns}
            data={recentUsers?.users ?? []}
            isLoading={recentLoading}
          />
        </div>
      )}
    </div>
  )
}
