'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useUiStore } from '@/admin/stores/ui.store'
import { useIsMobile } from '@/admin/hooks/useIsMobile'
import { useAuth } from '@/admin/hooks/useAuth'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useModules } from '@/admin/hooks/useModules'
import { useIdentity } from '@/hooks/useIdentity'
import { navIcon } from '@/admin/lib/nav-icons'
import { SHELL_ITEMS, isNavActive } from '@/admin/lib/nav-model'
import api from '@/lib/axios'
import { cn } from '@/lib/utils'
import { AppImage } from '@/components/shared/AppImage'
import type { Type, SettingField, ModuleNavItem } from '@/types/models.types'

// Slug of the setting field that holds the app logo (set under any Type).
const LOGO_SLUG = 'logo'

// Navigation is NOT defined here. Every entry, group, icon, order and permission comes from the
// enabled modules' manifests (`nav` in module.json) through admin/lib/nav-model.ts; the same model
// feeds the command palette. Only the per-type settings screens below are data-driven.

interface LinkProps {
  label: string
  href: string
  icon: React.ElementType
  active: boolean
  showLabels: boolean
}

function NavLink({ label, href, icon: Icon, active, showLabels }: LinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      title={!showLabels ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {showLabels && <span>{label}</span>}
    </Link>
  )
}

interface SectionProps {
  label: string
  icon: React.ElementType
  open: boolean
  highlighted: boolean
  showLabels: boolean
  onToggle: () => void
  children: React.ReactNode
}

// A collapsible section (a bundle such as Content, or a group such as Settings).
function NavSectionBox({
  label,
  icon: Icon,
  open,
  highlighted,
  showLabels,
  onToggle,
  children,
}: SectionProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors',
          highlighted
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        title={!showLabels ? label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {showLabels && (
          <>
            <span className="flex-1 text-left">{label}</span>
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
        <div className={cn('space-y-1', showLabels && 'ml-4 border-l pl-2')}>{children}</div>
      )}
    </div>
  )
}

