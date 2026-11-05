import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { FrontendOnboardingDialog } from '@/components/onboarding/FrontendOnboardingDialog'
import { mockPathname } from '../../__mocks__/next-navigation'

const { get, post, toast } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get, post } }))
vi.mock('@/hooks/use-toast', () => ({ toast, useToast: () => ({ toasts: [] }) }))

const state = (answered: boolean) => get.mockResolvedValue({ data: { data: { answered } } })

beforeEach(() => {
  vi.clearAllMocks()
  mockPathname.value = '/admin/dashboard'
  sessionStorage.clear()
})

describe('FrontendOnboardingDialog', () => {
  it('stays closed once the question was answered', async () => {
    state(true)
    render(<FrontendOnboardingDialog />)
    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(screen.queryByText('Do you need a front-end website?')).toBeNull()
  })

  it('asks while unanswered, and "Yes" creates the site then offers links', async () => {
    state(false)
    post.mockResolvedValue({
      data: {
        data: {
          choice: 'yes',
          created: ['home', 'about', 'services', 'contact', 'faq'],
          skipped: [],
        },
      },
    })
    render(<FrontendOnboardingDialog />)
    fireEvent.click(await screen.findByText('Yes, create my website'))
    await screen.findByText('Your website is ready')
    expect(post).toHaveBeenCalledWith('/projects/onboarding', { frontend: 'yes' })
    expect(screen.getByText('View website')).toBeTruthy()
  })

  it('"No" saves the choice and creates nothing', async () => {
    state(false)
    post.mockResolvedValue({ data: { data: { choice: 'no', created: [], skipped: [] } } })
    render(<FrontendOnboardingDialog />)
    fireEvent.click(await screen.findByText('No, backend only'))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/projects/onboarding', { frontend: 'no' })
    )
    expect(screen.queryByText('Your website is ready')).toBeNull()
  })

  it('"Ask me later" closes it for this session without saving', async () => {
    state(false)
    render(<FrontendOnboardingDialog />)
    fireEvent.click(await screen.findByText('Ask me later'))
    await waitFor(() => expect(screen.queryByText('Do you need a front-end website?')).toBeNull())
    expect(post).not.toHaveBeenCalled()
  })

  it('tells the user when saving fails', async () => {
    state(false)
    post.mockRejectedValue(new Error('x'))
    render(<FrontendOnboardingDialog />)
    fireEvent.click(await screen.findByText('Yes, create my website'))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not save' }))
    )
  })

  it('stays out of the way on full-screen editor pages', async () => {
    state(false)
    mockPathname.value = '/admin/template-engine/edit/abc'
    render(<FrontendOnboardingDialog />)
    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(screen.queryByText('Do you need a front-end website?')).toBeNull()
  })
})
