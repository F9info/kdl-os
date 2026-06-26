'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Users,
  Image,
  UserCog,
  ListChecks,
  Briefcase,
  SlidersHorizontal,
  Cog,
  ChevronDown,
} from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { cn } from '@/lib/utils'
import type { Type, SettingField } from '@/types/models.types'

// Slug of the setting field that holds the app logo (set under any Type).
const LOGO_SLUG = 'logo'

interface NavLeaf {
  label: string
  href: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  children: NavLeaf[]
}

const FLAT_ITEMS: (NavLeaf & { adminOnly?: boolean })[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Media', href: '/admin/media', icon: Image, adminOnly: true },
]

const GROUPS: NavGroup[] = [
  {
    label: 'Application Settings',
    icon: UserCog,
    adminOnly: true,
    children: [
      { label: 'Types', href: '/admin/settings/types', icon: ListChecks },
      { label: 'Categories', href: '/admin/settings/categories', icon: Briefcase },
      { label: 'Fields', href: '/admin/settings/fields', icon: SlidersHorizontal },
    ],
  },
]

export function AdminSidebar() {
  const { sidebarOpen } = useUiStore()
  const { isAdmin } = useAuth()
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Active types become top-level menu items automatically — one per type,
  // each linking to its own settings page. New types appear as soon as created.
  const { data: typesData } = useQuery({
    queryKey: ['sidebar-types'],
    enabled: isAdmin,
    queryFn: () =>
      api
        .get('/types', { params: { limit: 100, is_active: 'true', sortBy: 'name', sortOrder: 'asc' } })
        .then((r) => r.data.data as { types: Type[] }),
  })
  const typeLeaves: NavLeaf[] = (typesData?.types ?? []).map((t) => ({
    label: t.name,
    href: `/admin/settings/view/${t.slug}`,
    icon: Cog,
  }))

  // Dynamic logo from the 'logo' setting field — shown in the header in place of
  // the "KDL Admin" text. Falls back to the text when no logo is configured.
  const { data: logoUrl } = useQuery({
    queryKey: ['app-logo'],
    enabled: isAdmin,
    retry: false,
    queryFn: () =>
      api
        .get(`/setting-fields/value/${LOGO_SLUG}`)
        .then((r) => (r.data.data.field as SettingField).value_url ?? null)
        .catch(() => null),
  })

  // Exact match: '/admin/settings/types' must not mark a sibling active, so
  // leaves never use startsWith.
  const isLeafActive = (href: string) => pathname === href
  const childrenHaveActive = (children: NavLeaf[]) => children.some((c) => isLeafActive(c.href))
  const isGroupOpen = (group: NavGroup) =>
    openGroups[group.label] ?? childrenHaveActive(group.children)
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !(prev[label] ?? false) }))

  const visibleFlat = FLAT_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const visibleGroups = GROUPS.filter((group) => !group.adminOnly || isAdmin)

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      <div className="flex h-16 items-center border-b px-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className={cn('object-contain', sidebarOpen ? 'h-10 max-w-[180px]' : 'h-8 w-8')}
          />
        ) : sidebarOpen ? (
          <span className="font-bold text-lg tracking-tight">KDL Admin</span>
        ) : (
          <span className="font-bold text-lg">K</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Main navigation">
        {visibleFlat.map((item) => {
          const active = isLeafActive(item.href) || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* Per-type settings screens — top-level items, right after the flat items */}
        {isAdmin &&
          typeLeaves.map((item) => {
            const active = isLeafActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}

        {visibleGroups.map((group) => {
          const open = isGroupOpen(group)
          const hasActive = childrenHaveActive(group.children)
          const GroupIcon = group.icon
          return (
            <div key={group.label} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={open}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  hasActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                title={!sidebarOpen ? group.label : undefined}
              >
                <GroupIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        open ? 'rotate-0' : '-rotate-90'
                      )}
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>

              {open && (
                <div className={cn('space-y-1', sidebarOpen && 'ml-4 border-l pl-2')}>
                  {group.children.map((child) => {
                    const active = isLeafActive(child.href)
                    const ChildIcon = child.icon
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                        title={!sidebarOpen ? child.label : undefined}
                      >
                        <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {sidebarOpen && <span>{child.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
