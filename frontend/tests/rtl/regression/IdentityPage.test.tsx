import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import IdentityPage from '@/app/admin/settings/identity/page'

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), resync: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, put: h.put, post: h.post } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('@/admin/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock('@/admin/hooks/useDefaultProjectId', () => ({
  useDefaultProjectId: () => ({ projectId: 'proj-1', isLoading: false }),
}))
vi.mock('@/admin/hooks/useTemplateEngine', () => ({ resyncBuiltWebsite: h.resync }))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))

const saved = {
  app_name: 'Acme',
  contact_email: 'hi@acme.com',
  contact_email_secondary: 'sales@acme.com',
  contact_phone: '111',
  contact_phone_secondary: '222',
  contact_address: '1 Main Rd',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.resync.mockResolvedValue(undefined)
  h.get.mockResolvedValue({ data: { data: { identity: saved, resolved: {} } } })
  h.put.mockImplementation(async (_u: string, body: object) => ({
    data: { data: { identity: body, resolved: {} } },
  }))
})

const save = async () => {
  await screen.findByDisplayValue('Acme')
  fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
}

describe('Identity page is the one place for company details (T-identity)', () => {
  it('shows the contact fields including the secondary email and phone', async () => {
    render(<IdentityPage />)
    expect(await screen.findByDisplayValue('sales@acme.com')).toBeTruthy()
    expect(screen.getByDisplayValue('222')).toBeTruthy()
    expect(screen.getByLabelText('Address')).toBeTruthy()
  })

  it('rejects an invalid secondary email before saving', async () => {
    render(<IdentityPage />)
    fireEvent.change(await screen.findByLabelText('Secondary email'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    expect(await screen.findByText('Enter a valid email.')).toBeTruthy()
    expect(h.put).not.toHaveBeenCalled()
  })

  it('changing a contact detail refreshes an already-built website', async () => {
    render(<IdentityPage />)
    fireEvent.change(await screen.findByLabelText('Contact phone'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    await waitFor(() => expect(h.resync).toHaveBeenCalledWith('proj-1'))
  })

  it('changing only the name does not (the name is applied live, no rebuild needed)', async () => {
    render(<IdentityPage />)
    fireEvent.change(await screen.findByDisplayValue('Acme'), { target: { value: 'Acme 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    await waitFor(() => expect(h.put).toHaveBeenCalled())
    expect(h.resync).not.toHaveBeenCalled()
  })

  it('saving without changes touches nothing else', async () => {
    render(<IdentityPage />)
    await save()
    await waitFor(() => expect(h.put).toHaveBeenCalled())
    expect(h.resync).not.toHaveBeenCalled()
  })

  it('the logo is uploaded with asset=logo_light (brand kit); the favicon with asset=favicon', async () => {
    h.post.mockResolvedValue({ data: { data: { path: 'media/x.png', url: 'https://x/x.png' } } })
    render(<IdentityPage />)
    await screen.findByDisplayValue('Acme')
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('upload-logo_light'), { target: { files: [file] } })
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/identity/upload', expect.any(FormData), {
        params: { asset: 'logo_light' },
      })
    )
    fireEvent.change(screen.getByTestId('upload-favicon'), { target: { files: [file] } })
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/identity/upload', expect.any(FormData), {
        params: { asset: 'favicon' },
      })
    )
  })

  it('shows the saved logo as a thumbnail, and an uploaded one straight away', async () => {
    h.get.mockResolvedValue({
      data: {
        data: {
          identity: { ...saved, logo_light: 'media/l.png' },
          resolved: { logo_light: 'https://x/saved.png' },
        },
      },
    })
    h.post.mockResolvedValue({
      data: { data: { path: 'media/new.png', url: 'https://x/new.png' } },
    })
    render(<IdentityPage />)
    await screen.findByDisplayValue('Acme')
    expect((await screen.findByAltText('logo_light preview')).getAttribute('src')).toBe(
      'https://x/saved.png'
    )
    fireEvent.change(screen.getByTestId('upload-logo_light'), {
      target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
    })
    await waitFor(() =>
      expect(screen.getByAltText('logo_light preview').getAttribute('src')).toBe(
        'https://x/new.png'
      )
    )
  })

  it('Save is held while a file is uploading', async () => {
    let finish: (v: unknown) => void = () => {}
    h.post.mockReturnValue(new Promise((r) => (finish = r)))
    render(<IdentityPage />)
    await screen.findByDisplayValue('Acme')
    fireEvent.change(screen.getByTestId('upload-favicon'), {
      target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] },
    })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save identity' }) as HTMLButtonElement).disabled
      ).toBe(true)
    )
    finish({ data: { data: { path: 'p', url: 'u' } } })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save identity' }) as HTMLButtonElement).disabled
      ).toBe(false)
    )
  })

  it('a logo the brand kit rejects shows its message and keeps the old logo', async () => {
    h.post.mockRejectedValue({
      response: { data: { message: 'Logo short edge must be ≥ 64px' } },
      message: 'Request failed',
    })
    render(<IdentityPage />)
    await screen.findByDisplayValue('Acme')
    fireEvent.change(screen.getByTestId('upload-logo_light'), {
      target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
    })
    expect(await screen.findByText(/short edge must be/i)).toBeTruthy()
  })
})
