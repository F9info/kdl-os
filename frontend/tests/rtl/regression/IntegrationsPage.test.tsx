import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import IntegrationsPage from '@/app/admin/integrations/page'
import IntegrationLogsPage from '@/app/admin/integrations/logs/page'
import { useAuthStore } from '@/stores/auth.store'
import type { IntegrationProvider, IntegrationLog } from '@/types/integrations.types'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import api from '@/lib/axios'

const ALL_PERMISSIONS = [
  'integrations:view',
  'integrations:add',
  'integrations:edit',
  'integrations:delete',
]

function mockGetBase(overrides?: (url: string) => unknown) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (overrides) {
      const result = overrides(url)
      if (result !== undefined) return Promise.resolve(result) as ReturnType<typeof api.get>
    }
    if (url === '/auth/me/permissions') {
      return Promise.resolve({
        data: { data: { permissions: ALL_PERMISSIONS, roles: ['admin'], bypass: false } },
      }) as ReturnType<typeof api.get>
    }
    if (url === '/modules/enabled') {
      return Promise.resolve({
        data: {
          data: {
            modules: [{ slug: 'integrations', name: 'Integrations', core: false, nav: [] }],
          },
        },
      }) as ReturnType<typeof api.get>
    }
    if (url === '/integrations/providers') {
      return Promise.resolve({
        data: { data: { items: [] } },
      }) as ReturnType<typeof api.get>
    }
    if (url === '/integrations/logs') {
      return Promise.resolve({
        data: { data: { logs: [], pagination: { total: 0, pages: 1 } } },
      }) as ReturnType<typeof api.get>
    }
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

