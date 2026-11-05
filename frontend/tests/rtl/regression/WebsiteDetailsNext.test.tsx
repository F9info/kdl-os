import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import CompanyDetailsPage from '@/app/admin/website-details/page'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  hasLogo: { v: true },
  cont: vi.fn(),
  contPending: { v: false },
}))

vi.mock('@/lib/axios', () => ({ default: { get: h.get, post: h.post } }))
vi.mock('@/hooks/use-toast', () => ({ toast: h.toast, useToast: () => ({ toasts: [] }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/hooks/useDefaultProjectId', () => ({
  useDefaultProjectId: () => ({ projectId: 'proj-1', isLoading: false }),
}))
vi.mock('@/components/shared/ModuleGuard', () => ({ ModuleGuard: ({ children }: any) => children }))
vi.mock('@/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: vi.fn() }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useTemplateEngineRuns: () => ({ data: [{ id: 'run-1', stages: [] }] }),
  useBrandKit: () => ({
    data: { logo_media_id: h.hasLogo.v ? 'm1' : null },
    isLoading: false,
  }),
  useContinueToPalette: () => ({ mutate: h.cont, isPending: h.contPending.v }),
}))

const field = (slug: string, name: string, value = '') => ({
  id: slug,
  slug,
  field_name: name,
  input_type: 'text',
  value,
  alt_text: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  h.hasLogo.v = true
  h.contPending.v = false
  h.get.mockImplementation(async (url: string) => {
    if (url.includes('by-type/brand-profile'))
      return {
        data: {
          data: {
            type: { id: 't1', slug: 'brand-profile' },
            fields: [field('brand-profile-company-name', 'Company name', 'Acme')],
          },
        },
      }
    return { data: { data: { media: { url: null } } } }
  })
  h.post.mockResolvedValue({ data: { data: {} } })
})

const clickSave = async () => {
  await screen.findByDisplayValue('Acme') // wait until the saved company name has loaded
  const save = await screen.findByRole('button', { name: 'Save' })
  fireEvent.click(save)
}

describe('Company Details → Next → Color Palette', () => {
  it('shows no Next button until the details are saved', async () => {
    render(<CompanyDetailsPage />)
    await screen.findByRole('button', { name: 'Save' })
    expect(screen.queryByRole('button', { name: /Next/ })).toBeNull()
  })

  it('after Save shows Next, which continues to the Color Palette page', async () => {
    h.cont.mockImplementation((_run: unknown, opts: { onSuccess: () => void }) => opts.onSuccess())
    render(<CompanyDetailsPage />)
    await clickSave()
    const next = await screen.findByRole('button', { name: /Next/ })
    fireEvent.click(next)
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
    )
  })

  it('without a logo the Next button is disabled and says why', async () => {
    h.hasLogo.v = false
    render(<CompanyDetailsPage />)
    await clickSave()
    const next = await screen.findByRole('button', { name: /Next/ })
    expect((next as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Upload your logo/)).toBeTruthy()
  })

  it('editing again hides Next until the next Save', async () => {
    render(<CompanyDetailsPage />)
    await clickSave()
    await screen.findByRole('button', { name: /Next/ })
    fireEvent.change(screen.getByDisplayValue('Acme'), { target: { value: 'Acme 2' } })
    await waitFor(() => expect(screen.queryByRole('button', { name: /Next/ })).toBeNull())
  })
})
