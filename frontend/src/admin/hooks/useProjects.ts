import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { ProjectKind, ProjectStatus } from '@/admin/lib/project-kinds'

export interface Project {
  id: string
  name: string
  slug: string
  is_default: boolean
  kinds: ProjectKind[]
  status: ProjectStatus
  config: Record<string, unknown>
}

export interface ProjectInput {
  name: string
  slug: string
  kinds: ProjectKind[]
  status: ProjectStatus
}

export const projectsKey = ['projects'] as const

/** Pass `enabled: false` when the person lacks `projects:view`, so no request is made and no 403 is raised. */
export function useProjects({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: projectsKey,
    enabled,
    queryFn: () => api.get('/projects').then((r) => r.data.data as Project[]),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      api.post('/projects', input).then((r) => r.data.data as Project),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ProjectInput> & { id: string }) =>
      api.patch(`/projects/${id}`, input).then((r) => r.data.data as Project),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  })
}
