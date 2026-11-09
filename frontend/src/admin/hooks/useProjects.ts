import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useProjectStore } from '@/stores/project.store'
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

/** T12: tick or untick a step of the guided workflow (merge-only on the server). */
export function useSetWorkflowStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, step, done }: { id: string; step: string; done: boolean }) =>
      api.put(`/projects/${id}/workflow`, { step, done }).then((r) => r.data.data.workflow),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  })
}

export interface LaunchPage {
  id: string
  slug: string
  title: string
  status: string
  errors: number
  warnings: number
  can_publish: boolean
  issues: { code: string; severity?: string; message: string }[]
}
export interface LaunchReport {
  ready: boolean
  pages: LaunchPage[]
  launch: { at: string; published: number } | null
}

/** T13: what Launch would publish, with each page's problems. */
export function useLaunchCheck(projectId: string | undefined) {
  return useQuery({
    queryKey: ['launch-check', projectId],
    enabled: !!projectId,
    queryFn: () =>
      api.get(`/projects/${projectId}/launch`).then((r) => r.data.data as LaunchReport),
  })
}

export function useLaunch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) =>
      api.post(`/projects/${id}/launch`, { force }).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['launch-check'] })
      void qc.invalidateQueries({ queryKey: projectsKey })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey }),
  })
}

/**
 * Switch the project the admin works in. Cached lists (pages, team, forms, ...) belong to the project that
 * was active, so they are refetched; the projects list itself is the same for every project and is kept.
 */
export function useSetActiveProject() {
  const qc = useQueryClient()
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId)
  return useCallback(
    (id: string | null) => {
      if (id === useProjectStore.getState().activeProjectId) return
      setActiveProjectId(id)
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== projectsKey[0] })
    },
    [qc, setActiveProjectId]
  )
}
