import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '../utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import api from '@/lib/axios'

// EventSource mock that exposes a trigger handle per URL
type EsHandler = (event: { data: string }) => void
const esInstances: MockEventSource[] = []

class MockEventSource {
  url: string
  listeners: Record<string, EsHandler[]> = {}
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    esInstances.push(this)
  }

  addEventListener(type: string, handler: EsHandler) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type]!.push(handler)
  }

  dispatchEvent(type: string, data: unknown) {
    for (const h of this.listeners[type] ?? []) {
      h({ data: JSON.stringify(data) })
    }
  }

  close() {}
}

function mockGetBase(overrides?: (url: string) => unknown) {
  vi.mocked(api.post).mockImplementation((url: string) => {
    if (url === '/notifications/stream/ticket') {
      return Promise.resolve({ data: { data: { ticket: 'test-ticket' } } }) as ReturnType<
        typeof api.post
      >
    }
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.post>
  })
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (overrides) {
      const result = overrides(url)
      if (result !== undefined) return Promise.resolve(result) as ReturnType<typeof api.get>
    }
    if (url === '/notifications/unread-count') {
      return Promise.resolve({ data: { data: { count: 0 } } }) as ReturnType<typeof api.get>
    }
    if (url === '/notifications') {
      return Promise.resolve({ data: { data: { items: [] } } }) as ReturnType<typeof api.get>
    }
    if (url === '/modules/enabled') {
      return Promise.resolve({
        data: {
          data: {
            modules: [{ slug: 'notifications', name: 'Notifications', core: false, nav: [] }],
          },
        },
      }) as ReturnType<typeof api.get>
    }
    if (url === '/auth/me/permissions') {
      return Promise.resolve({
        data: { data: { permissions: [], roles: [], bypass: false } },
      }) as ReturnType<typeof api.get>
    }
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    esInstances.length = 0
    useAuthStore.setState({ accessToken: 'test-token', isAuthenticated: true, isLoading: false })
    global.EventSource = MockEventSource as unknown as typeof EventSource
    // Restore matchMedia after clearAllMocks (next-themes needs addListener)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders bell with no badge when unread count is 0', async () => {
    mockGetBase()
    render(<NotificationBell />)

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('notification-bell-badge')).not.toBeInTheDocument()
  })

  it('badge updates count when stream emits a notification event', async () => {
    mockGetBase()
    render(<NotificationBell />)

    // Bell renders, badge absent initially
    await waitFor(() => {
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('notification-bell-badge')).not.toBeInTheDocument()

    // Stream opens only after the ticket exchange resolves (KDL-270 M5)
    await waitFor(() => {
      expect(esInstances[0]).toBeDefined()
    })
    const es = esInstances[0]
    // Ticket rides in the query string; the JWT must not (KDL-270 M5)
    expect(es!.url).toContain('ticket=test-ticket')
    expect(es!.url).not.toContain('test-token')

    await act(async () => {
      es!.dispatchEvent('notification', {
        id: 'n1',
        user_id: 'u1',
        category_slug: 'system',
        title: 'Test notification',
        body: 'Hello',
        data: null,
        read_at: null,
        created_at: new Date().toISOString(),
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell-badge')).toBeInTheDocument()
      expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('1')
    })
  })

  it('bell is absent when notifications module is disabled', async () => {
    mockGetBase((url) => {
      if (url === '/modules/enabled') {
        return Promise.resolve({ data: { data: { modules: [] } } })
      }
    })
    render(<NotificationBell />)

    // Give enough time for queries to settle
    await waitFor(() => {
      expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument()
    })
  })
})
