import { useSearchParams } from 'next/navigation'
import { useProjects } from '@/admin/hooks/useProjects'
import { resolveActiveProject, useProjectStore } from '@/stores/project.store'

/**
 * Resolves the effective projectId for a project-scoped admin CRUD page (Team, FAQ, Case Studies,
 * Sectors, Catalog, Work, Gallery, Testimonials, detail pages, Website details, and any future one).
 * The order is:
 *   1. an explicit `?projectId=` in the URL (a deep link always wins),
 *   2. the project chosen in the top bar switcher (kept in the project store),
 *   3. the project marked `is_default`, or the first one.
 * Step 3 only applies when nothing valid is chosen yet (first visit, or the chosen project was deleted
 * or archived). The name is kept so every project-scoped page switches projects through this one place.
 */
export function useDefaultProjectId() {
  const fromUrl = useSearchParams().get('projectId')
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const { data: projects, isLoading } = useProjects({ enabled: !fromUrl })

  if (fromUrl) return { projectId: fromUrl, isLoading: false }

  const project =
    resolveActiveProject(projects, activeProjectId) ??
    projects?.find((p) => p.is_default) ??
    projects?.[0] ??
    null
  return { projectId: project?.id ?? null, isLoading }
}
