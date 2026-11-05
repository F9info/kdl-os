import api from '@/lib/axios'

/**
 * Lists a project's detail layouts. Converting legacy "<X> Detail" page groups into layouts is a
 * write, so it is a separate permission-gated call (ignored for read-only users) — never a GET side effect.
 */
export async function fetchDetailPageTypes<T>(projectId: string): Promise<T[]> {
  await api
    .post('/detail-page-types/convert-legacy', { project_id: projectId })
    .catch(() => undefined)
  const r = await api.get('/detail-page-types', { params: { project_id: projectId } })
  return r.data.data.items as T[]
}
