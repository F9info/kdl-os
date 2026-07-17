'use client'

import { useState } from 'react'
import { useShortcut } from '@/hooks/useShortcut'
import { CommandPalette } from '@/components/command/CommandPalette'
import { ShortcutsHelpDialog } from '@/components/command/ShortcutsHelpDialog'

// Mounted once in AdminShell — owns open state for the command palette
// (Cmd/Ctrl-K) and the shortcuts help dialog (?), and registers the global
// shortcuts that open them.
export function CommandMenu() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useShortcut('mod+k', () => setPaletteOpen((prev) => !prev), { label: 'Open command palette' })
  useShortcut('?', () => setShortcutsOpen((prev) => !prev), { label: 'Show keyboard shortcuts' })

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsHelpDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
