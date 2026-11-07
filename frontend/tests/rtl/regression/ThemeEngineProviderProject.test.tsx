import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: { css: '', json: {}, activeTheme: 'dark' } } }),
  },
}))

beforeEach(() => {
  vi.resetModules()
  window.matchMedia =
    window.matchMedia ??
    ((() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never)
})
afterEach(() => vi.unstubAllEnvs())

const mount = async () => {
  const { default: api } = await import('@/lib/axios')
  const { ThemeEngineProvider } = await import('@/components/providers/ThemeEngineProvider')
  vi.mocked(api.get).mockClear()
  render(
    <ThemeEngineProvider>
      <span>child</span>
    </ThemeEngineProvider>
  )
  return api
}

describe('ThemeEngineProvider and projects', () => {
  it("a generated site asks for its own project's tokens", async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_PROJECT_ID', 'proj-9')
    vi.stubEnv('NEXT_PUBLIC_THEME_PLATFORM', 'webapp')
    const api = await mount()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/theme-engine/tokens', {
        params: { platform: 'webapp', project_id: 'proj-9' },
      })
    )
  })

  it('the admin app sends no project id in the query (it uses the X-Project-Id header)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_PROJECT_ID', '')
    const api = await mount()
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const params = vi.mocked(api.get).mock.calls[0]![1] as { params: Record<string, unknown> }
    expect(params.params).not.toHaveProperty('project_id')
  })
})
