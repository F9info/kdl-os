import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// The project the admin is working in. Only the id is kept; the project itself comes from the
// projects list. T03 makes the project-scoped screens read this instead of the "default project".

interface ProjectState {
  activeProjectId: string | null
}

interface ProjectActions {
  setActiveProjectId: (id: string | null) => void
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProjectId: (id) => set({ activeProjectId: id }),
    }),
    {
      name: 'kdl-active-project',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

/**
 * The active project, or the first usable one when nothing valid is stored (first visit, or the stored
 * project was deleted or archived). The default project comes first in the list from the API.
 */
export function resolveActiveProject<T extends { id: string; status: string }>(
  projects: readonly T[] | undefined,
  activeProjectId: string | null
): T | null {
  if (!projects || projects.length === 0) return null
  const usable = projects.filter((p) => p.status !== 'ARCHIVED')
  return usable.find((p) => p.id === activeProjectId) ?? usable[0] ?? null
}
