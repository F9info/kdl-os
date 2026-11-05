import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { SetupWizard } from '@/components/onboarding/SetupWizard'
import { SetupWizardGate } from '@/components/onboarding/SetupWizardGate'
import { useAuthStore } from '@/stores/auth.store'
import { mockPathname } from '../../__mocks__/next-navigation'

const { get, put, post } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get, put, post } }))

const products = [
  { key: 'admin', name: 'Admin', description: 'Internal app' },
  { key: 'website', name: 'Website', description: 'Corporate site' },
]
const resolution = (selected: string[]) => ({
  valid: true,
  selected,
  unknownProducts: [],
  unknownModules: [],
  modules: [],
  toEnable: [],
  alreadyEnabled: [],
  conflicts: [],
  noLongerRequired: [],
})
const graph = (selected: string[]) => ({
  data: { data: { products, selected, modules: [], resolution: resolution(selected) } },
})

function mockGet(
  opts: { answered?: boolean; perms?: { bypass: boolean; permissions: string[] } } = {}
) {
  const perms = opts.perms ?? { bypass: true, permissions: [] }
  get.mockImplementation((url: string, cfg?: { params?: { products?: string } }) => {
    if (url === '/auth/me/permissions')
      return Promise.resolve({ data: { data: { ...perms, roles: [] } } })
    if (url === '/identity')
      return Promise.resolve({
        data: { data: { identity: { app_name: 'DemoLogo', brand_primary: '' } } },
      })
    if (url === '/modules/graph')
      return Promise.resolve(
        graph(cfg?.params ? (cfg.params.products ?? '').split(',').filter(Boolean) : [])
      )
    if (url === '/projects/onboarding')
      return Promise.resolve({ data: { data: { answered: opts.answered ?? false } } })
    return Promise.resolve({ data: { data: {} } })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPathname.value = '/admin/dashboard'
  sessionStorage.clear()
  useAuthStore.setState({ isAuthenticated: true } as never)
  put.mockResolvedValue({ data: { data: {} } })
  post.mockResolvedValue({ data: { data: { choice: 'no', created: [], skipped: [] } } })
})

describe('SetupWizard', () => {
  it('step 1 prefills identity, saves it, then shows products', async () => {
    mockGet()
    render(<SetupWizard open onClose={() => {}} />)
    const input = await screen.findByDisplayValue('DemoLogo')
    fireEvent.change(input, { target: { value: 'Acme' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('What are you building?')
    expect(put).toHaveBeenCalledWith('/identity', { app_name: 'Acme', brand_primary: '' })
  })

  it('without Website: applies products, records "no website" and finishes (no website step)', async () => {
    mockGet()
    render(<SetupWizard open onClose={() => {}} />)
    await screen.findByDisplayValue('DemoLogo')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByTestId('product-admin'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('You are set up')
    expect(put).toHaveBeenCalledWith('/modules/products', { products: ['admin'] })
    expect(post).toHaveBeenCalledWith('/projects/onboarding', { frontend: 'no' })
    expect(screen.queryByText('Create a starter website?')).toBeNull()
  })

  it('with Website: asks about the starter site and creates it on Yes', async () => {
    mockGet()
    post.mockResolvedValue({
      data: { data: { choice: 'yes', created: ['home', 'about'], skipped: [] } },
    })
    render(<SetupWizard open onClose={() => {}} />)
    await screen.findByDisplayValue('DemoLogo')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByTestId('product-website'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Create a starter website?')
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, create my website' }))
    await screen.findByText('You are set up')
    expect(post).toHaveBeenCalledWith('/projects/onboarding', { frontend: 'yes' })
    expect(screen.getByText('Open Page Builder')).toBeTruthy()
  })
})

describe('SetupWizardGate', () => {
  it('stays closed when the old onboarding question was already answered', async () => {
    mockGet({ answered: true })
    render(<SetupWizardGate />)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/projects/onboarding'))
    expect(screen.queryByTestId('setup-wizard')).toBeNull()
  })

  it('opens when unanswered, and Ask me later closes it for the session', async () => {
    mockGet({ answered: false })
    render(<SetupWizardGate />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ask me later' }))
    await waitFor(() => expect(screen.queryByTestId('setup-wizard')).toBeNull())
    expect(sessionStorage.getItem('kdl_frontend_onboarding_later')).toBe('1')
    expect(post).not.toHaveBeenCalled()
  })

  it('does not open for a user who cannot change settings, modules or projects', async () => {
    mockGet({ answered: false, perms: { bypass: false, permissions: ['modules:view'] } })
    render(<SetupWizardGate />)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/auth/me/permissions'))
    expect(get).not.toHaveBeenCalledWith('/projects/onboarding')
    expect(screen.queryByTestId('setup-wizard')).toBeNull()
  })

  it('never opens over the page editor', async () => {
    mockPathname.value = '/admin/page-builder'
    mockGet({ answered: false })
    render(<SetupWizardGate />)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/projects/onboarding'))
    expect(screen.queryByTestId('setup-wizard')).toBeNull()
  })
})
