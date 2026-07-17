'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { FLAT_ITEMS, GROUPS } from '@/components/layout/AdminSidebar'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { useUiStore } from '@/stores/ui.store'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenShortcuts: () => void
}

export function CommandPalette({ open, onOpenChange, onOpenShortcuts }: CommandPaletteProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const { logout } = useAuth()
  const { toggleSidebar, theme, setTheme } = useUiStore()

  // Same nav tree the sidebar renders (KDL-292) — filtered by the same
  // permission gate so the palette never surfaces a link the user can't use.
  const navCommands = useMemo(() => {
    const flat = FLAT_ITEMS.filter((item) => !item.permission || can(item.permission))
    const grouped = GROUPS.flatMap((group) => group.children).filter(
      (item) => !item.permission || can(item.permission)
    )
    return [...flat, ...grouped]
  }, [can])

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
            const Icon = item.icon
            return (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => runAndClose(() => router.push(item.href))}
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
            onSelect={() => runAndClose(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? (
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
