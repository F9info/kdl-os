import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'

export type LayoutKind = 'TOP_HEADER' | 'HEADER' | 'FOOTER'
export type LayoutStatus = 'DRAFT' | 'PUBLISHED'

/** One saved header / footer / top-header layout of a project (backend: layout_presets). */
export interface LayoutPresetRecord {
  id: string
  project_id: string
  kind: LayoutKind
  name: string
  status: LayoutStatus
  is_default: boolean
  /** '1'-'5', 'f9', 'landing:1'-'landing:4' or custom:<id>: same meaning as a Layout page slot. */
  variant: string
  config: Record<string, string>
  version: number
  /** Pages that use this layout. */
  pages: number
  created_at: string
  updated_at: string
}

export interface LayoutInput {
  kind: LayoutKind
  name: string
  variant: string
  config: Record<string, string>
  status?: LayoutStatus
}

export const layoutLibraryKey = (projectId: string) => ['layout-library', projectId] as const

const errorText = (err: unknown) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  'Something went wrong. Please try again.'

export function useLayoutLibrary(projectId: string) {
  return useQuery({
    queryKey: layoutLibraryKey(projectId),
    queryFn: async () =>
      (await api.get(`/projects/${projectId}/layouts`)).data.data.items as LayoutPresetRecord[],
    retry: false,
  })
}

/** Create, change, duplicate, publish, set default and delete: every change refreshes the list and the site layout. */
export function useLayoutActions(projectId: string) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: layoutLibraryKey(projectId) })
    qc.invalidateQueries({ queryKey: ['layout-pages', projectId] })
    qc.invalidateQueries({ queryKey: ['site-layout', projectId] })
  }
  const base = `/projects/${projectId}/layouts`
  const onError = (err: unknown) => toast({ title: errorText(err), variant: 'destructive' })
  const done = (title: string) => () => {
    refresh()
    toast({ title })
  }
  return {
    create: useMutation({
      mutationFn: (input: LayoutInput) =>
        api.post(base, input).then((r) => r.data.data.layout as LayoutPresetRecord),
      onSuccess: done('Layout created'),
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: string } & Partial<Omit<LayoutInput, 'kind'>>) =>
        api.patch(`${base}/${id}`, patch).then((r) => r.data.data.layout as LayoutPresetRecord),
      onSuccess: done('Layout saved'),
      onError,
    }),
    duplicate: useMutation({
      mutationFn: (id: string) =>
        api.post(`${base}/${id}/duplicate`).then((r) => r.data.data.layout as LayoutPresetRecord),
      onSuccess: done('Layout duplicated as a draft'),
      onError,
    }),
    makeDefault: useMutation({
      mutationFn: (id: string) =>
        api.post(`${base}/${id}/default`).then((r) => r.data.data.layout as LayoutPresetRecord),
      onSuccess: done('Default layout changed'),
      onError,
    }),
    remove: useMutation({
      mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
        api
          .delete(`${base}/${id}`, { params: force ? { force: 'true' } : undefined })
          .then((r) => r.data.data),
      onSuccess: done('Layout deleted'),
      // A layout that pages use asks for confirmation instead of showing an error toast.
      onError: (err) => {
        if ((err as { response?: { status?: number } })?.response?.status !== 409) onError(err)
      },
    }),
  }
}

export interface LayoutPageRow {
  id: string
  title: string
  slug: string
  status: string
  header_layout_id: string | null
  footer_layout_id: string | null
}

/** The project's pages with the header/footer layout each one is assigned. */
export function useLayoutPages(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['layout-pages', projectId],
    queryFn: async () =>
      (await api.get('/page-builder', { headers: { 'X-Project-Id': projectId } })).data.data
        .items as LayoutPageRow[],
    enabled,
  })
}

export function useAssignLayout(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      pageId,
      kind,
      layoutId,
    }: {
      pageId: string
      kind: LayoutKind
      layoutId: string | null
    }) =>
      api.put(
        `/page-builder/${pageId}`,
        kind === 'HEADER' ? { header_layout_id: layoutId } : { footer_layout_id: layoutId },
        { headers: { 'X-Project-Id': projectId } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: layoutLibraryKey(projectId) })
      qc.invalidateQueries({ queryKey: ['layout-pages', projectId] })
    },
    onError: (err) => toast({ title: errorText(err), variant: 'destructive' }),
  })
}

export { errorText as layoutErrorText }
