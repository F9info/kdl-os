import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UiState {
  sidebarOpen: boolean
  isMobile: boolean
  theme: Theme
}

interface UiActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setIsMobile: (isMobile: boolean) => void
  setTheme: (theme: Theme) => void
}

export const useUiStore = create<UiState & UiActions>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      isMobile: false,
      theme: 'system',

      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setIsMobile: (isMobile) => set({ isMobile }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'kdl-ui',
      storage: createJSONStorage(() => localStorage),
      // isMobile is runtime viewport state — never persist it
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen, theme: state.theme }),
    }
  )
)
