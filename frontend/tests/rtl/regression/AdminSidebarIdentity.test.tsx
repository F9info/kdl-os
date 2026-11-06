import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { AdminSidebar } from '@/admin/components/layout/AdminSidebar'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
import api from '@/lib/axios'

function mockIdentity(identity: Record<string, string>) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    const data = url === '/app-config' ? { identity } : {}
    return Promise.resolve({ data: { data } }) as ReturnType<typeof api.get>
  })
}

describe('AdminSidebar header identity', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('shows the application name from identity', async () => {
    mockIdentity({ app_name: 'Acme Console' })
    render(<AdminSidebar />)
    expect(await screen.findByText('Acme Console')).toBeInTheDocument()
  })

  it('shows the identity logo instead of the name', async () => {
    mockIdentity({ app_name: 'Acme Console', logo_light: 'https://cdn.test/logo.png' })
    render(<AdminSidebar />)
    const img = await screen.findByAltText('Acme Console')
    expect(img.getAttribute('src')).toContain('logo.png')
  })

  // The surface colours come from the Theme Engine (`data-theme`), not from the OS-driven Tailwind
  // `dark` class. Keying the logo off `dark:` showed the white dark-background logo on a light
  // sidebar (a blank header) whenever the OS was dark but the saved Active Theme was light.
  it('swaps to the dark logo by the Theme Engine theme, never by the OS dark class', async () => {
    mockIdentity({
      app_name: 'Acme Console',
      logo_light: 'https://cdn.test/light.png',
      logo_dark: 'https://cdn.test/dark.png',
    })
    render(<AdminSidebar />)
    const imgs = await screen.findAllByAltText('Acme Console')
    const [light, dark] = imgs
    expect(light!.className).toContain('[[data-theme=dark]_&]:hidden')
    expect(dark!.className).toContain('[[data-theme=dark]_&]:block')
    for (const img of imgs) expect(img.className).not.toMatch(/(^|\s)dark:/)
  })

  it('falls back to KDL Admin when identity is empty', async () => {
    mockIdentity({})
    render(<AdminSidebar />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/app-config'))
    expect(screen.getByText('KDL Admin')).toBeInTheDocument()
  })
})
