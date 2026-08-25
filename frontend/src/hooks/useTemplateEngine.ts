import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import api from '@/lib/axios'
import type {
  TemplateEngineRun,
  TemplateEngineStage,
  DagStage,
  ExportManifest,
  BrandKit,
  BrandKitPalette,
} from '@/types/template-engine.types'
import { stageEnumToSlug } from '@/types/template-engine.types'
import { toast } from '@/hooks/use-toast'

function extractErrorCode(err: unknown): string {
  const data = (err as AxiosError<{ code?: string; error?: string; message?: string }>).response
    ?.data
  return data?.code ?? data?.error ?? data?.message ?? 'Request failed'
}

const BASE = '/template-engine'

// Run-scoped and stage endpoints require project scope via X-Project-Id
// (backend template-engine controller requireProjectId).
function projectScope(projectId: string) {
  return { headers: { 'X-Project-Id': projectId } }
}

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

export function useTemplateEngineRun(runId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: runId ? runKey(runId) : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: TemplateEngineRun }>(
          `${BASE}/runs/${runId}`,
          projectScope(projectId!)
        )
        .then((r) => r.data.data),
    enabled: !!runId && !!projectId,
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
    // Advance/retry/skip return the mutated stage record, not the run —
    // invalidate both run caches so the UI refetches the fresh run.
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineStage }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/advance`,
          undefined,
          projectScope(projectId)
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: runKey(runId) })
      qc.invalidateQueries({ queryKey: runsKey(projectId) })
      // Several stages (PALETTE, INFERENCE, GUIDELINES, ...) write brand-kit
      // fields server-side as a side effect of completing — without this the
      // brand-kit query stays on its pre-stage-run snapshot until something
      // else (a full page reload) forces a refetch.
      qc.invalidateQueries({ queryKey: ['brand-kit', projectId] })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
      qc.invalidateQueries({ queryKey: runKey(runId) })
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

export function useUploadLogo(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api
        .post<{ success: boolean; data: BrandKit }>(`/brand-kit/${projectId}/logo`, form)
        .then((r) => r.data.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-kit', projectId] })
      toast({ title: 'Logo uploaded' })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
    },
  })
}

// PATCH /brand-kit/:projectId only recomputes nothing server-side — the
// caller (PaletteStage) sends a fully-formed BrandKitPalette (colors + ramps
// regenerated client-side via lib/oklch-ramp). 409 APPROVED_IMMUTABLE if the
// kit is already approved (must reopen first).
export function usePatchBrandKit(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (palette: BrandKitPalette) =>
      api
        .patch<{ success: boolean; data: BrandKit }>(`/brand-kit/${projectId}`, { palette })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-kit', projectId] })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
    },
  })
}

export function useApproveBrandKit(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (acknowledgedAdjustmentIds: string[]) =>
      api
        .post<{ success: boolean; data: BrandKit }>(`/brand-kit/${projectId}/approve`, {
          acknowledgedAdjustmentIds,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-kit', projectId] })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
    },
  })
}

export function useRetryStage(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineStage }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/retry`,
          undefined,
          projectScope(projectId)
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: runKey(runId) })
      qc.invalidateQueries({ queryKey: runsKey(projectId) })
      qc.invalidateQueries({ queryKey: ['brand-kit', projectId] })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
      qc.invalidateQueries({ queryKey: runKey(runId) })
    },
  })
}

export function useSkipStage(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: DagStage) =>
      api
        .post<{ success: boolean; data: TemplateEngineStage }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/skip`,
          undefined,
          projectScope(projectId)
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: runKey(runId) })
      qc.invalidateQueries({ queryKey: runsKey(projectId) })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
      qc.invalidateQueries({ queryKey: runKey(runId) })
    },
  })
}

export function useExportManifest(runId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: runId ? ['template-engine', 'export', runId] : [],
    queryFn: () =>
      api
        .get<{ success: boolean; data: ExportManifest }>(
          `${BASE}/runs/${runId}/export`,
          projectScope(projectId!)
        )
        .then((r) => r.data.data),
    enabled: !!runId && !!projectId,
    staleTime: 30_000,
  })
}
