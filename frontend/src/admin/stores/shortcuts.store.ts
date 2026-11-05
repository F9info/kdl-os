import { create } from 'zustand'

export interface ShortcutEntry {
  id: string
  keys: string
  label: string
}

interface ShortcutsState {
  entries: Record<string, ShortcutEntry>
  register: (entry: ShortcutEntry) => void
  unregister: (id: string) => void
}

// Not persisted — shortcuts re-register on every mount from useShortcut(),
// so this only ever needs to reflect what's currently on screen.
export const useShortcutsStore = create<ShortcutsState>((set) => ({
  entries: {},
  register: (entry) => set((state) => ({ entries: { ...state.entries, [entry.id]: entry } })),
  unregister: (id) =>
    set((state) => {
      const entries = { ...state.entries }
      delete entries[id]
      return { entries }
    }),
}))
