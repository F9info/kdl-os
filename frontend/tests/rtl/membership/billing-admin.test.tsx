import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import ApprovalsPage from '@/app/admin/membership/approvals/page'
import PaymentsPage from '@/app/admin/membership/payments/page'
import PaymentMethodsPage from '@/app/admin/membership/payment-methods/page'
import { VoidModal } from '@/app/admin/membership/_components/BillingModals'
import {
  groupRules,
  planUpdates,
  whoCan,
} from '@/app/admin/membership/_components/AccessRulesParts'
import { GeneralTab } from '@/app/admin/membership/_components/SettingsGeneral'
import type { Invoice, Plan } from '@/admin/hooks/useMembership'

const h = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
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
const ok = { data: { data: {} } }

const application = {
  id: 'sub1',
  created_at: new Date().toISOString(),
  member: { id: 'm1', full_name: 'Arjun Rao', email: 'arjun@example.com', city: 'Vijayawada' },
  plan: { name: 'Gold' },
  price: { interval: 'YEARLY', amount: 499900 },
  payments: [
    {
      id: 'p1',
      reference: 'KDL-PAY-1',
      status: 'PAID',
      amount: 589882,
      provider: { label: 'UPI' },
    },
  ],
}
const payment = (over = {}) => ({
  id: 'pay1',
  reference: 'KDL-PAY-2',
  status: 'UNDER_VERIFICATION',
  amount: 589882,
  tax_amount: 89982,
  refunded_amount: 0,
  created_at: new Date().toISOString(),
  utr: 'SBIN226311458',
  member: { id: 'm1', full_name: 'Lakshmi Prasad', email: 'l@example.com' },
  provider: { id: 'g1', label: 'Bank transfer', provider: 'BANK_TRANSFER' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  h.request.mockResolvedValue(ok)
})

describe('Admin approvals', () => {
  beforeEach(() => h.get.mockResolvedValue(list([application])))

  it('lists the applicant with plan, paid amount and waiting time', async () => {
    render(<ApprovalsPage />)
    expect(await screen.findByText('Arjun Rao')).toBeInTheDocument()
    expect(screen.getByText('Gold · Yearly')).toBeInTheDocument()
    expect(screen.getByText(/Paid ₹5,898\.82/)).toBeInTheDocument()
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('approves through the confirm modal', async () => {
    render(<ApprovalsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Arjun Rao' }))
    expect(await screen.findByText('Approve membership?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve & activate' }))
    await waitFor(() =>
      expect(h.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: expect.stringContaining('approvals/sub1/approve'),
        })
      )
    )
  })

  it('rejects with a reason and a full refund for a paid application', async () => {
    render(<ApprovalsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject Arjun Rao' }))
    expect(await screen.findByText(/Full refund ₹5,898\.82/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reject & refund' }))
    await waitFor(() => {
      const call = h.request.mock.calls.find(([c]) => c.url.includes('approvals/sub1/reject'))
      expect(call?.[0].data).toMatchObject({ reason: 'Incomplete details', refund: true })
    })
  })

  it('bulk approve needs a selection and calls each application', async () => {
    render(<ApprovalsPage />)
    await screen.findByText('Arjun Rao')
    expect(screen.getByRole('button', { name: /Approve selected/ })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Select Arjun Rao'))
    fireEvent.click(screen.getByRole('button', { name: /Approve selected/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Approve all' }))
    await waitFor(() =>
      expect(h.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('approvals/sub1/approve') })
      )
    )
  })
})

describe('Admin payments', () => {
  it('shows KPIs, the waiting chip and verifies a bank transfer', async () => {
    h.get.mockResolvedValue(list([payment()]))
    render(<PaymentsPage />)
    expect(await screen.findByText('Lakshmi Prasad')).toBeInTheDocument()
    expect(screen.getByText(/Waiting for verification · 1/)).toBeInTheDocument()
    expect(screen.getByText('Failed (Nov)', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByText(/Verify bank transfer/)).toBeInTheDocument()
    expect(screen.getByText('SBIN226311458')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }))
    await waitFor(() =>
      expect(h.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('payments/pay1/verify') })
      )
    )
  })

  it('never renders a javascript: proof url as a link target', async () => {
    h.get.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/payments/pay1')
          ? { data: { data: payment({ status: 'PAID', proof_url: 'javascript:alert(1)' }) } }
          : list([payment({ status: 'PAID' })])
      )
    )
    render(<PaymentsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'View' }))
    const link = await screen.findByText('Open payment proof')
    expect(link.closest('a')?.getAttribute('href')).toBe('#')
  })

  it('refunds a captured payment partially, rejecting amounts above what is left', async () => {
    h.get.mockResolvedValue(list([payment({ status: 'PAID' })]))
    render(<PaymentsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Partial' }))
    const amount = screen.getByLabelText(/Refund amount/)
    fireEvent.change(amount, { target: { value: '999999' } })
    expect(screen.getByText(/Enter an amount up to/)).toBeInTheDocument()
    fireEvent.change(amount, { target: { value: '2949.41' } })
    fireEvent.click(screen.getByRole('button', { name: /Refund ₹2,949\.41/ }))
    await waitFor(() => {
      const call = h.request.mock.calls.find(([c]) => c.url.includes('payments/pay1/refund'))
      expect(call?.[0].data).toMatchObject({ amount: 294941 })
    })
  })
})

