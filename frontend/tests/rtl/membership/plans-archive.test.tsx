import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { PlanArchiveModal } from '@/app/admin/membership/_components/PlanArchiveModal'
import type { Plan } from '@/admin/hooks/useMembership'

const h = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { request: h.request, get: vi.fn() } }))

const plan = { id: 'p9', name: 'Lifetime Patron', member_count: 18 } as Plan

describe('PlanArchiveModal', () => {
  it('only archives after the plan name is typed, and can notify members', async () => {
    h.request.mockResolvedValue({ data: { data: {} } })
    render(<PlanArchiveModal plan={plan} onClose={vi.fn()} />)
    const go = screen.getByRole('button', { name: 'Archive plan' })
    expect(go).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('Lifetime Patron'), {
      target: { value: 'Lifetime Patron' },
    })
    fireEvent.click(screen.getByLabelText('Notify existing members'))
    fireEvent.click(go)
    await waitFor(() =>
      expect(h.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('plans/p9/archive'),
          data: { notify_members: true },
        })
      )
    )
  })
})
