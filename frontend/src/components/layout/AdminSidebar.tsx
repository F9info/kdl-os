'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Users, Image } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Media', href: '/admin/media', icon: Image, adminOnly: true },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

export function AdminSidebar() {
  const { sidebarOpen } = useUiStore()
  const { isAdmin } = useAuth()
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      <div className="flex h-16 items-center border-b px-4">
        {sidebarOpen ? (
          <span className="font-bold text-lg tracking-tight">KDL Admin</span>
        ) : (
          <span className="font-bold text-lg">K</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2" aria-label="Main navigation">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
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
      </nav>
    </aside>
  )
}
