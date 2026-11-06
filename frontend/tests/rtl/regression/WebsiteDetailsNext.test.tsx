import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import WebsiteDetailsPage from '@/app/admin/website-details/page'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  cont: vi.fn(),
  identity: { v: {} as Record<string, string> },
}))

vi.mock('@/lib/axios', () => ({ default: { get: h.get, put: h.put, post: h.post } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/admin/hooks/useDefaultProjectId', () => ({
  useDefaultProjectId: () => ({ projectId: 'proj-1', isLoading: false }),
}))
vi.mock('@/hooks/useIdentity', () => ({
  useIdentity: () => ({ identity: h.identity.v, isLoading: false }),
}))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/app/admin/settings/_components/TypeSettingsForm', () => ({
  TypeSettingsForm: ({ slug }: { slug: string }) => <div data-testid="type-form">{slug}</div>,
}))
vi.mock('@/admin/hooks/useTemplateEngine', () => ({
  useTemplateEngineRuns: () => ({ data: [{ id: 'run-1', stages: [] }] }),
  useContinueToPalette: () => ({ mutate: h.cont, isPending: false }),
}))

const FULL = {
  app_name: 'Acme Pvt Ltd',
  logo_light: 'https://minio.test/logo.png',
  contact_email: 'hello@acme.com',
  contact_phone: '+91 99999 00000',
  contact_address: '1 Main Rd, Hyderabad',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.identity.v = { ...FULL }
})

describe('Website Details: company info comes from Identity, not a second form (single source)', () => {
  it('has no company-name, email, phone, address or logo inputs, and never reads the legacy brand-profile fields', async () => {
    render(<WebsiteDetailsPage />)
    expect(await screen.findByText('Company details')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull() // nothing to type here
    expect(screen.queryByText(/upload logo|replace file/i)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(h.get).not.toHaveBeenCalledWith(expect.stringContaining('brand-profile'))
    expect(h.put).not.toHaveBeenCalled()
  })

  it('shows the Identity values read-only, with a link to edit them in Identity', async () => {
    render(<WebsiteDetailsPage />)
    expect(await screen.findByText('Acme Pvt Ltd')).toBeTruthy()
    expect(screen.getByText('hello@acme.com')).toBeTruthy()
    expect(screen.getByText('1 Main Rd, Hyderabad')).toBeTruthy()
    expect(screen.getByAltText('Company logo').getAttribute('src')).toBe(FULL.logo_light)
    expect(screen.getByRole('link', { name: /edit in identity/i }).getAttribute('href')).toBe(
      '/admin/settings/identity'
    )
  })

  it('has no View Frontend button', async () => {
    render(<WebsiteDetailsPage />)
    await screen.findByText('Acme Pvt Ltd')
    expect(screen.queryByText('View Frontend')).toBeNull()
  })

  it('keeps the website-specific settings (Website Content) on the page', async () => {
    render(<WebsiteDetailsPage />)
    expect((await screen.findByTestId('type-form')).textContent).toBe('website-content')
  })
})

describe('Website Details → Next → Color Palette', () => {
  it('Next continues to the Color Palette page when Identity has a name and a logo', async () => {
    h.cont.mockImplementation((_run: unknown, opts: { onSuccess: () => void }) => opts.onSuccess())
    render(<WebsiteDetailsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Next: Color Palette/ }))
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
    )
  })

  it('Skip to Brands goes straight to Brands, even before Identity is complete', async () => {
    h.identity.v = {}
    render(<WebsiteDetailsPage />)
    const link = await screen.findByRole('link', { name: /Skip to Brands/ })
    expect(link.getAttribute('href')).toBe('/admin/brands')
  })

  it('without a logo Next is disabled and points to Identity', async () => {
    h.identity.v = { app_name: 'Acme' }
    render(<WebsiteDetailsPage />)
    const next = await screen.findByRole('button', { name: /Next: Color Palette/ })
    expect((next as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Logo missing/)).toBeTruthy()
    expect(screen.getByText(/Add the missing details in Identity/)).toBeTruthy()
  })

  it('without a company name Next is disabled', async () => {
    h.identity.v = { logo_light: 'https://x/logo.png' }
    render(<WebsiteDetailsPage />)
    const next = await screen.findByRole('button', { name: /Next: Color Palette/ })
    expect((next as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Company name missing/)).toBeTruthy()
  })
})
