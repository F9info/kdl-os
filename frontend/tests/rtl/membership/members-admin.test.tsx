import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import MembersPage from '@/app/admin/membership/members/page'
import { ExtendModal } from '@/app/admin/membership/_components/MemberActionModals'
import { ImportWizard, parseCsv } from '@/app/admin/membership/_components/ImportWizard'
import type { Member } from '@/admin/hooks/useMembership'

const h = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
const member = {
  id: 'm1',
  full_name: 'Suresh Varma',
  email: 's@example.com',
  member_type: 'INDIVIDUAL',
  member_no: 'KDL-1',
  member_since: '2026-11-07',
  tags: [],
  subscription: {
    id: 's1',
    status: 'ACTIVE',
    plan_id: 'p1',
    starts_at: '2026-11-07',
    ends_at: '2027-11-06',
    plan: { id: 'p1', name: 'Gold', slug: 'gold' },
    price: { interval: 'YEARLY', amount: 100 },
  },
} as unknown as Member

beforeEach(() => {
  vi.clearAllMocks()
  h.get.mockResolvedValue(list([member]))
  h.request.mockResolvedValue({ data: { data: {} } })
})

describe('Admin members', () => {
  it('shows Member since / Valid till columns and sends date presets to the API', async () => {
    render(<MembersPage />)
    expect(await screen.findByText('Suresh Varma')).toBeInTheDocument()
    expect(screen.getByText('Valid till')).toBeInTheDocument()
    expect(screen.getByText('06 Nov 2027')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Member since'), { target: { value: 'this_year' } })
    await waitFor(() =>
      expect(
        h.get.mock.calls.some(
          ([u, c]) => u.endsWith('/members') && c?.params?.member_since_from?.endsWith('-01-01')
        )
      ).toBe(true)
    )
  })

  it('bulk tag sends tags[] (not a bare tag string)', async () => {
    render(<MembersPage />)
    fireEvent.click(await screen.findByLabelText('Select Suresh Varma'))
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'vip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(h.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/membership/admin/members/bulk',
          data: { ids: ['m1'], action: 'tag', tags: ['vip'] },
        })
      )
    )
  })

  it('extend posts the new end date as `until`', async () => {
    render(<ExtendModal member={member} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Extend' }))
    await waitFor(() => {
      const call = h.request.mock.calls[0]?.[0]
      expect(call.url).toBe('/membership/admin/members/m1/extend')
      expect(call.data.until).toBe('2028-02-06')
    })
  })

  it('import maps CSV column -> member field (backend direction)', async () => {
    expect(parseCsv('name,email\r\nA,a@x.in\r\n')).toEqual([
      ['name', 'email'],
      ['A', 'a@x.in'],
    ])
    h.request.mockResolvedValue({ data: { data: { total: 1, valid: 1, invalid: 0, rows: [] } } })
    render(<ImportWizard />)
    const file = new File(['name,email,phone\nA,a@x.in,9000045678\n'], 'm.csv', {
      type: 'text/csv',
    })
    fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await waitFor(() => {
      const call = h.request.mock.calls.find(([c]) => c.url.endsWith('/import/preview'))?.[0]
      expect(call.data.mapping).toMatchObject({
        name: 'full_name',
        email: 'email',
        phone: 'mobile',
      })
    })
  })
})
