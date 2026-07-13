/**
 * Gate tests for KDL-177 Phase C (C1):
 *   - platform switch
 *   - dirty → save
 *   - reset
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/axios', () => {
  const get = vi.fn()
  const post = vi.fn()
  return { default: { get, post } }
})

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Minimal localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// ── Fixture ───────────────────────────────────────────────────────────────────

const makePane = (id: string, label: string, platform = 'webapp') => ({
  id: `pane-${id}`,
  slug: `${platform}.${id}`,
  label,
  icon: '🎨',
  ic: '#e8554d',
  modes: [{ id: 'dark', label: '🌙 Dark' }, { id: 'light', label: '☀️ Light' }],
  devices: null,
  groups: [
    {
      id: `grp-${id}-1`,
      slug: `${platform}.${id}.colors`,
      label: 'Colors',
      tag: 'dark',
      fields: [
        {
          id: `field-${id}-bg`,
          slug: `${platform}.${id}.dark.colors.background`,
          label: 'Background Color',
          input_type: 'color',
          options: null,
          alt_text: null,
          value: '#1e1e20',
          sort: 0,
        },
      ],
    },
  ],
})

const webappSchema = {
  data: [makePane('branding', 'Theme Color'), makePane('buttons', 'Buttons')],
}

const tvSchema = {
  data: [makePane('branding', 'TV Branding', 'tv')],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrapWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

async function importPage() {
  const mod = await import('@/app/admin/template-engine/page')
  return mod.default
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Template Engine page (KDL-177 C1 gates)', () => {
  let apiGet: ReturnType<typeof vi.fn>
  let apiPost: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    localStorageMock.clear()
    vi.clearAllMocks()
    const api = await import('@/lib/axios')
    apiGet = api.default.get as ReturnType<typeof vi.fn>
    apiPost = api.default.post as ReturnType<typeof vi.fn>
    apiGet.mockResolvedValue({ data: webappSchema })
    apiPost.mockResolvedValue({ data: { saved: 1 } })
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('renders the page and shows panes after schema loads', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)

    // Platform bar
    expect(screen.getByTestId('platform-bar')).toBeTruthy()
    expect(screen.getByTestId('platform-btn-webapp')).toBeTruthy()
    expect(screen.getByTestId('platform-btn-tv')).toBeTruthy()

    // Sidebar panes load after schema
    await waitFor(() => {
      expect(screen.getByTestId('pane-btn-pane-branding')).toBeTruthy()
    })
  })

  it('switches platform — fires new query with new platform param', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))

    apiGet.mockResolvedValueOnce({ data: tvSchema })

    await act(async () => {
      fireEvent.click(screen.getByTestId('platform-btn-tv'))
    })

    await waitFor(() => {
      const calls = apiGet.mock.calls
      const tvCall = calls.find((c) => String(c[0]).includes('platform=tv'))
      expect(tvCall).toBeTruthy()
    })

    // localStorage updated
    expect(localStorageMock.getItem('te_platform')).toBe('tv')
  })

  it('dirty flag appears after editing a field; Save posts values to API', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))

    // Click first pane
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })

    // Wait for field to render (mode defaults to 'dark', group tag is 'dark' → visible)
    await waitFor(() => {
      expect(screen.getByTestId('field-row-field-branding-bg')).toBeTruthy()
    })

    // Initially Save button should be disabled (not dirty)
    const saveBtn = screen.getByTestId('btn-save') as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)

    // Change the color field
    const colorInput = screen.getByTestId('field-row-field-branding-bg').querySelector('input[type="color"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(colorInput, { target: { value: '#ff0000' } })
    })

    // Now save should be enabled
    await waitFor(() => {
      expect((screen.getByTestId('btn-save') as HTMLButtonElement).disabled).toBe(false)
    })

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save'))
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/template-engine/values',
        expect.objectContaining({
          platform: 'webapp',
          type_id: 'pane-branding',
          values: expect.arrayContaining([
            expect.objectContaining({ field_id: 'field-branding-bg', value: '#ff0000' }),
          ]),
        }),
      )
    })
  })

  // KDL-190 C-1 regression: dirty state must NOT bleed across platforms.
  // Pane ids repeat across platforms (pane-branding exists on webapp AND tv);
  // editing a webapp pane must not mark the same-id pane dirty on another
  // platform (which previously enabled Save and posted mismatched field_ids → 422).
  it('does not bleed dirty state across platforms (C-1 regression)', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))

    // Select + edit the webapp branding pane
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })
    await waitFor(() => screen.getByTestId('field-row-field-branding-bg'))
    const colorInput = screen
      .getByTestId('field-row-field-branding-bg')
      .querySelector('input[type="color"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(colorInput, { target: { value: '#ff0000' } })
    })
    await waitFor(() => {
      expect((screen.getByTestId('btn-save') as HTMLButtonElement).disabled).toBe(false)
    })

    // Switch to TV (same pane id, untouched) — must be clean
    apiGet.mockResolvedValueOnce({ data: tvSchema })
    await act(async () => {
      fireEvent.click(screen.getByTestId('platform-btn-tv'))
    })
    await waitFor(() => {
      const tvCall = apiGet.mock.calls.find((c) => String(c[0]).includes('platform=tv'))
      expect(tvCall).toBeTruthy()
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })
    await waitFor(() => screen.getByTestId('field-row-field-branding-bg'))

    // The TV pane with the same id must NOT be dirty → Save disabled, no bleed
    expect((screen.getByTestId('btn-save') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('All changes saved')).toBeTruthy()

    // Switching back to webapp preserves that platform's unsaved edit
    apiGet.mockResolvedValueOnce({ data: webappSchema })
    await act(async () => {
      fireEvent.click(screen.getByTestId('platform-btn-webapp'))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })
    await waitFor(() => {
      expect((screen.getByTestId('btn-save') as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('Reset posts to /template-engine/reset with correct pane id', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })

    const resetBtn = screen.getByTestId('btn-reset') as HTMLButtonElement
    expect(resetBtn.disabled).toBe(false)

    await act(async () => {
      fireEvent.click(resetBtn)
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/template-engine/reset',
        expect.objectContaining({
          platform: 'webapp',
          type_id: 'pane-branding',
        }),
      )
    })
  })
})
