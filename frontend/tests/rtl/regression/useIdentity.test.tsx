import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { useIdentity } from '@/hooks/useIdentity'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }))
import api from '@/lib/axios'

function Probe() {
  const { appName, identity } = useIdentity()
  return (
    <p>
      {appName}|{identity.contact_email ?? ''}
    </p>
  )
}

describe('useIdentity', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('returns identity from /app-config', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { identity: { app_name: 'Acme', contact_email: 'a@b.co' } } },
    })
    render(<Probe />)
    await waitFor(() => expect(screen.getByText('Acme|a@b.co')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/app-config')
  })

  it('falls back to the default name when app_name is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { identity: { app_name: '' } } } })
    render(<Probe />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(screen.getByText('KDL Admin|')).toBeInTheDocument()
  })

  it('falls back to the default name when the request fails', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/app-config'
        ? Promise.reject(new Error('down'))
        : (Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>)
    )
    render(<Probe />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(screen.getByText('KDL Admin|')).toBeInTheDocument()
  })
})
