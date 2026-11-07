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
 * The active project. When nothing valid is stored (first visit, or the stored project was deleted or
 * archived) it falls back to the usable project flagged default, then the first usable one.
 * An archived project is never returned.
 */
export function resolveActiveProject<
  T extends { id: string; status?: string; is_default?: boolean },
>(projects: readonly T[] | undefined, activeProjectId: string | null): T | null {
  if (!projects || projects.length === 0) return null
  const usable = projects.filter((p) => p.status !== 'ARCHIVED')
  return (
    usable.find((p) => p.id === activeProjectId) ??
    usable.find((p) => p.is_default) ??
    usable[0] ??
    null
  )
}

/**
 * The project to work in, for code that is not a hook (query functions, effects): the one chosen in
 * the switcher, else the default project, else the first. Hooks should use `useDefaultProjectId`.
 */
export function pickProject<T extends { id: string; status?: string; is_default?: boolean }>(
  projects: readonly T[]
): T | null {
  const { activeProjectId } = useProjectStore.getState()
  return (
    resolveActiveProject(projects, activeProjectId) ??
    projects.find((p) => p.is_default) ??
    projects[0] ??
    null
  )
}