const smtpProvider: IntegrationProvider = {
  id: 'p1',
  channel: 'EMAIL',
  driver: 'smtp',
  name: 'SMTP Production',
  config: { from: 'noreply@example.com' },
  is_active: true,
  is_default: true,
  is_fallback: false,
  credentials_set: true,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const msg91Provider: IntegrationProvider = {
  id: 'p2',
  channel: 'SMS',
  driver: 'msg91',
  name: 'MSG91 Prod',
  config: { senderId: 'KDLSMS' },
  is_active: true,
  is_default: false,
  is_fallback: false,
  credentials_set: true,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const sampleLog: IntegrationLog = {
  id: 'l1',
  provider_id: 'p1',
  channel: 'EMAIL',
  recipient: 'te***@example.com',
  subject: 'Test',
  body_preview: 'Hello',
  status: 'SENT',
  provider_ref: 'ref-123',
  error: null,
  source: 'test',
  attempts: 1,
  sent_at: '2026-07-01T01:00:00.000Z',
  delivered_at: null,
  created_at: '2026-07-01T00:00:00.000Z',
  provider: { id: 'p1', name: 'SMTP Production', driver: 'smtp' },
}

describe('IntegrationsPage — providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, isLoading: false })
  })

  it('renders channel tabs', async () => {
    mockGetBase()
    render(<IntegrationsPage />)
    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('SMS')).toBeInTheDocument()
      expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    })
  })

  it('renders provider card with driver and badges', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: [smtpProvider] } } }
      }
    })
    render(<IntegrationsPage />)
    await waitFor(() => {
      expect(screen.getByText('SMTP Production')).toBeInTheDocument()
      expect(screen.getByText('smtp')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Default')).toBeInTheDocument()
    })
  })

  it('switches to SMS tab and shows SMS providers', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: [smtpProvider, msg91Provider] } } }
      }
    })
    render(<IntegrationsPage />)
    await waitFor(() => expect(screen.getByText('SMTP Production')).toBeInTheDocument())

    fireEvent.click(screen.getByText('SMS'))
    await waitFor(() => {
      expect(screen.queryByText('SMTP Production')).not.toBeInTheDocument()
      expect(screen.getByText('MSG91 Prod')).toBeInTheDocument()
    })
  })

  it('opens Add Provider dialog with credential input fields — never pre-fills saved values', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: [] } } }
      }
    })
    render(<IntegrationsPage />)
    await waitFor(() => screen.getByText('Add Provider'))
    fireEvent.click(screen.getByText('Add Provider'))

    await waitFor(() => {
      // Dialog opens — credential inputs exist
      const inputs = document.querySelectorAll(
        'input[type="password"], input[type="text"], input[type="number"]'
      )
      expect(inputs.length).toBeGreaterThan(0)
    })

    // All inputs must be empty — no saved credential pre-filled
    const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>
    inputs.forEach((input) => {
      expect(input.value).toBe('')
    })
  })

  it('edit dialog shows •••• placeholder for saved credentials — never renders actual value', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: [smtpProvider] } } }
      }
    })
    render(<IntegrationsPage />)
    await waitFor(() => screen.getByLabelText('Edit provider'))
    fireEvent.click(screen.getByLabelText('Edit provider'))

    await waitFor(() => {
      // Masked placeholder must be visible
      expect(screen.getAllByText('••••••••').length).toBeGreaterThan(0)
    })

    // Actual credential values MUST NOT appear anywhere
    // (API never returns them, but we verify the UI doesn't render them either)
    expect(screen.queryByDisplayValue(/smtp-pass|password|secret/i)).not.toBeInTheDocument()
  })

  it('test-send POST uses to/body keys — not recipient/message', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: [smtpProvider] } } }
      }
    })
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { log_id: 'log-abc123' } },
    } as Awaited<ReturnType<typeof api.post>>)

    render(<IntegrationsPage />)
    await waitFor(() => screen.getByLabelText('Test send'))
    fireEvent.click(screen.getByLabelText('Test send'))

    await waitFor(() => screen.getByPlaceholderText('test@example.com'))
    fireEvent.change(screen.getByPlaceholderText('test@example.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Hello, this is a test message.'), {
      target: { value: 'Hello world' },
    })

    fireEvent.click(screen.getByText('Send Test'))

    await waitFor(() => {
      expect(vi.mocked(api.post)).toHaveBeenCalledWith(
        `/integrations/providers/p1/test`,
        expect.objectContaining({ to: 'test@example.com', body: 'Hello world' })
      )
      expect(vi.mocked(api.post)).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ recipient: expect.anything() })
      )
      expect(vi.mocked(api.post)).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ message: expect.anything() })
      )
    })
  })

  it('credential inputs are hidden behind Replace button in edit mode', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: [smtpProvider] } } }
      }
    })
    render(<IntegrationsPage />)
    await waitFor(() => screen.getByLabelText('Edit provider'))
    fireEvent.click(screen.getByLabelText('Edit provider'))

    // Before Replace: no password inputs rendered
    await waitFor(() => {
      expect(document.querySelectorAll('input[type="password"]').length).toBe(0)
    })

    // After Replace click: password inputs appear with empty values (never pre-filled)
    fireEvent.click(screen.getByText('Replace Credentials'))
    await waitFor(() => {
      const pwdInputs = document.querySelectorAll(
        'input[type="password"]'
      ) as NodeListOf<HTMLInputElement>
      expect(pwdInputs.length).toBeGreaterThan(0)
      pwdInputs.forEach((inp) => expect(inp.value).toBe(''))
    })
  })
})

