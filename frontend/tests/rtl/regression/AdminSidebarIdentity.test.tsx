import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

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

  it('falls back to KDL Admin when identity is empty', async () => {
    mockIdentity({})
    render(<AdminSidebar />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/app-config'))
    expect(screen.getByText('KDL Admin')).toBeInTheDocument()
  })
})
