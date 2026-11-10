import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'

const get = vi.fn()
vi.mock('@/lib/axios', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), put: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}))
vi.mock('@/frontend/membership/useMemberSession', () => ({
  useMemberSession: () => ({ ready: true }),
}))

import { Pricing } from '@/frontend/membership/Pricing'
import { JoinFlow } from '@/frontend/membership/JoinFlow'
import { Checkout } from '@/frontend/membership/Checkout'

const plans = [
  {
    id: 'p1',
    slug: 'free',
    name: 'Free',
    is_free: true,
    approval_mode: 'AUTO',
    prices: [],
    benefits: [{ text: 'Newsletter' }],
  },
  {
    id: 'p2',
    slug: 'gold',
    name: 'Gold',
    is_free: false,
    approval_mode: 'MANUAL',
    is_featured: true,
    prices: [
      {
        id: 'x',
        interval: 'YEARLY',
        amount: 499900,
        currency: 'INR',
        gst_rate: 18,
        tax_mode: 'EXCLUSIVE',
      },
    ],
    benefits: [{ text: 'Priority support' }],
  },
]

// Unmatched URLs (theme tokens, app-config) get an empty payload.
const respond = (map: Record<string, unknown>) =>
  get.mockImplementation((url: string) => {
    const k = Object.keys(map).find((m) => String(url).includes(m))
    return Promise.resolve({ data: { data: k ? map[k] : {} } })
  })

beforeEach(() => get.mockReset())

describe('membership public screens', () => {
  it('pricing renders plans from the API', async () => {
    respond({ '/membership/plans': plans })
    render(<Pricing />)
    expect(await screen.findByText('Gold')).toBeInTheDocument()
    expect(screen.getByText('Priority support')).toBeInTheDocument()
    expect(screen.getByText('Most popular')).toBeInTheDocument()
    expect(screen.getByText(/4,999\.00/)).toBeInTheDocument()
  })

  it('join form shows the plan packs after choosing a member type', async () => {
    respond({
      '/membership/plans': plans,
      '/membership/join-form': {
        groups: [
          {
            key: 'prof',
            name: 'Professional details',
            fields: [{ key: 'profession', label: 'Profession', type: 'TEXT', required: true }],
          },
        ],
      },
    })
    render(<JoinFlow planSlug="gold" interval="YEARLY" />)
    ;(await screen.findByText('Individual')).click()
    expect(await screen.findByLabelText(/Mobile number/)).toBeInTheDocument()
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    for (const [label, v] of [
      [/Mobile number/, '9848012345'],
      [/Full name/, 'Suresh V'],
      [/^Email/, 's@x.com'],
      [/^Password/, 'a-long-password-1'],
    ] as const) {
      const el = screen.getByLabelText(label) as HTMLInputElement
      set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    ;(await screen.findByRole('button', { name: 'Continue' })).click()
    expect(await screen.findByText('Professional details')).toBeInTheDocument()
    expect(screen.getByLabelText(/Profession/)).toBeInTheDocument()
  })

  it('checkout lists only returned providers and never shows secrets', async () => {
    respond({
      '/membership/plans': plans,
      '/membership/me': { member: { full_name: 'S', email: 's@x.com' }, contacts: [], fields: {} },
      '/checkout/providers': [
        {
          id: 'r1',
          provider: 'RAZORPAY',
          type: 'GATEWAY',
          label: 'Razorpay',
          description: 'UPI, cards',
          credentials_enc: 'TOP-SECRET',
          key_secret: 'TOP-SECRET',
        },
      ],
    })
    render(<Checkout planSlug="gold" interval="YEARLY" />)
    expect(await screen.findByText('Razorpay')).toBeInTheDocument()
    expect(screen.queryByText('Bank transfer')).not.toBeInTheDocument()
    await waitFor(() => expect(document.body.textContent).not.toContain('TOP-SECRET'))
  })
})
