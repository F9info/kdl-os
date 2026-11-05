/**
 * Issue 9 — website copy (Vision/Mission/tagline) is per-project. The hook must
 * ask the public endpoint for the block's project so a project's override wins
 * and two projects never share copy.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSettingsFieldValues } from '@/frontend/blocks/packs/use-settings-field-values'

function setup(fetchImpl: (...args: unknown[]) => unknown) {
  const fetchMock = vi.fn(fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { fetchMock, wrapper }
}
const ok = (values: Record<string, string>) => () =>
  Promise.resolve({ json: () => Promise.resolve({ data: { values } }) })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('useSettingsFieldValues', () => {
  it('sends project_id when a project is given', async () => {
    const { fetchMock, wrapper } = setup(ok({ 'tagline-text': 'A tagline' }))
    const { result } = renderHook(() => useSettingsFieldValues(['tagline-text'], 'proj-A'), {
      wrapper,
    })
    await waitFor(() => expect(result.current['tagline-text']).toBe('A tagline'))
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      '/api/setting-fields/public/values?slugs=tagline-text&project_id=proj-A'
    )
  })

  it('omits project_id when no project is known (global values)', async () => {
    const { fetchMock, wrapper } = setup(ok({ a: '1' }))
    const { result } = renderHook(() => useSettingsFieldValues(['a']), { wrapper })
    await waitFor(() => expect(result.current.a).toBe('1'))
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/setting-fields/public/values?slugs=a')
  })

  it("falls back to the generated site's NEXT_PUBLIC_SITE_PROJECT_ID", async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_PROJECT_ID', 'site-proj')
    const { fetchMock, wrapper } = setup(ok({ a: '1' }))
    const { result } = renderHook(() => useSettingsFieldValues(['a']), { wrapper })
    await waitFor(() => expect(result.current.a).toBe('1'))
    expect(String(fetchMock.mock.calls[0]![0])).toContain('&project_id=site-proj')
  })

  it('different projects use different cache entries', async () => {
    const { fetchMock, wrapper } = setup(ok({ a: 'x' }))
    const { rerender, result } = renderHook(({ p }) => useSettingsFieldValues(['a'], p), {
      wrapper,
      initialProps: { p: 'proj-A' },
    })
    await waitFor(() => expect(result.current.a).toBe('x'))
    rerender({ p: 'proj-B' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1]![0])).toContain('project_id=proj-B')
  })
})
