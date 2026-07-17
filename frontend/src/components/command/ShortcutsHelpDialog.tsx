'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useShortcutsStore } from '@/stores/shortcuts.store'

// Renders "mod+k" -> "⌘K" / "Ctrl K" depending on platform, "shift+?" -> "Shift ?".
function formatCombo(combo: string): string {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
  const labels: Record<string, string> = {
    mod: isMac ? '⌘' : 'Ctrl',
    shift: 'Shift',
    alt: isMac ? '⌥' : 'Alt',
    escape: 'Esc',
  }
  return combo
    .split('+')
    .map((part) => labels[part.toLowerCase()] ?? part.toUpperCase())
    .join(' ')
}

interface ShortcutsHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const entries = useShortcutsStore((s) => s.entries)
  const shortcuts = Object.values(entries).sort((a, b) => a.label.localeCompare(b.label))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Available on this screen right now.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border" aria-label="Keyboard shortcuts">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id} className="flex items-center justify-between py-2 text-sm">
              <span>{shortcut.label}</span>
              <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                {formatCombo(shortcut.keys)}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