describe('Invoice void modal', () => {
  it('issues a credit note with the chosen reason', async () => {
    const inv = { id: 'i1', number: 'MEM/2026-27/00413', total: 589882 } as Invoice
    render(<VoidModal invoice={inv} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Issue credit note' }))
    await waitFor(() => {
      const call = h.request.mock.calls.find(([c]) => c.url.includes('invoices/i1/void'))
      expect(call?.[0].data).toMatchObject({ reason: 'Refund on rejection' })
    })
  })
})

describe('Payment methods', () => {
  const provider = (o: object) => ({
    id: 'g1',
    provider: 'STRIPE',
    type: 'GATEWAY',
    label: 'Stripe',
    description: 'International card',
    status: 'DRAFT',
    sort: 0,
    is_default: false,
    mode: 'TEST',
    currency: 'USD',
    options: {},
    member_types: [],
    regions: 'OUTSIDE_INDIA',
    manual_config: {},
    plan_ids: [],
    ...o,
  })
  it('filters by status chip and offers Delete only for a never-used draft', async () => {
    h.get.mockResolvedValue(
      list([
        provider({}),
        provider({ id: 'g2', label: 'Razorpay', provider: 'RAZORPAY', status: 'PUBLISHED' }),
      ])
    )
    render(<PaymentMethodsPage />)
    expect(await screen.findAllByText('Razorpay')).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Published · 1/ }))
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  })

  it('deletes after confirming', async () => {
    h.get.mockResolvedValue(list([provider({})]))
    render(<PaymentMethodsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/can be deleted permanently/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete provider' }))
    await waitFor(() =>
      expect(h.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'delete',
          url: expect.stringContaining('payment-providers/g1'),
        })
      )
    )
  })
})

describe('Access rules grouping', () => {
  const plan = (id: string, tier: number, rules: object[] = [], extra: object = {}) =>
    ({ id, name: id, tier, access_rules: rules, ...extra }) as unknown as Plan
  const rule = { target: 'PAGE', value: '/p/report', label: 'Report', non_member_view: 'BLUR' }

  it('merges per-plan rows into one rule and describes who can access', () => {
    const plans = [plan('Free', 1), plan('Silver', 2, [rule]), plan('Gold', 3, [rule])]
    const [r] = groupRules(plans)
    expect(r!.plans.map((p) => p.id)).toEqual(['Silver', 'Gold'])
    expect(whoCan(r!, plans)).toBe('Tier ≥ 2 (Silver, Gold)')
    const all = [plan('A', 1, [rule]), plan('B', 2, [rule])]
    expect(whoCan(groupRules(all)[0]!, all)).toBe('Any active member')
  })

  it('only rewrites the plans whose rules change', () => {
    const plans = [plan('Free', 1), plan('Silver', 2, [rule]), plan('Gold', 3)]
    const next = { ...rule, target: 'PAGE' as const }
    const out = planUpdates(plans, rule as never, next as never, new Set(['Silver', 'Gold']))
    expect(out.map((u) => u.planId).sort()).toEqual(['Gold', 'Silver'])
    expect(planUpdates(plans, rule as never, null, new Set()).map((u) => u.planId)).toEqual([
      'Silver',
    ])
  })
})

describe('General settings', () => {
  it('saves billing fields into the policies bag and keeps keys it does not edit', async () => {
    h.get.mockResolvedValue({
      data: {
        data: {
          general: {
            member_no_prefix: 'KDL-M',
            invoice_prefix: 'MEM',
            gst_rate_default: 18,
            grace_days: 7,
            renewal_rules: { auto_renew_default: true, reminder_days: [30, 7] },
            policies: { privacy_url: '/p/privacy' },
          },
          signup: {},
        },
      },
    })
    render(<GeneralTab />)
    const gstin = await screen.findByLabelText('GSTIN')
    fireEvent.change(gstin, { target: { value: 'bad' } })
    fireEvent.submit(gstin.closest('form')!)
    expect(await screen.findByText('Invalid GSTIN')).toBeInTheDocument()
    expect(h.request).not.toHaveBeenCalled()
    fireEvent.change(gstin, { target: { value: '37AAKCK1234M1Z9' } })
    fireEvent.submit(gstin.closest('form')!)
    await waitFor(() => expect(h.request).toHaveBeenCalled())
    const { data } = h.request.mock.calls[0]![0]
    expect(data.general.policies).toMatchObject({
      gstin: '37AAKCK1234M1Z9',
      privacy_url: '/p/privacy',
    })
    expect(data.general.renewal_rules).toMatchObject({
      reminder_days: [30, 7],
      after_grace: 'EXPIRE_LOCK',
    })
  })
})
