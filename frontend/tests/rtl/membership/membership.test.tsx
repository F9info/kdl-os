import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import PlansPage from '@/app/admin/membership/plans/page'
import MembersPage from '@/app/admin/membership/members/page'
import { ProviderForm } from '@/app/admin/membership/_components/ProviderForm'
import type { Provider } from '@/admin/hooks/useMembership'

const h = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, request: h.request } }))

const list = (items: unknown[]) => ({
  data: { data: { items, total: items.length, page: 1, limit: 20 } },
})

const plan = {
  id: 'p1',
  slug: 'gold',
  name: 'Gold',
  description: 'Everything',
  tier: 2,
  is_free: false,
  approval_mode: 'MANUAL',
  visibility: 'PUBLIC',
  member_types: ['INDIVIDUAL'],
  prices: [
    {
      id: 'x',
      interval: 'YEARLY',
      amount: 499900,
      gst_rate: 18,
      tax_mode: 'EXCLUSIVE',
      is_active: true,
    },
  ],
  member_count: 512,
}

beforeEach(() => {
  vi.clearAllMocks()
  h.get.mockImplementation((url: string) => {
    if (url.endsWith('/plans')) return Promise.resolve(list([plan]))
    if (url.endsWith('/members')) return Promise.resolve(list([]))
    return Promise.resolve(list([]))
  })
})

describe('Membership admin', () => {
  it('lists plans with GST-exclusive pricing and member count', async () => {
    render(<PlansPage />)
    expect(await screen.findByText('Gold')).toBeInTheDocument()
    expect(screen.getByText(/4,999\.00 \/ Yearly/)).toBeInTheDocument()
    expect(screen.getByText('512')).toBeInTheDocument()
  })

  it('members list sends the chosen filters to the API', async () => {
    render(<MembersPage />)
    await screen.findByText(/No members match/i)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PAST_DUE' } })
    fireEvent.change(screen.getByLabelText('Member type'), { target: { value: 'ORGANISATION' } })
    await waitFor(() => {
      const call = h.get.mock.calls.find(
        ([u, c]) => u.endsWith('/members') && c?.params?.member_type === 'ORGANISATION'
      )
      expect(call?.[1].params).toMatchObject({ status: 'PAST_DUE', member_type: 'ORGANISATION' })
    })
  })

  it('provider form never renders stored secrets and shows the saved state', () => {
    const provider = {
      id: 'g1',
      provider: 'RAZORPAY',
      type: 'GATEWAY',
      label: 'Razorpay',
      description: null,
      status: 'PUBLISHED',
      sort: 0,
      is_default: false,
      mode: 'LIVE',
      currency: 'INR',
      has_credentials: true,
      has_webhook_secret: true,
      options: {},
      member_types: [],
      regions: 'INDIA',
      min_amount: null,
      max_amount: null,
      manual_config: {},
      // A misbehaving API must still not leak into the DOM.
      credentials_enc: 'SECRET-BLOB',
    } as unknown as Provider
    const { container } = render(
      <ProviderForm kind="RAZORPAY" provider={provider} onClose={() => {}} />
    )
    expect(document.body.textContent).not.toContain('SECRET-BLOB')
    const secret = screen.getByLabelText(/key secret/i) as HTMLInputElement
    expect(secret.type).toBe('password')
    expect(secret.value).toBe('')
    expect(screen.getAllByText(/Saved\. Leave blank to keep it/).length).toBeGreaterThan(0)
    expect(container).toBeTruthy()
  })
})