export function AdminSidebar() {
  const { sidebarOpen, setSidebarOpen, setIsMobile } = useUiStore()
  const isMobile = useIsMobile()
  const { isAdmin } = useAuth()
  const { can } = usePermissions()
  const { navModel } = useModules()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Sync viewport breakpoint into the store so other components can read it.
  useEffect(() => {
    setIsMobile(isMobile)
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, setIsMobile, setSidebarOpen])

  // Auto-close drawer on navigation (mobile only).
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // On mobile: always show labels inside the full-width drawer.
  const showLabels = isMobile || sidebarOpen

  const canViewSettings =
    can('types:view') ||
    can('categories:view') ||
    can('setting-fields:view') ||
    can('settings:view')

  // Active types become top-level menu items automatically — one per type,
  // each linking to its own settings page. New types appear as soon as created.
  const { data: typesData } = useQuery({
    queryKey: ['sidebar-types'],
    enabled: isAdmin,
    queryFn: () =>
      api
        .get('/types', {
          params: { limit: 100, is_active: 'true', sortBy: 'name', sortOrder: 'asc' },
        })
        .then((r) => r.data.data as { types: Type[] }),
  })
  // Types edited inside another page (website-content lives in CMS → Website Details) get no
  // sidebar entry of their own; their /admin/settings/view/<slug> route still works.
  const EMBEDDED_TYPES = new Set(['website-content'])
  const typeLeaves: ModuleNavItem[] = (typesData?.types ?? [])
    .filter((t) => !EMBEDDED_TYPES.has(t.slug))
    .map((t) => ({ label: t.name, path: `/admin/settings/view/${t.slug}`, icon: 'Cog' }))

  // Header logo: Application Identity first, then the legacy 'logo' setting field, then the
  // application name as text.
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

  const { identity, appName } = useIdentity()
  const headerLogo = identity.logo_light || logoUrl

  const canSee = (item: ModuleNavItem) => !item.permission || can(item.permission)
  const search = searchParams.toString()
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }))

  const topItems = [...SHELL_ITEMS, ...navModel.top].filter(canSee)
  const bundles = navModel.bundles
    .map((b) => ({ ...b, items: b.items.filter(canSee) }))
    .filter((b) => b.items.length > 0)
  const groups = navModel.groups
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      {/* Mobile backdrop — tapping outside closes the drawer */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        data-testid="admin-sidebar"
        aria-hidden={isMobile && !sidebarOpen ? true : undefined}
        className={cn(
          'flex flex-col border-r bg-card',
          isMobile
            ? cn(
                'fixed inset-y-0 left-0 z-50 shadow-lg',
                'transition-transform duration-200 ease-in-out',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )
            : cn('transition-all duration-200', sidebarOpen ? '' : 'w-16')
        )}
        // Desktop: expanded width from TE sidebar-width token (KDL-209 contract).
        // Mobile: same token drives drawer width; never uses icon-rail (w-16) on mobile.
        style={isMobile || sidebarOpen ? { width: 'var(--th-layout-sidebar-width)' } : undefined}
      >
        {/* th-header keeps the logo row the same height as the TopBar when
          Layout > Header Height changes. */}
        <div className="th-header flex items-center border-b px-4">
          {headerLogo ? (
            // Expanded: logo_image class sizes the logo from the Template
            // Engine's Images pane. Collapsed: the 64px rail is fixed chrome, so
            // an inline style (beats the class) pins the logo to fit it.
            <>
              <AppImage
                size="logo"
                src={headerLogo}
                alt={appName}
                className={cn('max-w-full', identity.logo_dark && 'dark:hidden')}
                style={showLabels ? undefined : { width: '2rem', height: '2rem' }}
              />
              {identity.logo_dark && (
                <AppImage
                  size="logo"
                  src={identity.logo_dark}
                  alt={appName}
                  className="hidden max-w-full dark:block"
                  style={showLabels ? undefined : { width: '2rem', height: '2rem' }}
                />
              )}
            </>
          ) : showLabels ? (
            <span className="font-bold text-lg tracking-tight">{appName}</span>
          ) : (
            <span className="font-bold text-lg">{appName.charAt(0)}</span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Main navigation">
          {topItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              href={item.path}
              icon={navIcon(item.icon)}
              active={isNavActive(item, pathname, search)}
              showLabels={showLabels}
            />
          ))}

          {/* Bundles (Content): one collapsible entry that holds all of the bundle's parts */}
          {bundles.map((bundle) => {
            const open =
              openGroups[bundle.key] ?? bundle.items.some((i) => isNavActive(i, pathname, search))
            return (
              <NavSectionBox
                key={bundle.key}
                label={bundle.label}
                icon={navIcon(bundle.icon)}
                open={open}
                highlighted={false}
                showLabels={showLabels}
                onToggle={() => toggleGroup(bundle.key)}
              >
                {bundle.items.map((item) => (
                  <NavLink
                    key={item.path}
                    label={item.label}
                    href={item.path}
                    icon={navIcon(item.icon)}
                    active={isNavActive(item, pathname, search)}
                    showLabels={showLabels}
                  />
                ))}
              </NavSectionBox>
            )
          })}

          {/* Per-type settings screens: data-driven, one per active type */}
          {canViewSettings &&
            typeLeaves.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                href={item.path}
                icon={navIcon(item.icon)}
                active={pathname === item.path}
                showLabels={showLabels}
              />
            ))}

          {/* Groups declared by the manifests (Media, Access Control, Settings, ...) */}
          {groups.map((group) => {
            // Leaves in a group match exactly, so '/admin/settings/types' never marks a sibling.
            const hasActive = group.items.some((i) => isNavActive(i, pathname, search, true))
            const open = openGroups[group.key] ?? hasActive
            return (
              <NavSectionBox
                key={group.key}
                label={group.label}
                icon={navIcon(group.icon)}
                open={open}
                highlighted={hasActive}
                showLabels={showLabels}
                onToggle={() => toggleGroup(group.key)}
              >
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    label={item.label}
                    href={item.path}
                    icon={navIcon(item.icon)}
                    active={isNavActive(item, pathname, search, true)}
                    showLabels={showLabels}
                  />
                ))}
              </NavSectionBox>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
