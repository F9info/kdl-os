import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'

const sub = {
  id: 's',
  status: 'PAST_DUE',
  ends_at: '2027-11-06T00:00:00Z',
  grace_ends_at: '2027-11-13T00:00:00Z',
}
const route: Record<string, unknown> = {
  '/membership/me': {
    member: { id: 'm', full_name: 'Suresh', member_no: 'KDL-1', member_type: 'INDIVIDUAL' },
    subscription: sub,
    plan: { id: 'p', slug: 'gold', name: 'Gold', tier: 2, benefits: [] },
  },
}
vi.mock('@/lib/axios', () => ({
  default: {
    get: (url: string) =>
      route[url] !== undefined
        ? Promise.resolve({ data: { data: route[url] } })
        : Promise.reject(Object.assign(new Error('nf'), { response: { status: 404 } })),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/membership/account',
  useSearchParams: () => new URLSearchParams(),
}))

import { Dashboard } from '@/frontend/membership/Dashboard'
import { NotifPrefs } from '@/frontend/membership/NotifPrefs'

describe('account', () => {
  it('shows the past-due banner and renew action', async () => {
    render(<Dashboard />)
    expect(await screen.findByText('Your renewal payment is due')).toBeInTheDocument()
    expect(screen.getByText('Past due')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Renew now/ })).toBeInTheDocument()
  })

  it('handles a missing communication API (404) gracefully', async () => {
    render(<NotifPrefs />)
    expect(await screen.findByText(/not available yet/)).toBeInTheDocument()
  })
})
