import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'

vi.mock('@/lib/axios', () => ({
  default: { post: vi.fn() },
}))

import api from '@/lib/axios'
import { mockPush } from '../../__mocks__/next-navigation'

describe('LoginPage regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('validates required fields on submit', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('submits credentials, stores auth, and redirects to dashboard', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          user: { id: '1', email: 'admin@kdl.com', name: 'Admin', role: 'admin' },
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      },
    } as any)

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('admin@kdl.com'), 'admin@kdl.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'test-fixture-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@kdl.com',
        password: 'test-fixture-password',
      })
    })
    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('renders server error feedback on failed login', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    } as any)

    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('admin@kdl.com'), 'bad@kdl.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})
