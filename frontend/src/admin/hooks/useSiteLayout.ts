import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import {
  mergeLayoutSelection,
  readLocal,
  websiteLayoutStorageKey,
  type LayoutSelection,
} from '@/admin/lib/website-layout-overrides'

type Stored = Partial<LayoutSelection>

export const siteLayoutKey = (projectId: string) => ['site-layout', projectId] as const

// The Layout page's choice is saved per project on the server (site_layouts). Before this it lived
// only in this browser's localStorage. A project with nothing saved yet adopts the old browser
// value once (copied to the server), so nobody loses a design they already picked.
export async function fetchSiteLayout(projectId: string): Promise<Stored> {
  const server = (await api.get(`/projects/${projectId}/layout`)).data.data.layout as Stored | null
  if (server) return server
  const legacy = readLocal<Stored>(websiteLayoutStorageKey(projectId), {})
  if (Object.keys(legacy).length > 0) {
    try {
      await api.put(`/projects/${projectId}/layout`, mergeLayoutSelection(legacy))
    } catch {
      // no projects:update — keep using the browser value for now
    }
  }
  return legacy
}

export async function saveSiteLayout(
  projectId: string,
  selection: LayoutSelection
): Promise<Stored> {
  return (await api.put(`/projects/${projectId}/layout`, selection)).data.data.layout as Stored
}

/** The project's saved header/footer selection (defaults filled in). */
export function useSiteLayout(projectId: string | null) {
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: siteLayoutKey(projectId ?? ''),
    queryFn: () => fetchSiteLayout(projectId as string),
    enabled: Boolean(projectId),
    // Show the old browser value instantly while the server answers, so there is no design flash.
    placeholderData: () =>
      projectId ? readLocal<Stored>(websiteLayoutStorageKey(projectId), {}) : {},
  })
  // Still loading while only the placeholder is available, so callers never seed from it.
  return {
    selection: mergeLayoutSelection(data ?? {}),
    isLoading: isLoading || isPlaceholderData,
    stored: data,
  }
}

/** Fresh read for non-hook code (e.g. before running the Website stage). */
export function useFetchSiteLayout() {
  const qc = useQueryClient()
  return async (projectId: string): Promise<LayoutSelection> =>
    mergeLayoutSelection(
      await qc.fetchQuery({
        queryKey: siteLayoutKey(projectId),
        queryFn: () => fetchSiteLayout(projectId),
        staleTime: 0,
      })
    )
}