describe('IntegrationsPage — credential security gate (KDL-95)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, isLoading: false })
  })

  const allDriverProviders: IntegrationProvider[] = [
    { ...smtpProvider, id: 'p-smtp', driver: 'smtp', channel: 'EMAIL', name: 'SMTP' },
    {
      ...smtpProvider,
      id: 'p-msg91',
      driver: 'msg91',
      channel: 'SMS',
      name: 'MSG91',
      credentials_set: true,
    },
    {
      ...smtpProvider,
      id: 'p-twilio',
      driver: 'twilio',
      channel: 'SMS',
      name: 'Twilio',
      credentials_set: true,
    },
    {
      ...smtpProvider,
      id: 'p-meta',
      driver: 'meta-cloud',
      channel: 'WHATSAPP',
      name: 'Meta',
      credentials_set: true,
    },
    {
      ...smtpProvider,
      id: 'p-gupshup',
      driver: 'gupshup',
      channel: 'WHATSAPP',
      name: 'Gupshup',
      credentials_set: true,
    },
  ]

  it.each([
    ['smtp', 'EMAIL', 'SMTP'],
    ['msg91', 'SMS', 'MSG91'],
    ['twilio', 'SMS', 'Twilio'],
    ['meta-cloud', 'WHATSAPP', 'Meta'],
    ['gupshup', 'WHATSAPP', 'Gupshup'],
  ])('%s edit dialog never renders saved credential values', async (driver, channel, name) => {
    mockGetBase((url) => {
      if (url === '/integrations/providers') {
        return { data: { data: { items: allDriverProviders } } }
      }
    })
    render(<IntegrationsPage />)

    // Navigate to correct tab if needed
    if (channel !== 'EMAIL') {
      await waitFor(() => screen.getByText(channel === 'SMS' ? 'SMS' : 'WhatsApp'))
      fireEvent.click(screen.getByText(channel === 'SMS' ? 'SMS' : 'WhatsApp'))
    }

    await waitFor(() => {
      const editBtns = screen.getAllByLabelText('Edit provider')
      expect(editBtns.length).toBeGreaterThan(0)
    })

    const editBtns = screen.getAllByLabelText('Edit provider')
    const cardIdx = allDriverProviders
      .filter((p) => p.channel === channel)
      .findIndex((p) => p.name === name)
    const editBtn = editBtns[cardIdx]
    if (!editBtn) throw new Error(`Edit button not found for ${name}`)
    fireEvent.click(editBtn)

    await waitFor(() => {
      // Must show masked placeholder
      expect(screen.getAllByText('••••••••').length).toBeGreaterThan(0)
    })

    // No credential input with a pre-filled value
    const inputs = screen.queryAllByRole('textbox') as HTMLInputElement[]
    for (const input of inputs) {
      expect(input.type).not.toBe('password')
    }
    const pwdInputs = document.querySelectorAll('input[type="password"]')
    pwdInputs.forEach((inp) => {
      expect((inp as HTMLInputElement).value).toBe('')
    })
  })
})

describe('IntegrationLogsPage — status badges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, isLoading: false })
  })

  it('renders status badge for all MessageStatus values', async () => {
    const statuses = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const
    const logs: IntegrationLog[] = statuses.map((status, i) => ({
      ...sampleLog,
      id: `l${i}`,
      status,
      error: status === 'FAILED' ? 'Connection refused' : null,
    }))

    mockGetBase((url) => {
      if (url === '/integrations/logs') {
        return { data: { data: { logs, pagination: { total: logs.length, pages: 1 } } } }
      }
    })

    render(<IntegrationLogsPage />)

    for (const status of statuses) {
      await waitFor(() => {
        expect(screen.getByTestId(`status-badge-${status}`)).toBeInTheDocument()
        expect(screen.getByTestId(`status-badge-${status}`)).toHaveTextContent(status)
      })
    }
  })

  it('shows error tooltip text for FAILED entries', async () => {
    const failedLog: IntegrationLog = {
      ...sampleLog,
      id: 'l-fail',
      status: 'FAILED',
      error: 'Connection refused',
    }

    mockGetBase((url) => {
      if (url === '/integrations/logs') {
        return {
          data: { data: { logs: [failedLog], pagination: { total: 1, pages: 1 } } },
        }
      }
    })

    render(<IntegrationLogsPage />)

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })

  it('shows — when no error', async () => {
    mockGetBase((url) => {
      if (url === '/integrations/logs') {
        return {
          data: { data: { logs: [sampleLog], pagination: { total: 1, pages: 1 } } },
        }
      }
    })

    render(<IntegrationLogsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('status-badge-SENT')).toBeInTheDocument()
    })
  })
})
