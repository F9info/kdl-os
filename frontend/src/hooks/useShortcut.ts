'use client'

import { useEffect, useId, useRef } from 'react'
import { useShortcutsStore } from '@/stores/shortcuts.store'

export interface ShortcutOptions {
  /** Shown in the shortcuts help dialog (?). */
  label: string
  enabled?: boolean
  /** Fire even while an <input>/<textarea>/contentEditable is focused. */
  allowInInputs?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

// Combo syntax: "mod+k" (mod = Cmd on Mac, Ctrl elsewhere), "shift+?", "escape".
// Single key + modifier only — no chorded sequences (e.g. "g d").
function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim())
  const key = parts[parts.length - 1]
  const wantMod = parts.includes('mod')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')

  if (event.key.toLowerCase() !== key) return false
  if (wantMod !== (event.metaKey || event.ctrlKey)) return false
  if (wantAlt !== event.altKey) return false
  if (wantShift && !event.shiftKey) return false
  return true
}

/**
 * Registers a global keyboard shortcut and lists it in the shortcuts help
 * dialog (?) for as long as the calling component is mounted.
 */
export function useShortcut(combo: string, handler: () => void, options: ShortcutOptions) {
  const { label, enabled = true, allowInInputs = false } = options
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const id = useId()
  const register = useShortcutsStore((s) => s.register)
  const unregister = useShortcutsStore((s) => s.unregister)

  useEffect(() => {
    if (!enabled) return
    register({ id, keys: combo, label })
    return () => unregister(id)
  }, [id, combo, label, enabled, register, unregister])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!allowInInputs && isEditableTarget(event.target) && combo.toLowerCase() !== 'escape') return
      if (matchesCombo(event, combo)) {
        event.preventDefault()
        handlerRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo, enabled, allowInInputs])
}
