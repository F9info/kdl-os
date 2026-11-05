import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import CompanyDetailsPage from '@/app/admin/website-details/page'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  advance: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/axios', () => ({ default: { get: h.get, post: h.post, put: h.put } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/hooks/useDefaultProjectId', () => ({
  useDefaultProjectId: () => ({ projectId: 'proj-1', isLoading: false }),
}))
vi.mock('@/components/shared/ModuleGuard', () => ({ ModuleGuard: ({ children }: any) => children }))
vi.mock('@/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: h.advance }),
  useUploadLogo: () => ({ mutate: h.upload, isPending: false }),
  // WEBSITE stage DONE: a re-sync would call advance.mutate
  useTemplateEngineRuns: () => ({
    data: [{ id: 'run-1', stages: [{ stage: 'WEBSITE', status: 'DONE' }] }],
  }),
  useBrandKit: () => ({ data: { logo_media_id: 'm1' }, isLoading: false }),
  useContinueToPalette: () => ({ mutate: vi.fn(), isPending: false }),
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
  h.get.mockImplementation(async (url: string) => {
    if (url.includes('by-type/brand-profile'))
      return {
        data: {
          data: {
            type: { id: 't1', slug: 'brand-profile' },
            fields: [
              field('brand-profile-company-name', 'Company name', 'Acme'),
              field('brand-profile-primary-phone', 'Primary phone', '111'),
            ],
          },
        },
      }
    if (url === '/setting-fields/value/logo')
      return { data: { data: { field: { value: 'media/logo.png' } } } }
    return { data: { data: { media: { url: null } } } }
  })
  h.post.mockResolvedValue({ data: { data: {} } })
  h.put.mockResolvedValue({ data: { data: {} } })
})

const edit = async (current: string, next: string) => {
  fireEvent.change(await screen.findByDisplayValue(current), { target: { value: next } })
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }))
}

describe('Company Details writes through to Identity (T3.3)', () => {
  it('a name change updates Identity and does not re-sync the website', async () => {
    render(<CompanyDetailsPage />)
    await edit('Acme', 'Zeta')
    await waitFor(() => expect(h.put).toHaveBeenCalledWith('/identity', { app_name: 'Zeta' }))
    expect(h.advance).not.toHaveBeenCalled()
  })

  it('a contact change updates Identity and still re-syncs the website (contacts are baked)', async () => {
    render(<CompanyDetailsPage />)
    await edit('111', '222')
    await waitFor(() => expect(h.put).toHaveBeenCalledWith('/identity', { contact_phone: '222' }))
    await waitFor(() => expect(h.advance).toHaveBeenCalledTimes(1))
  })

  it('falls back to the website re-sync when Identity cannot be written', async () => {
    h.put.mockRejectedValue(new Error('403'))
    render(<CompanyDetailsPage />)
    await edit('Acme', 'Zeta')
    await waitFor(() => expect(h.advance).toHaveBeenCalledTimes(1))
  })

  it('saving with no changes touches neither Identity nor the website', async () => {
    render(<CompanyDetailsPage />)
    await screen.findByDisplayValue('Acme') // wait for the saved values to load
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(h.post).toHaveBeenCalled())
    expect(h.put).not.toHaveBeenCalled()
    expect(h.advance).not.toHaveBeenCalled()
  })

  it('a new logo is copied to Identity as the light logo', async () => {
    h.upload.mockImplementation((_f: File, opts: { onSuccess: () => void }) => opts.onSuccess())
    const { container } = render(<CompanyDetailsPage />)
    await screen.findByDisplayValue('Acme')
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'l.png', { type: 'image/png' })] },
    })
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/identity', { logo_light: 'media/logo.png' })
    )
    expect(h.advance).not.toHaveBeenCalled()
  })
})
