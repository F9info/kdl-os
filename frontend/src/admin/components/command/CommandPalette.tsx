'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Keyboard, LogOut, Moon, PanelLeft, Sun } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useModules } from '@/admin/hooks/useModules'
import { navIcon } from '@/admin/lib/nav-icons'
import { flattenNav } from '@/admin/lib/nav-model'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useAuth } from '@/admin/hooks/useAuth'
import { useUiStore } from '@/admin/stores/ui.store'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenShortcuts: () => void
}

export function CommandPalette({ open, onOpenChange, onOpenShortcuts }: CommandPaletteProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const { logout } = useAuth()
  const { toggleSidebar } = useUiStore()
  const { navModel } = useModules()
  const { resolvedTheme, setTheme } = useTheme()

  // The sidebar's own nav model (module manifests), filtered by the same permission gate, so the
  // palette lists exactly the links the sidebar can show and never one the user can't use.
  const navCommands = useMemo(
    () => flattenNav(navModel).filter((item) => !item.permission || can(item.permission)),
    [navModel, can]
  )

  const runAndClose = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Command palette">
      <CommandInput placeholder="Search pages and actions…" aria-label="Search pages and actions" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {navCommands.map((item) => {
            const Icon = navIcon(item.icon)
            return (
              <CommandItem
                key={item.path}
                value={item.label}
                onSelect={() => runAndClose(() => router.push(item.path))}
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="Toggle sidebar" onSelect={() => runAndClose(toggleSidebar)}>
            <PanelLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Toggle sidebar
          </CommandItem>
          <CommandItem
            value="Toggle theme"
            onSelect={() =>
              runAndClose(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))
            }
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Toggle theme
          </CommandItem>
          <CommandItem value="Keyboard shortcuts" onSelect={() => runAndClose(onOpenShortcuts)}>
            <Keyboard className="mr-2 h-4 w-4" aria-hidden="true" />
            Keyboard shortcuts
          </CommandItem>
          <CommandItem value="Log out" onSelect={() => runAndClose(logout)}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Log out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
