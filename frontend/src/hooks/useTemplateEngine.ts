import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import api from '@/lib/axios'
import type {
  TemplateEngineRun,
  DagStage,
  ExportManifest,
  BrandKit,
} from '@/types/template-engine.types'
import { stageEnumToSlug } from '@/types/template-engine.types'
import { toast } from '@/hooks/use-toast'

function extractErrorCode(err: unknown): string {
  const data = (err as AxiosError<{ code?: string; error?: string }>).response?.data
  return data?.code ?? data?.error ?? 'Request failed'
}

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

export function useAdvanceStage(runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineRun }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/advance`
        )
        .then((r) => r.data.data),
    onSuccess: (run) => {
      qc.setQueryData(runKey(runId), run)
      qc.invalidateQueries({ queryKey: runsKey(run.projectId) })
    },
  })
}

export function useBrandKit(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? ['brand-kit', projectId] : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: BrandKit }>(`/brand-kit/${projectId}`)
        .then((r) => r.data.data),
    enabled: !!projectId,
    staleTime: 10_000,
  })
}

export function useRetryStage(runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineRun }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/retry`
        )
        .then((r) => r.data.data),
    onSuccess: (run) => {
      qc.setQueryData(runKey(runId), run)
      qc.invalidateQueries({ queryKey: runsKey(run.projectId) })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
    },
  })
}

export function useSkipStage(runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineRun }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/skip`
        )
        .then((r) => r.data.data),
    onSuccess: (run) => {
      qc.setQueryData(runKey(runId), run)
      qc.invalidateQueries({ queryKey: runsKey(run.projectId) })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
    },
  })
}

export function useExportManifest(runId: string | null) {
  return useQuery({
    queryKey: runId ? ['template-engine', 'export', runId] : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: ExportManifest }>(`${BASE}/runs/${runId}/export`)
        .then((r) => r.data.data),
    enabled: !!runId,
    staleTime: 30_000,
  })
}
