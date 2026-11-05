import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import ColorPalettePage from '@/app/admin/color-palette/page'
import BrandsPage from '@/app/admin/brands/page'
import PagesPage from '@/app/admin/pages/page'

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  cont: vi.fn(),
  hasLogo: { v: true },
  identityLogo: { v: false },
  run: { v: { id: 'run-1', stages: [] } as unknown },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: h.replace, push: vi.fn() }) }))
vi.mock('@/admin/hooks/useDefaultProjectId', () => ({
  useDefaultProjectId: () => ({ projectId: 'proj-1', isLoading: false }),
}))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/hooks/useIdentity', () => ({
  useIdentity: () => ({
    identity: h.identityLogo.v ? { logo_light: 'https://x/l.png' } : {},
    isLoading: false,
  }),
}))
vi.mock('@/admin/hooks/useTemplateEngine', () => ({
  useTemplateEngineRuns: () => ({ data: [h.run.v], isLoading: false }),
  useBrandKit: () => ({ data: { logo_media_id: h.hasLogo.v ? 'm1' : null }, isLoading: false }),
  useContinueToPalette: () => ({
    mutate: h.cont,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  h.hasLogo.v = true
  h.identityLogo.v = false
})

describe('CMS → Color Palette / Brands', () => {
  it('Pages opens the Web app Pages view of the website stage', async () => {
    h.cont.mockImplementation((_run: unknown, o: { onSuccess: () => void }) => o.onSuccess())
    render(<PagesPage />)
    await waitFor(() =>
      expect(h.replace).toHaveBeenCalledWith(
        '/admin/template-engine/projects/proj-1/website?view=pages'
      )
    )
    expect(JSON.parse(window.localStorage.getItem('te-website-ui:proj-1')!)).toEqual({
      openBrand: 'webapp',
      webAppStep: 'assemble',
    })
  })

  it('Brands resets the website stage to the brand cards', async () => {
    window.localStorage.setItem(
      'te-website-ui:proj-1',
      JSON.stringify({ openBrand: 'webapp', webAppStep: 'assemble' })
    )
    h.cont.mockImplementation((_run: unknown, o: { onSuccess: () => void }) => o.onSuccess())
    render(<BrandsPage />)
    await waitFor(() => expect(h.replace).toHaveBeenCalled())
    expect(JSON.parse(window.localStorage.getItem('te-website-ui:proj-1')!).openBrand).toBeNull()
  })

  it('Brands opens the website (Brands) stage', async () => {
    h.cont.mockImplementation((_run: unknown, o: { onSuccess: () => void }) => o.onSuccess())
    render(<BrandsPage />)
    await waitFor(() =>
      expect(h.replace).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/website')
    )
  })

  it('opens the project Color Palette page once the run is ready', async () => {
    h.cont.mockImplementation((_run: unknown, o: { onSuccess: () => void }) => o.onSuccess())
    render(<ColorPalettePage />)
    await waitFor(() =>
      expect(h.replace).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
    )
    expect(h.cont).toHaveBeenCalledWith(h.run.v, expect.any(Object))
  })

  it('a project with no logo of its own but a company logo in Identity opens the stage (it starts from the company logo)', async () => {
    h.hasLogo.v = false
    h.identityLogo.v = true
    render(<ColorPalettePage />)
    await waitFor(() =>
      expect(h.replace).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
    )
    expect(screen.queryByRole('link', { name: /Go to Identity/ })).toBeNull()
  })

  it('without a logo it sends the user to Identity instead', async () => {
    h.hasLogo.v = false
    render(<ColorPalettePage />)
    const link = await screen.findByRole('link', { name: /Go to Identity/ })
    expect(link.getAttribute('href')).toBe('/admin/settings/identity')
    expect(h.cont).not.toHaveBeenCalled()
  })
})
