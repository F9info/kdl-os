import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { TemplateEngineRun, DagStage, ExportManifest } from '@/types/template-engine.types'
import { stageEnumToSlug } from '@/types/template-engine.types'

const BASE = '/template-engine'

function runsKey(projectId: string) {
  return ['template-engine', 'runs', projectId]
}
function runKey(runId: string) {
  return ['template-engine', 'run', runId]
}

export function useTemplateEngineRuns(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? runsKey(projectId) : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: TemplateEngineRun[] }>(`${BASE}/runs`, {
          params: { projectId },
        })
        .then((r) => r.data.data),
    enabled: !!projectId,
    staleTime: 10_000,
  })
}

export function useTemplateEngineRun(runId: string | null) {
  return useQuery({
    queryKey: runId ? runKey(runId) : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: TemplateEngineRun }>(`${BASE}/runs/${runId}`)
        .then((r) => r.data.data),
    enabled: !!runId,
    refetchInterval: 5_000,
  })
}

export function useCreateRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) =>
      api
        .post<{ success: boolean; data: TemplateEngineRun }>(`${BASE}/runs`, { projectId })
        .then((r) => r.data.data),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: runsKey(run.projectId) })
    },
  })
}

export function useAdvanceStage(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineRun }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/advance`,
          {},
          { headers: { 'X-Project-Id': projectId } }
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: runsKey(projectId) })
    },
  })
}

export function useExportManifest(runId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: runId ? ['template-engine', 'export', runId] : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: ExportManifest }>(`${BASE}/runs/${runId}/export`, {
          headers: { 'X-Project-Id': projectId! },
        })
        .then((r) => r.data.data),
    enabled: !!runId && !!projectId,
    staleTime: 30_000,
  })
}
