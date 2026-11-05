import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import FormsPage from '@/app/admin/forms/page'
import { withKeys } from '@/app/admin/forms/_schemas'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), can: vi.fn() }))
vi.mock('@/lib/axios', () => ({
  default: { get: h.get, post: h.post, patch: h.patch, delete: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: h.can }) }))
vi.mock('@/components/shared/ModuleGuard', () => ({ ModuleGuard: ({ children }: any) => children }))
vi.mock('@/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))

const existing = {
  id: 'f1',
  name: 'Contact',
  slug: 'contact',
  submit_label: 'Send',
  success_message: 'Thanks',
  notify_email: null,
  is_active: true,
  fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
  _count: { submissions: 3 },
}

beforeEach(() => {
  vi.clearAllMocks()
  h.can.mockReturnValue(true)
  h.get.mockImplementation(async (url: string) => ({
    data: {
      data: url.includes('submissions')
        ? { items: [{ id: 's1', data: { name: 'Ann' }, created_at: '2026-11-05T10:00:00Z' }] }
        : { items: [existing] },
    },
  }))
  h.post.mockResolvedValue({ data: { data: {} } })
  h.patch.mockResolvedValue({ data: { data: {} } })
})

describe('Forms admin page (T5.4)', () => {
  it('lists forms with a submission count and opens the submissions', async () => {
    render(<FormsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /submissions \(3\)/i }))
    expect(await screen.findByText('Ann')).toBeTruthy()
  })

  it('creates a form: slug follows the name, keys are kept, empty email omitted from errors', async () => {
    render(<FormsPage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /new form/i }))[0]!)
    fireEvent.change(await screen.findByLabelText(/^name/i), { target: { value: 'Spring Leads' } })
    expect((screen.getByLabelText(/^slug/i) as HTMLInputElement).value).toBe('spring-leads')
    fireEvent.click(screen.getByRole('button', { name: /create form/i }))
    await waitFor(() => expect(h.post).toHaveBeenCalled())
    const [url, body] = h.post.mock.calls[0]!
    expect(url).toBe('/forms')
    expect(body).toMatchObject({ name: 'Spring Leads', slug: 'spring-leads', notify_email: '' })
    expect(body.fields.map((f: any) => f.key)).toEqual(['name', 'email', 'message'])
  })

  it('editing keeps the slug fixed and does not send it', async () => {
    render(<FormsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /^edit/i }))
    const slug = (await screen.findByLabelText(/^slug/i)) as HTMLInputElement
    expect(slug.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(h.patch).toHaveBeenCalled())
    expect(h.patch.mock.calls[0]![0]).toBe('/forms/f1')
    expect(h.patch.mock.calls[0]![1].slug).toBeUndefined()
  })

  it('hides New / Edit / Delete without permissions', async () => {
    h.can.mockReturnValue(false)
    render(<FormsPage />)
    await screen.findByText('Contact')
    expect(screen.queryByRole('button', { name: /new form/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete contact/i })).toBeNull()
  })
})

describe('withKeys', () => {
  it('keeps existing keys and derives unique new ones from the label', () => {
    const f = (key: string, label: string) => ({
      key,
      label,
      type: 'text' as const,
      required: false,
    })
    expect(
      withKeys([
        f('name', 'Full name'),
        f('', 'Name'),
        f('', 'Name'),
        f('', '123 Go'),
        f('', '!!!'),
      ]).map((x) => x.key)
    ).toEqual(['name', 'name_2', 'name_3', 'f_123_go', 'field'])
  })
})
