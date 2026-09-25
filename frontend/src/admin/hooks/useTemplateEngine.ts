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
  BrandKitTypography,
} from '@/admin/types/template-engine.types'
import { stageEnumToSlug } from '@/admin/types/template-engine.types'
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

/**
 * Re-runs the Website stage of an already-built site so company contact details baked into its
 * pages (phone, email, address) pick up an Identity change. Name and logo need no re-run: they are
 * applied live. No-op until the Website stage has run.
 */
export async function resyncBuiltWebsite(projectId: string): Promise<void> {
  const runs = (
    await api.get<{ success: boolean; data: TemplateEngineRun[] }>(`${BASE}/runs`, {
      params: { projectId },
    })
  ).data.data
  const run = runs[0]
  if (!run || run.stages.find((st) => st.stage === 'WEBSITE')?.status !== 'DONE') return
  let navigationPages: string[] = []
  try {
    const raw = window.localStorage.getItem(`te-website-ui:${projectId}:navigation`)
    navigationPages = raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    // storage unavailable/corrupt — falls back to the default page set
  }
  await api.post(
    `${BASE}/runs/${run.id}/stages/${stageEnumToSlug('WEBSITE')}/advance`,
    { navigationPages },
    projectScope(projectId)
  )
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

// Most callers just need `mutate('STAGE')`; the WEBSITE stage also needs to
// send its Templates-step pack choice, so a `{ stage, body }` form is
// accepted too — a bare DagStage stays the common case everywhere else.
/** Creates/refreshes the project's generated Next.js folder (frontend/projects/<slug>); the backend keeps it in sync afterwards. */
export function useCreateSite(projectId: string) {
  return useMutation({
    mutationFn: () =>
      api
        .post<{ success: boolean; data: { slug: string; pages: number } }>(`${BASE}/site`, {
          projectId,
        })
        .then((r) => r.data.data),
    onSuccess: (d) =>
      toast({
        title: `Project folder ready: frontend/projects/${d.slug}`,
        description: `${d.pages} page(s) synced`,
      }),
    onError: (err) => toast({ title: extractErrorCode(err), variant: 'destructive' }),
  })
}

export interface StaticBuildStatus {
  state: 'idle' | 'running' | 'done' | 'failed'
  log: string
  /** Project slug and where the finished folder is on the host (frontend/projects/<slug>/out). */
  slug?: string
  folder?: string
  finishedAt?: number
}

/** One-click static export: status (polled while running), start, and zip download. */
export function useStaticBuild(projectId: string) {
  const qc = useQueryClient()
  const key = ['static-build', projectId]
  const status = useQuery({
    queryKey: key,
    enabled: !!projectId,
    queryFn: () =>
      api
        .get<{ data: StaticBuildStatus }>(`${BASE}/site/static`, projectScope(projectId))
        .then((r) => r.data.data),
    // Slow poll: the API limiter is 100 requests / 15 min in production.
    refetchInterval: (q) => (q.state.data?.state === 'running' ? 10_000 : false),
  })
  const start = useMutation({
    // siteUrl = where the exported folder will be hosted: it gives pages canonical addresses and a sitemap.
    mutationFn: ({ apiBase, siteUrl = '' }: { apiBase: string; siteUrl?: string }) =>
      api.post(`${BASE}/site/static`, { apiBase, siteUrl }, projectScope(projectId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err) => toast({ title: extractErrorCode(err), variant: 'destructive' }),
  })
  const download = async () => {
    const r = await api.get<Blob>(`${BASE}/site/static/download`, {
      ...projectScope(projectId),
      responseType: 'blob',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(r.data)
    a.download = 'static-site.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoking right after click() can cancel the download before the browser starts it.
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }
  return { status, start, download }
}

// "Convert" on ONE landing page: its own folder, rewritten by every Convert of that page.
export function useLandingStatic(projectId: string, siteId: string) {
  const qc = useQueryClient()
  const key = ['landing-static', projectId, siteId]
  const base = `${BASE}/site/landing/${siteId}/static`
  const status = useQuery({
    queryKey: key,
    enabled: !!projectId && !!siteId,
    queryFn: () =>
      api.get<{ data: StaticBuildStatus }>(base, projectScope(projectId)).then((r) => r.data.data),
    refetchInterval: (q) => (q.state.data?.state === 'running' ? 10_000 : false),
  })
  const start = useMutation({
    mutationFn: () => api.post(base, {}, projectScope(projectId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err) => toast({ title: extractErrorCode(err), variant: 'destructive' }),
  })
  const download = async () => {
    const r = await api.get<Blob>(`${base}/download`, {
      ...projectScope(projectId),
      responseType: 'blob',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(r.data)
    a.download = 'landing-page.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }
  return { status, start, download }
}

type AdvanceStagePayload = DagStage | { stage: DagStage; body?: Record<string, unknown> }

export function useAdvanceStage(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    // Advance/retry/skip return the mutated stage record, not the run —
    // invalidate both run caches so the UI refetches the fresh run.
    mutationFn: (payload: AdvanceStagePayload) => {
      const { stage, body } =
        typeof payload === 'string' ? { stage: payload, body: undefined } : payload
      return api
        .post<{ success: boolean; data: TemplateEngineStage }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/advance`,
          body,
          projectScope(projectId)
        )
        .then((r) => r.data.data)
    },
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

/**
 * "Next" from Website Details: makes sure a run exists and the Overview (INTAKE) stage is done,
 * so the Color Palette page opens unlocked. Resolves with the run.
 */
export function useContinueToPalette(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (existing: TemplateEngineRun | undefined) => {
      let run = existing
      if (!run) {
        const res = await api.post<{ success: boolean; data: TemplateEngineRun }>(`${BASE}/runs`, {
          projectId,
        })
        run = res.data.data
      }
      const intake = run.stages.find((st) => st.stage === 'INTAKE')
      if (intake?.status !== 'DONE' && intake?.status !== 'SKIPPED') {
        await api.post(
          `${BASE}/runs/${run.id}/stages/${stageEnumToSlug('INTAKE')}/advance`,
          undefined,
          projectScope(projectId)
        )
      }
      return run
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: runsKey(projectId) }),
    onError: (err) => toast({ title: extractErrorCode(err), variant: 'destructive' }),
  })
}

export function useGenerateWebsiteCopy(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api
        .post<{ success: boolean; data: { patchedBlocks: string[] } }>(
          `${BASE}/runs/${runId}/stages/website/generate-copy`,
          undefined,
          projectScope(projectId)
        )
        .then((r) => r.data.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: runKey(runId) })
      if (result.patchedBlocks.length > 0) {
        toast({ title: `Generated content for ${result.patchedBlocks.length} section(s)` })
      } else {
        toast({
          title: 'Nothing to generate',
          description:
            'Every section already has hand-edited content, or AI generation is not configured.',
        })
      }
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
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
      // The admin sidebar/dashboard logo now follows this project's brand-kit
      // logo (backend writes straight into the same SettingField on upload) —
      // refetch it immediately instead of waiting for a page reload.
      qc.invalidateQueries({ queryKey: ['app-logo'] })
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

// PATCH /brand-kit/:projectId — typography is one of the three PATCHABLE_FIELDS
// (backend brand-kit/service.js), same endpoint usePatchBrandKit uses for palette.
export function usePatchTypography(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (typography: BrandKitTypography) =>
      api
        .patch<{ success: boolean; data: BrandKit }>(`/brand-kit/${projectId}`, { typography })
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
