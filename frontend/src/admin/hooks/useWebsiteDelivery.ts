import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { ModuleGraph } from '@/admin/components/products/ProductPicker'
import type { WebsiteDelivery } from '@/admin/lib/project-type'

/** The stored website delivery choice (null = not chosen yet). Shares the module-graph query cache. */
export function useWebsiteDelivery(): WebsiteDelivery | null {
  const { data } = useQuery({
    queryKey: ['module-graph', 'stored'],
    queryFn: () => api.get('/modules/graph').then((r) => r.data.data as ModuleGraph),
    select: (g) => g.delivery ?? null,
    staleTime: 30_000,
  })
  return data ?? null
}
