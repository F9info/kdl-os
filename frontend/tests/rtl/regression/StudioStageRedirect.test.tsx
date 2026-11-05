import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import ColorPalettePage from '@/app/admin/color-palette/page'
import BrandsPage from '@/app/admin/brands/page'
import PagesPage from '@/app/admin/pages/page'

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  cont: vi.fn(),
  hasLogo: { v: true },
  run: { v: { id: 'run-1', stages: [] } as unknown },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: h.replace, push: vi.fn() }) }))
vi.mock('@/hooks/useDefaultProjectId', () => ({
  useDefaultProjectId: () => ({ projectId: 'proj-1', isLoading: false }),
}))
vi.mock('@/components/shared/ModuleGuard', () => ({ ModuleGuard: ({ children }: any) => children }))
vi.mock('@/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/hooks/useTemplateEngine', () => ({
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

  it('without a logo it sends the user to Company Details instead', async () => {
    h.hasLogo.v = false
    render(<ColorPalettePage />)
    const link = await screen.findByRole('link', { name: /Go to Company Details/ })
    expect(link.getAttribute('href')).toBe('/admin/website-details')
    expect(h.cont).not.toHaveBeenCalled()
  })
})
