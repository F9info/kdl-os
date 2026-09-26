import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

interface Project {
  id: string
  is_default: boolean
}

/**
 * Resolves the effective projectId for a project-scoped admin CRUD page
 * (Team/FAQ/Case Studies/Sectors, and any future one) — an explicit
 * `?projectId=` in the URL always wins, otherwise falls back to whichever
 * project is marked `is_default`. Every one of these pages' sidebar nav
 * link carries no projectId at all, so without this fallback, clicking
 * "Sectors"/"Team"/"FAQ"/"Case Studies" from the sidebar always dead-ended
 * into a "manually add ?projectId= to the URL" instruction — even though
 * a real default project already exists for the common single-project
 * case this app is actually used in today.
 */
export function useDefaultProjectId() {
  const fromUrl = useSearchParams().get('projectId')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects-for-default'],
    queryFn: () => api.get('/projects').then((r) => r.data.data as Project[]),
    enabled: !fromUrl,
  })

  if (fromUrl) return { projectId: fromUrl, isLoading: false }

  const defaultProject = projects?.find((p) => p.is_default) ?? projects?.[0]
  return { projectId: defaultProject?.id ?? null, isLoading }
}
