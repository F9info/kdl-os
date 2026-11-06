import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '../utils'

const h = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get } }))

function stubMatchMedia(light: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('light') ? light : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {}, // older API, still called by the test wrapper's theme library
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  h.get.mockReset()
  h.get.mockResolvedValue({ data: { data: { css: ':root{}', activeTheme: 'dark' } } })
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
})
afterEach(() => vi.unstubAllEnvs())

async function mountProvider() {
  vi.resetModules()
  const { ThemeEngineProvider } = await import('@/components/providers/ThemeEngineProvider')
  render(<ThemeEngineProvider>x</ThemeEngineProvider>)
}

describe('ThemeEngineProvider on a static website', () => {
  it('asks no server for the theme and applies the theme chosen at conversion', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_SITE', '1')
    vi.stubEnv('NEXT_PUBLIC_THEME_ACTIVE', 'light')
    stubMatchMedia(false) // a dark OS must not override the saved light theme
    await mountProvider()
    expect(h.get).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('a baked "system" theme follows the visitor system setting', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_SITE', '1')
    vi.stubEnv('NEXT_PUBLIC_THEME_ACTIVE', 'system')
    stubMatchMedia(false)
    await mountProvider()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('a dark theme chosen at conversion stays dark', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_SITE', '1')
    vi.stubEnv('NEXT_PUBLIC_THEME_ACTIVE', 'dark')
    stubMatchMedia(true)
    await mountProvider()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('the normal app still loads its theme from the server', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_SITE', '')
    stubMatchMedia(true)
    await mountProvider()
    await vi.waitFor(() =>
      expect(h.get).toHaveBeenCalledWith('/theme-engine/tokens', expect.anything())
    )
  })
})
