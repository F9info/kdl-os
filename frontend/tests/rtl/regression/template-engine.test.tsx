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
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// ── Fixture ───────────────────────────────────────────────────────────────────
// Mirrors the REAL backend contract (verified live against GET
// /template-engine/schema): the envelope is { success, data: { platform, schema } },
// a pane carries both a semantic `id` and a Type cuid `type_id`, groups expose
// `name`/`slug` (no `tag` — theme/device scope is the slug's final segment), and
// fields expose `field_name`/`default_value` (no `label`). The previous fixture
// encoded a fictional shape that hid crash C-5 and 422 C-6 from RTL.

// `options` MUST be sent as the real backend shape — a JSON *string* (or null),
// not a parsed object. A prior all-color fixture (every field input_type:'color'
// with options:null) hid F1: the page passed the raw string straight into
// select/slider controls, so real select/radio/slider fields rendered empty and
// out-of-range slides 422'd the whole pane. select + slider + number fixtures
// below carry stringified options and exercise that parse boundary.
const makePane = (id: string, label: string, platform = 'webapp') => ({
  id: `pane-${id}`,
  type_id: `type-${id}`,
  label,
  icon: '🎨',
  modes: [
    { id: 'dark', label: '🌙 Dark' },
    { id: 'light', label: '☀️ Light' },
  ],
  devices: null,
  groups: [
    {
      id: `grp-${id}-1`,
      name: 'Colors',
      // final slug segment 'dark' matches a mode id → this group is dark-scoped
      slug: `${platform}.${id}.colors.dark`,
      fields: [
        {
          id: `field-${id}-bg`,
          slug: `${platform}.${id}.dark.colors.background`,
          field_name: 'Background Color',
          input_type: 'color',
          options: null,
          alt_text: null,
          value: '#1e1e20',
          default_value: '#1e1e20',
          sort: 0,
        },
      ],
    },
    {
      id: `grp-${id}-2`,
      name: 'Typography',
      // no trailing mode/device segment → plain, always-visible section
      slug: `${platform}.${id}.typography`,
      fields: [
        {
          id: `field-${id}-font`,
          slug: `${platform}.${id}.typography.font_family`,
          field_name: 'Font Family',
          input_type: 'select',
          // options on the wire is a JSON STRING, not an object
          options: '{"choices":["Inter","Roboto","System"]}',
          alt_text: null,
          value: 'Inter',
          default_value: 'Inter',
          sort: 0,
        },
        {
          id: `field-${id}-radius`,
          slug: `${platform}.${id}.typography.radius`,
          field_name: 'Corner Radius',
          input_type: 'slider',
          options: '{"min":0,"max":24,"step":2,"unit":"px"}',
          alt_text: null,
          value: '8',
          default_value: '8',
          sort: 1,
        },
        {
          id: `field-${id}-weight`,
          slug: `${platform}.${id}.typography.weight`,
          field_name: 'Font Weight',
          input_type: 'number',
          options: '{"unit":"px"}',
          alt_text: null,
          // backend can null out value/default_value — must not crash the page
          value: null,
          default_value: null,
          sort: 2,
        },
      ],
    },
  ],
})

const envelope = (platform: string, panes: ReturnType<typeof makePane>[]) => ({
  success: true,
  data: { platform, schema: panes },
})

const webappSchema = envelope('webapp', [
  makePane('branding', 'Theme Color'),
  makePane('buttons', 'Buttons'),
])

const tvSchema = envelope('tv', [makePane('branding', 'TV Branding', 'tv')])

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

