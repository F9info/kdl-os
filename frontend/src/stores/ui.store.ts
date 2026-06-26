import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UiState {
  sidebarOpen: boolean
  theme: Theme
}

interface UiActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: Theme) => void
}

export const useUiStore = create<UiState & UiActions>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: 'system',

      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'kdl-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
