/**
 * Gate tests for KDL-177 Phase C (C1):
 *   - platform switch
 *   - dirty → save
 *   - reset
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
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
// /theme-engine/schema): the envelope is { success, data: { platform, schema } },
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
  const mod = await import('@/app/admin/theme-engine/page')
  return mod.default
}

// The wizard was removed in KDL-637: the editor renders on first paint.
// webapp is the default platform (localStorage fallback), so the schema
// query fires immediately — no landing-card navigation required.
async function enterWebapp() {
  await waitFor(() => screen.getByTestId('theme-engine-page'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Theme Engine page (KDL-177 C1 gates)', () => {
  let apiGet: ReturnType<typeof vi.fn>
  let apiPost: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    localStorageMock.clear()
    // These gates cover the Advanced editor; Simple is the default view now.
    localStorageMock.setItem('te_view', 'advanced')
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

  // Platform bar replaces the two-level landing screen: clicking a platform
  // button fires the schema query for that platform in place and persists the
  // selection — no navigation, no unmount of the editor.
  it('clicking a platform-bar button fires the schema query with the correct platform param', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)

    await waitFor(() => screen.getByTestId('platform-bar'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('platform-btn-tv'))
    })

    await waitFor(() => {
      const calls = apiGet.mock.calls
      const tvCall = calls.find((c) => String(c[0]).includes('platform=tv'))
      expect(tvCall).toBeTruthy()
    })

    // localStorage updated for the new platform
    expect(localStorageMock.getItem('th_platform')).toBe('tv')
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
        '/theme-engine/values',
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

  it('Reset posts to /theme-engine/reset with correct pane id', async () => {
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
        '/theme-engine/reset',
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
        '/theme-engine/values',
        expect.objectContaining({
          values: expect.arrayContaining([
            expect.objectContaining({ field_id: 'field-branding-weight', value: '600' }),
          ]),
        })
      )
    })
    // the posted weight value carries no unit
    const call = apiPost.mock.calls.find((c) => c[0] === '/theme-engine/values')
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

  // KDL-637 regression guard: the two-step wizard was deleted and replaced
  // with an always-visible platform-bar. This test locks that in so a future
  // reintroduction of landing-card/sub-card testids is caught immediately.
  it('KDL-637 regression: editor renders on first paint — platform-bar visible, no landing cards', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)

    // platform-bar present before any user interaction
    await waitFor(() => screen.getByTestId('platform-bar'))
    expect(screen.getByTestId('theme-engine-page')).toBeTruthy()

    // no wizard / landing-card testids anywhere in the DOM
    expect(screen.queryByTestId('landing-card-webapp')).toBeNull()
    expect(screen.queryByTestId('landing-card-tv')).toBeNull()
    expect(screen.queryByTestId('landing-subcard-webapp-frontend')).toBeNull()

    // sidebar pane buttons appear once the schema loads
    await waitFor(() => screen.getByTestId('pane-btn-pane-branding'))
  })

  // GET /schema response for an ad-hoc set of panes (the module-level `envelope` helper is typed to
  // makePane's exact return shape, which the variants below deliberately extend).
  const schemaResponse = (panes: object[]) => ({
    data: { success: true, data: { platform: 'webapp', schema: panes } },
  })

  // Found while reviewing the page split: Reset dropped the pane's local + saved value maps and
  // relied on the schema-init effect to rebuild them. A pane that was never saved refetches a
  // deep-equal schema, so TanStack keeps the same `data` reference, the effect never re-runs and
  // later edits went untracked (footer "All changes saved", Save disabled).
  it('Reset keeps the pane editable: an edit made after it is tracked and Save enables', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('field-row-field-branding-bg'))

    const color = () =>
      screen
        .getByTestId('field-row-field-branding-bg')
        .querySelector('input[type="color"]') as HTMLInputElement
    const footer = () => screen.getByTestId('footer').textContent
    const saveDisabled = () => (screen.getByTestId('btn-save') as HTMLButtonElement).disabled

    await act(async () => {
      fireEvent.change(color(), { target: { value: '#ff0000' } })
    })
    await waitFor(() => expect(footer()).toContain('Unsaved changes'))

    // The server answers Reset with the same schema: nothing was ever saved for this pane.
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-reset'))
    })
    await waitFor(() => expect(color().value).toBe('#1e1e20'))
    expect(footer()).toContain('All changes saved')
    expect(saveDisabled()).toBe(true)

    await act(async () => {
      fireEvent.change(color(), { target: { value: '#00ff00' } })
    })
    await waitFor(() => expect(footer()).toContain('Unsaved changes'))
    expect(saveDisabled()).toBe(false)

    // ...and that edit is what Save posts.
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save'))
    })
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/theme-engine/values',
        expect.objectContaining({
          values: expect.arrayContaining([
            expect.objectContaining({ field_id: 'field-branding-bg', value: '#00ff00' }),
          ]),
        })
      )
    })
  })

  // Guard on the fix above: the pane is re-seeded only from schema data fetched AFTER the reset. If
  // that refetch fails, re-seeding from the stale cache would show pre-reset values as "saved",
  // and the next Save would write them back over the server's fresh defaults.
  it('Reset whose schema refetch fails does not re-seed the pane from stale data', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('field-row-field-branding-bg'))

    const color = () =>
      screen
        .getByTestId('field-row-field-branding-bg')
        .querySelector('input[type="color"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(color(), { target: { value: '#ff0000' } })
    })
    await waitFor(() => expect(screen.getByTestId('footer').textContent).toContain('Unsaved'))

    apiGet.mockRejectedValueOnce(new Error('network down')) // the refetch that follows Reset
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-reset'))
    })
    await waitFor(() => expect(screen.getByText('Failed to load schema.')).toBeTruthy())

    // Nothing was re-seeded: the edit is still shown, still flagged unsaved.
    expect(color().value).toBe('#ff0000')
    expect(screen.getByTestId('footer').textContent).toContain('Unsaved changes')
  })

  // The same guard for a Reset that finishes after the user switched platform: that platform's
  // schema query is no longer active, and a default invalidate would leave it stale (then re-seeded
  // from the pre-reset cache once the user comes back).
  it('Reset refreshes the schema even when the user switched platform while it was running', async () => {
    let finishReset: () => void = () => {}
    apiPost.mockImplementation((url: string) =>
      url === '/theme-engine/reset'
        ? new Promise((resolve) => {
            finishReset = () => resolve({ data: { saved: 1 } })
          })
        : Promise.resolve({ data: { saved: 1 } })
    )
    const webappGets = () =>
      apiGet.mock.calls.filter((c) => String(c[0]).includes('platform=webapp')).length

    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('field-row-field-branding-bg'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-reset')) // POST held open
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('platform-btn-tv'))
    })
    await waitFor(() =>
      expect(apiGet.mock.calls.some((c) => String(c[0]).includes('platform=tv'))).toBe(true)
    )

    const before = webappGets()
    await act(async () => {
      finishReset()
    })
    await waitFor(() => expect(webappGets()).toBe(before + 1))
  })

  // Pre-existing a11y gaps moved verbatim by the split: the current choice of every toggle-style
  // button was only visible as a colour, and section headers did not say if they were open.
  it('exposes the current choice on toggle-style buttons via aria-pressed', async () => {
    const pane = {
      ...makePane('branding', 'Theme Color'),
      devices: [
        { id: 'phone', label: 'Phone' },
        { id: 'tablet', label: 'Tablet' },
      ],
    }
    apiGet.mockResolvedValue(schemaResponse([pane]))
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('device-tab-phone'))

    const pressed = (testId: string) => screen.getByTestId(testId).getAttribute('aria-pressed')
    const click = async (testId: string) => {
      await act(async () => {
        fireEvent.click(screen.getByTestId(testId))
      })
    }

    // The fixture sends no activeTheme, so the Active Theme bar falls back to "system".
    expect([
      pressed('platform-btn-webapp'),
      pressed('platform-btn-tv'),
      pressed('active-theme-btn-system'),
      pressed('active-theme-btn-light'),
      pressed('mode-tab-dark'),
      pressed('mode-tab-light'),
      pressed('device-tab-phone'),
      pressed('device-tab-tablet'),
    ]).toEqual(['true', 'false', 'true', 'false', 'true', 'false', 'true', 'false'])

    await click('active-theme-btn-light')
    await click('mode-tab-light')
    await click('device-tab-tablet')
    expect([
      pressed('active-theme-btn-system'),
      pressed('active-theme-btn-light'),
      pressed('mode-tab-dark'),
      pressed('mode-tab-light'),
      pressed('device-tab-phone'),
      pressed('device-tab-tablet'),
    ]).toEqual(['false', 'true', 'false', 'true', 'false', 'true'])
  })

  it('exposes section state and control names: aria-expanded, aria-pressed chips, named search and dirty dot', async () => {
    const base = makePane('branding', 'Theme Color')
    const typography = base.groups[1]!
    const pane = {
      ...base,
      groups: [
        base.groups[0]!,
        {
          ...typography,
          fields: [
            ...typography.fields,
            {
              id: 'field-branding-tags',
              slug: 'webapp.branding.typography.tags',
              field_name: 'Tags',
              input_type: 'multiselect',
              options: '{"choices":["a","b"]}',
              alt_text: null,
              value: '["a"]',
              default_value: '["a"]',
              sort: 3,
            },
          ],
        },
      ],
    }
    apiGet.mockResolvedValue(schemaResponse([pane, makePane('buttons', 'Buttons')]))
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await enterWebapp()
    await waitFor(() => screen.getByTestId('field-row-field-branding-font'))

    // Section header: announces open/closed, and the decorative ▶ is not part of its name.
    const header = () => screen.getByRole('button', { name: 'Typography' })
    expect(header().getAttribute('aria-expanded')).toBe('true')
    await act(async () => {
      fireEvent.click(header())
    })
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('field-row-field-branding-font')).toBeNull()
    await act(async () => {
      fireEvent.click(header())
    })
    expect(header().getAttribute('aria-expanded')).toBe('true')

    // Multi-select chips: pressed = selected.
    const tags = within(screen.getByTestId('field-row-field-branding-tags'))
    expect(tags.getByRole('button', { name: 'a' }).getAttribute('aria-pressed')).toBe('true')
    expect(tags.getByRole('button', { name: 'b' }).getAttribute('aria-pressed')).toBe('false')
    await act(async () => {
      fireEvent.click(tags.getByRole('button', { name: 'b' }))
    })
    expect(tags.getByRole('button', { name: 'b' }).getAttribute('aria-pressed')).toBe('true')

    // The search box has a name (a placeholder is not one).
    expect(screen.getByRole('textbox', { name: 'Search settings' })).toBe(
      screen.getByTestId('sidebar-search')
    )

    // The unsaved dot beside a pane in the sidebar is not colour-only. (The multi-select edit
    // above already made this pane dirty.)
    expect(
      within(screen.getByTestId('pane-btn-pane-branding')).getByRole('img', {
        name: 'Has unsaved changes',
      })
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('pane-btn-pane-buttons')).queryByRole('img', {
        name: 'Has unsaved changes',
      })
    ).toBeNull()
  })
})

// Simple is the default view; page.tsx's switch is the only logic left in the page itself.
describe('Theme Engine Simple/Advanced switch', () => {
  beforeEach(async () => {
    localStorageMock.clear()
    vi.clearAllMocks()
    const api = await import('@/lib/axios')
    ;(api.default.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: webappSchema })
    ;(api.default.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { saved: 1 } })
    // The Simple view has its own suite (SimpleThemeView.test.tsx); a stub keeps this one on the switch.
    vi.doMock('@/app/admin/theme-engine/SimpleThemeView', () => ({
      SimpleThemeView: () => <div data-testid="simple-view" />,
    }))
  })

  afterEach(() => {
    vi.doUnmock('@/app/admin/theme-engine/SimpleThemeView')
    vi.resetModules()
  })

  const viewButton = (name: 'Simple' | 'Advanced') =>
    within(screen.getByRole('group', { name: 'Theme view' })).getByRole('button', { name })

  it('opens on Simple by default', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)

    expect(await screen.findByTestId('simple-view')).toBeTruthy()
    expect(screen.queryByTestId('theme-engine-page')).toBeNull()
    expect(viewButton('Simple').getAttribute('aria-pressed')).toBe('true')
    expect(viewButton('Advanced').getAttribute('aria-pressed')).toBe('false')
  })

  it('switches to Advanced and back, remembering the choice', async () => {
    const Page = await importPage()
    wrapWithQueryClient(<Page />)
    await screen.findByTestId('simple-view')

    await act(async () => {
      fireEvent.click(viewButton('Advanced'))
    })
    expect(await screen.findByTestId('theme-engine-page')).toBeTruthy()
    expect(screen.queryByTestId('simple-view')).toBeNull()
    expect(localStorageMock.getItem('te_view')).toBe('advanced')
    expect(viewButton('Advanced').getAttribute('aria-pressed')).toBe('true')
    expect(viewButton('Simple').getAttribute('aria-pressed')).toBe('false')

    await act(async () => {
      fireEvent.click(viewButton('Simple'))
    })
    expect(await screen.findByTestId('simple-view')).toBeTruthy()
    expect(screen.queryByTestId('theme-engine-page')).toBeNull()
    expect(localStorageMock.getItem('te_view')).toBe('simple')
    expect(viewButton('Simple').getAttribute('aria-pressed')).toBe('true')
  })

  it('opens on Advanced when that was the saved view', async () => {
    localStorageMock.setItem('te_view', 'advanced')
    const Page = await importPage()
    wrapWithQueryClient(<Page />)

    expect(await screen.findByTestId('theme-engine-page')).toBeTruthy()
    expect(screen.queryByTestId('simple-view')).toBeNull()
    expect(viewButton('Advanced').getAttribute('aria-pressed')).toBe('true')
  })

  // The Advanced editor is a fixed-height app window. It used to size itself to
  // `100dvh - 4rem - …`, which ignored the 48px shell footer and, since the view switch was added
  // above it, the switch bar too: Save/Reset sat below the fold at scroll-top. Now one
  // height-bounded column holds the switch and the editor, sized from the shell's Layout tokens.
  it('sizes the Advanced editor to what the admin shell leaves, so Save/Reset stay on screen', async () => {
    localStorageMock.setItem('te_view', 'advanced')
    const Page = await importPage()
    wrapWithQueryClient(<Page />)

    const editor = await screen.findByTestId('theme-engine-page')
    const column = editor.parentElement as HTMLElement
    expect(within(column).getByRole('group', { name: 'Theme view' })).toBeTruthy()
    for (const token of [
      '--th-layout-header-height',
      '--th-layout-footer-height',
      '--th-layout-page-padding',
    ]) {
      expect(column.style.height).toContain(token)
    }
    expect(editor.style.height).toBe('')
  })
})