// Step 1 of the page's two-step flow is a platform-picker landing screen —
// every test needs to click through it before the editor (platform bar,
// panes, etc.) exists in the DOM.
async function enterWebapp() {
  await waitFor(() => screen.getByTestId('landing-card-webapp'))
  fireEvent.click(screen.getByTestId('landing-card-webapp'))
  await waitFor(() => screen.getByTestId('landing-subcard-webapp-frontend'))
  fireEvent.click(screen.getByTestId('landing-subcard-webapp-frontend'))
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
    await enterWebapp()

    // Sidebar panes load after schema
    await waitFor(() => {
      expect(screen.getByTestId('pane-btn-pane-branding')).toBeTruthy()
    })
  })

  // Platform selection is a two-level landing screen (platform → sub-section)
  // — picking a sub-card fires the query for that platform and persists it,
  // no in-editor switcher anymore.
  it('picking a landing sub-card fires the query for that platform param', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    apiGet.mockResolvedValueOnce({ data: tvSchema })

    await waitFor(() => screen.getByTestId('landing-card-tv'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('landing-card-tv'))
    })
    await waitFor(() => screen.getByTestId('landing-subcard-tv-app'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('landing-subcard-tv-app'))
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
    await enterWebapp()
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
    const colorInput = screen
      .getByTestId('field-row-field-branding-bg')
      .querySelector('input[type="color"]') as HTMLInputElement
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
          type_id: 'type-branding',
          values: expect.arrayContaining([
            expect.objectContaining({ field_id: 'field-branding-bg', value: '#ff0000' }),
          ]),
        })
      )
    })
  })

  it('Reset posts to /template-engine/reset with correct pane id', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
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
          type_id: 'type-branding',
        })
      )
    })
  })

  // KDL-178 F1 regression: `field.options` arrives as a JSON *string*. The page
  // must parse it before handing it to select/slider controls, or every
  // select/radio renders empty and sliders get fake 0–100 bounds.
  it('parses stringified select options — renders real choices + current value (F1)', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })
    await waitFor(() => screen.getByTestId('field-row-field-branding-font'))

    const select = screen
      .getByTestId('field-row-field-branding-font')
      .querySelector('select') as HTMLSelectElement
    expect(select).toBeTruthy()
    // choices parsed from the JSON string → three options, current value selected
    expect(select.querySelectorAll('option')).toHaveLength(3)
    expect(select.value).toBe('Inter')
  })

  it('parses stringified slider options — real min/max, not fake 0–100 (F1)', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })
    await waitFor(() => screen.getByTestId('field-row-field-branding-radius'))

    const range = screen
      .getByTestId('field-row-field-branding-radius')
      .querySelector('input[type="range"]') as HTMLInputElement
    expect(range).toBeTruthy()
    expect(range.min).toBe('0')
    expect(range.max).toBe('24') // parsed from options; NOT the fallback 100
    expect(range.step).toBe('2')
  })

  // KDL-178 F2 regression: a `number` field must post the bare number. A unit
  // suffix ("40px") makes the backend `Number(value)` → NaN and 422s the pane.
  it('number field posts the bare number, no unit suffix (F2)', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pane-btn-pane-branding'))
    })
    await waitFor(() => screen.getByTestId('field-row-field-branding-weight'))

    const numInput = screen
      .getByTestId('field-row-field-branding-weight')
      .querySelector('input[type="number"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(numInput, { target: { value: '600' } })
    })
    await waitFor(() => {
      expect((screen.getByTestId('btn-save') as HTMLButtonElement).disabled).toBe(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save'))
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/template-engine/values',
        expect.objectContaining({
          values: expect.arrayContaining([
            expect.objectContaining({ field_id: 'field-branding-weight', value: '600' }),
          ]),
        })
      )
    })
    // the posted weight value carries no unit
    const call = apiPost.mock.calls.find((c) => c[0] === '/template-engine/values')
    const weight = call?.[1]?.values?.find(
      (v: { field_id: string }) => v.field_id === 'field-branding-weight'
    )
    expect(weight.value).toBe('600')
    expect(String(weight.value)).not.toMatch(/px$/)
  })

  // KDL-178 F6 regression: a 422 names the offending field in formErrors — the
  // toast must surface it, not a generic "Could not save settings."
  it('surfaces backend formErrors on a failed save (F6)', async () => {
    const { toast } = await import('@/hooks/use-toast')
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))
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

    apiPost.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: 'Validation failed',
          errors: {
            fieldErrors: {},
            formErrors: ['webapp.branding.typography.radius: value must be <= 24'],
          },
        },
      },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save'))
    })

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: expect.stringContaining('radius: value must be <= 24'),
        })
      )
    })
  })

  it('shows an error state when the schema fails to load', async () => {
    apiGet.mockReset()
    apiGet.mockRejectedValue(new Error('network down'))
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()

    await waitFor(() => {
      expect(screen.getByText('Failed to load schema.')).toBeTruthy()
    })
  })
})
