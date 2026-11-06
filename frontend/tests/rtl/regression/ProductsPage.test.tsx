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
let storedDelivery: string | null = null
const graph = (selected: string[], inferred: string[] = []) => ({
  data: {
    data: {
      products,
      selected,
      inferred,
      modules,
      resolution: resolution(selected),
      delivery: storedDelivery,
    },
  },
})

function mockApi(perms: string[], stored: string[] = ['admin'], inferred: string[] = []) {
  vi.mocked(api.get).mockImplementation((url: string, cfg?: { params?: unknown }) => {
    if (url === '/auth/me/permissions')
      return Promise.resolve({
        data: { data: { permissions: perms, roles: [], bypass: false } },
      }) as ReturnType<typeof api.get>
    if (url === '/modules/graph') {
      const params = cfg?.params as { products?: string } | undefined
      const sel = params ? (params.products ?? '').split(',').filter(Boolean) : stored
      return Promise.resolve(graph(sel, params ? [] : inferred)) as ReturnType<typeof api.get>
    }
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

describe('Products settings page', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    useAuthStore.setState({ isAuthenticated: true } as never)
    storedDelivery = null
  })

  it('shows stored selection and disables Apply until something changes', async () => {
    mockApi(['modules:view', 'modules:edit', 'modules:add'])
    render(<ProductsPage />)
    // Admin is the base of every install: not offered as a card.
    expect(await screen.findByTestId('product-website')).toBeInTheDocument()
    expect(screen.queryByTestId('product-admin')).toBeNull()
    expect(screen.getByTestId('product-website')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Apply products' })).toBeDisabled()
  })

  it('a product whose modules are all already enabled shows as On, with the reason, though never chosen here', async () => {
    mockApi(['modules:view', 'modules:edit', 'modules:add'], ['admin', 'website'], ['website'])
    render(<ProductsPage />)
    expect(await screen.findByTestId('product-website')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('inferred-products').textContent).toMatch(
      /Website is on because all the modules it needs are already enabled/
    )
  })

  it('says nothing extra when every product on was chosen here', async () => {
    mockApi(['modules:view', 'modules:edit', 'modules:add'])
    render(<ProductsPage />)
    await screen.findByTestId('product-website')
    expect(screen.queryByTestId('inferred-products')).toBeNull()
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
    expect(await screen.findByTestId('product-website')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Apply products' })).not.toBeInTheDocument()
  })

  describe('website delivery (web application / static website)', () => {
    const PERMS = ['modules:view', 'modules:edit', 'modules:add']

    it('is offered only while the Website product is on, and names what you are building', async () => {
      mockApi(PERMS)
      render(<ProductsPage />)
      await screen.findByTestId('product-website')
      expect(screen.queryByTestId('delivery')).toBeNull()
      expect(screen.getByTestId('project-type')).toHaveTextContent('Admin project')

      fireEvent.click(screen.getByTestId('product-website'))
      expect(await screen.findByTestId('delivery')).toBeInTheDocument()
      for (const v of ['web-app', 'static', 'both'])
        expect(screen.getByTestId(`delivery-${v}`)).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByTestId('project-type')).toHaveTextContent('Website')

      fireEvent.click(screen.getByTestId('delivery-static'))
      expect(screen.getByTestId('delivery-static')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('project-type')).toHaveTextContent('Static website')
      fireEvent.click(screen.getByTestId('delivery-both'))
      expect(screen.getByTestId('project-type')).toHaveTextContent(
        'Web application + Static website'
      )
    })

    it('saves the chosen delivery together with the products', async () => {
      mockApi(PERMS)
      vi.mocked(api.put).mockResolvedValue(graph(['admin', 'website']))
      render(<ProductsPage />)
      fireEvent.click(await screen.findByTestId('product-website'))
      fireEvent.click(await screen.findByTestId('delivery-static'))
      fireEvent.click(screen.getByRole('button', { name: 'Apply products' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() =>
        expect(api.put).toHaveBeenCalledWith('/modules/products', {
          products: ['admin', 'website'],
          delivery: 'static',
        })
      )
    })

    it('changing only the delivery is a change that can be applied', async () => {
      storedDelivery = 'web-app'
      mockApi(PERMS, ['admin', 'website'])
      render(<ProductsPage />)
      expect(await screen.findByTestId('delivery-web-app')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('button', { name: 'Apply products' })).toBeDisabled()
      fireEvent.click(screen.getByTestId('delivery-static'))
      expect(screen.getByRole('button', { name: 'Apply products' })).toBeEnabled()
    })
  })
})
