import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import ProductsPage from '@/app/admin/settings/products/page'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
import api from '@/lib/axios'

const products = [
  { key: 'admin', name: 'Admin', description: 'Internal app' },
  { key: 'website', name: 'Website', description: 'Corporate site' },
]
const modules = [{ slug: 'menus', name: 'Menus' }]
const resolution = (selected: string[]) => ({
  valid: true,
  selected,
  unknownProducts: [],
  unknownModules: [],
  modules: selected.length ? ['menus'] : [],
  toEnable: selected.includes('website') ? ['menus'] : [],
  alreadyEnabled: [],
  conflicts: [],
  noLongerRequired: [],
})
const graph = (selected: string[]) => ({
  data: { data: { products, selected, modules, resolution: resolution(selected) } },
})

function mockApi(perms: string[], stored: string[] = ['admin']) {
  vi.mocked(api.get).mockImplementation((url: string, cfg?: { params?: unknown }) => {
    if (url === '/auth/me/permissions')
      return Promise.resolve({
        data: { data: { permissions: perms, roles: [], bypass: false } },
      }) as ReturnType<typeof api.get>
    if (url === '/modules/graph') {
      const params = cfg?.params as { products?: string } | undefined
      const sel = params ? (params.products ?? '').split(',').filter(Boolean) : stored
      return Promise.resolve(graph(sel)) as ReturnType<typeof api.get>
    }
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

describe('Products settings page', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    useAuthStore.setState({ isAuthenticated: true } as never)
  })

  it('shows stored selection and disables Apply until something changes', async () => {
    mockApi(['modules:view', 'modules:edit', 'modules:add'])
    render(<ProductsPage />)
    const admin = await screen.findByTestId('product-admin')
    expect(admin).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('product-website')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Apply products' })).toBeDisabled()
  })

  it('previews modules to turn on, then applies after confirm', async () => {
    mockApi(['modules:view', 'modules:edit', 'modules:add'])
    vi.mocked(api.put).mockResolvedValue(graph(['admin', 'website']))
    render(<ProductsPage />)
    fireEvent.click(await screen.findByTestId('product-website'))
    expect(await screen.findByTestId('to-enable')).toHaveTextContent('Menus')
    fireEvent.click(screen.getByRole('button', { name: 'Apply products' }))
    expect(api.put).not.toHaveBeenCalled() // needs confirmation first
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/modules/products', { products: ['admin', 'website'] })
    )
  })

  it('cannot apply with modules:edit but without modules:add (apply can install modules)', async () => {
    mockApi(['modules:view', 'modules:edit'])
    render(<ProductsPage />)
    fireEvent.click(await screen.findByTestId('product-website'))
    expect(screen.getByRole('button', { name: 'Apply products' })).toBeDisabled()
  })

  it('is read-only without modules:edit', async () => {
    mockApi(['modules:view'])
    render(<ProductsPage />)
    expect(await screen.findByTestId('product-admin')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Apply products' })).not.toBeInTheDocument()
  })
})
