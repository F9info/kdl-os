import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSetActiveProject } from '@/admin/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, ...renderHook(() => useSetActiveProject(), { wrapper }) }
}

describe('useSetActiveProject', () => {
  beforeEach(() => useProjectStore.setState({ activeProjectId: 'p-1' }))

  it('stores the new project', () => {
    const { result } = setup()
    act(() => result.current('p-2'))
    expect(useProjectStore.getState().activeProjectId).toBe('p-2')
  })

  it('refetches data of the old project but keeps the projects list', () => {
    const { result, qc } = setup()
    qc.setQueryData(['projects'], [{ id: 'p-1' }])
    qc.setQueryData(['team'], [{ id: 'member-of-p-1' }])
    qc.setQueryData(['forms', 'list'], [])
    act(() => result.current('p-2'))
    expect(qc.getQueryState(['team'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['forms', 'list'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['projects'])?.isInvalidated).toBe(false)
  })

  it('does nothing when the project does not change', () => {
    const { result, qc } = setup()
    qc.setQueryData(['team'], [])
    act(() => result.current('p-1'))
    expect(qc.getQueryState(['team'])?.isInvalidated).toBe(false)
  })
})
