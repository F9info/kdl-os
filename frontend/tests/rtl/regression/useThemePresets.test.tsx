import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { useThemePresets } from '@/admin/hooks/useThemePresets'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get, post: vi.fn(), delete: vi.fn() } }))

function Names() {
  const { presets } = useThemePresets()
  return <p data-testid="names">{presets.map((p) => p.name).join(',')}</p>
}

beforeEach(() => vi.clearAllMocks())

describe('theme looks come from the library (T10)', () => {
  it('shows what the API returns, including a look someone saved', async () => {
    get.mockResolvedValue({
      data: {
        data: {
          presets: [{ key: 'brand', name: 'Brand look', builtin: false, light: {}, dark: {} }],
        },
      },
    })
    render(<Names />)
    await waitFor(() => expect(screen.getByTestId('names').textContent).toBe('Brand look'))
    expect(get).toHaveBeenCalledWith('/theme-engine/presets')
  })

  it('falls back to the built-in looks while loading or when the request fails', async () => {
    get.mockRejectedValue(new Error('offline'))
    render(<Names />)
    expect(screen.getByTestId('names').textContent).toBe('Ocean,Forest,Sunset,Slate')
  })
})
