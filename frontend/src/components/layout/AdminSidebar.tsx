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
  Shield,
  KeyRound,
  ClipboardList,
  Package,
  Box,
  FileText,
  Settings,
  Activity,
  Lock,
  Sparkles,
  CloudUpload,
} from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useModules } from '@/hooks/useModules'
import api from '@/lib/axios'
import { cn } from '@/lib/utils'
import type { Type, SettingField } from '@/types/models.types'

const MODULE_ICON_MAP: Record<string, React.ElementType> = {
  Image,
  Package,
  Box,
  FileText,
  Settings,
  Activity,
  Lock,
  Shield,
  Users,
  Cog,
}

// Slug of the setting field that holds the app logo (set under any Type).
const LOGO_SLUG = 'logo'

interface NavLeaf {
  label: string
  href: string
  icon: React.ElementType
  permission?: string
}

interface NavGroup {
  label: string
  icon: React.ElementType
  children: NavLeaf[]
}

const FLAT_ITEMS: NavLeaf[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users, permission: 'users:view' },
  { label: 'Modules', href: '/admin/modules', icon: Package, permission: 'modules:view' },
]

const GROUPS: NavGroup[] = [
  {
    label: 'Media',
    icon: Image,
    children: [
      { label: 'Library', href: '/admin/media', icon: Image, permission: 'media:view' },
      { label: 'AI Providers', href: '/admin/media/ai', icon: Sparkles, permission: 'media:ai-providers' },
      { label: 'Cloud Imports', href: '/admin/media/import', icon: CloudUpload, permission: 'media:cloud-import' },
    ],
  },
  {
    label: 'Access Control',
    icon: Shield,
    children: [
      { label: 'Roles', href: '/admin/roles', icon: Shield, permission: 'roles:view' },
      { label: 'Permissions', href: '/admin/permissions', icon: KeyRound, permission: 'permissions:view' },
      { label: 'Activity Log', href: '/admin/activity-log', icon: ClipboardList, permission: 'activity-log:view' },
    ],
  },
  {
    label: 'Application Settings',
    icon: UserCog,
    children: [
      { label: 'Types', href: '/admin/settings/types', icon: ListChecks, permission: 'types:view' },
      { label: 'Categories', href: '/admin/settings/categories', icon: Briefcase, permission: 'categories:view' },
      { label: 'Fields', href: '/admin/settings/fields', icon: SlidersHorizontal, permission: 'setting-fields:view' },
    ],
  },
]

export function AdminSidebar() {
  const { sidebarOpen } = useUiStore()
  const { isAdmin } = useAuth()
  const { can } = usePermissions()
  const { nonCoreNav } = useModules()
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const canViewSettings = can('types:view') || can('categories:view') || can('setting-fields:view')

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

  const visibleFlat = FLAT_ITEMS.filter((item) => !item.permission || can(item.permission))

  const dynamicModuleItems = nonCoreNav.filter(
    (item) => !item.permission || can(item.permission)
  )
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    children: group.children.filter((c) => !c.permission || can(c.permission)),
  })).filter((group) => group.children.length > 0)

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        sidebarOpen ? '' : 'w-16'
      )}
      // Expanded width driven by the Template Engine's Layout > Sidebar Width
      // token — the device-neutral, unit-suffixed alias from te-layout.css,
      // self-selecting per viewport via the @media blocks compileTokens emits
      // (KDL-209 contract; the old device-prefixed raw var is legacy).
      style={sidebarOpen ? { width: 'var(--te-layout-sidebar-width)' } : undefined}
    >
      {/* te-header keeps the logo row the same height as the TopBar when
          Layout > Header Height changes. */}
      <div className="te-header flex items-center border-b px-4">
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
                'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
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

        {/* Module-driven nav — non-core modules add items here when enabled */}
        {dynamicModuleItems.map((item) => {
          const active = isLeafActive(item.path) || pathname.startsWith(item.path + '/')
          const Icon = (item.icon ? MODULE_ICON_MAP[item.icon] : null) ?? Package
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
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
        {canViewSettings &&
          typeLeaves.map((item) => {
            const active = isLeafActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
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
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors',
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
                          'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
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
