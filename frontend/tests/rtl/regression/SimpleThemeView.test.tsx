import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { SimpleThemeView } from '@/app/admin/theme-engine/SimpleThemeView'
import { googleFontUrl } from '@/app/admin/theme-engine/simple/fonts'
import { tokenVar } from '@/app/admin/theme-engine/simple/palette'

const { get, post, bundle, loadFont, toast } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  bundle: { broken: false },
  loadFont: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@/lib/axios', () => ({ default: { get, post } }))
// The real toast store is module-level, so a toast from an earlier test would still be on screen
// in the next one and satisfy a text search. A spy sees exactly this test's toasts.
vi.mock('@/hooks/use-toast', () => ({ toast, useToast: () => ({ toasts: [] }) }))
vi.mock('@/components/providers/ThemeEngineProvider', async (orig) => ({
  ...(await orig<object>()),
  refreshThemeEngineTokens: vi.fn(),
}))
// The real loader keeps module-level state and <link> tags in document.head across tests, which
// would make "was this font requested" depend on test order. A spy asks the question directly.
vi.mock('@/lib/load-google-font', () => ({ loadGoogleFont: loadFont }))
// The real block bundle is ~16k lines of JSX; jsdom only needs to know which
// blocks the preview asked for (and, below, what happens when it cannot render).
vi.mock('@/app/admin/theme-engine/simple/PreviewBlocks', () => ({
  default: ({ blocks }: { blocks: string[] }) => {
    if (bundle.broken) throw new Error('block bundle failed')
    return <div data-testid="preview-blocks">{blocks.join(',')}</div>
  },
}))

const LS_PACK = 'te_simple_preview_pack'
const CONSTRUCTION =
  'ConstructionHero,ConstructionServicesGrid,ConstructionQuoteCTA,ConstructionFooter'
const GENERAL = 'Hero,FeatureCards,StatsStrip,Footer'
// Every branding field in the fixture: 13 per mode, light and dark.
const BRANDING_FIELDS = 26
// buttons.<mode>.primary_button.text_color as the Theme Engine ships it: white in both modes.
const STOCK_BUTTON_TEXT = '#ffffff'

const field = (
  id: string,
  slug: string,
  value: string,
  locked_by: string | null = null,
  updated_at: string | null = null
) => ({ id, slug, field_name: slug, value, locked_by, updated_at })

// The stock values (backend theme-engine/schema/index.js): the six colours the Simple view
// edits, plus the ones it leaves alone (tertiary, titles, body, surfaces, secondary text, border).
const LIGHT = {
  primary: '#2119b3',
  secondary: '#0284c7',
  accent: '#7c3aed',
  highlight: '#f9941f',
  tertiary: '#0891b2',
  background: '#f2f2f7',
  text: '#1d1d21',
  titles: '#1d1d21',
  body: '#3a3a40',
  surface: '#ffffff',
  card: '#ffffff',
  textSecondary: '#74747c',
  border: '#d8d8dd',
}
const DARK: typeof LIGHT = {
  primary: '#7468f3',
  secondary: '#0ea5e9',
  accent: '#a855f7',
  highlight: '#f7b23b',
  tertiary: '#64d2ff',
  background: '#1e1e20',
  text: '#f2f2f5',
  titles: '#f2f2f5',
  body: '#c7c7ce',
  surface: '#2a2a2e',
  card: '#323236',
  textSecondary: '#a5a5ad',
  border: '#3d3d42',
}

// Field ids: <prefix><n>, prefix f = light, d = dark.
const ID = {
  primary: 1,
  secondary: 2,
  accent: 3,
  background: 4,
  text: 5,
  highlight: 6,
  tertiary: 7,
  titles: 8,
  body: 9,
  surface: 10,
  card: 11,
  textSecondary: 12,
  border: 13,
}

function brandingGroups(
  mode: 'light' | 'dark',
  c: typeof LIGHT,
  lockedBy: string | null,
  updatedAt: string | null
) {
  const p = `webapp.branding.${mode}`
  const id = (k: keyof typeof ID) => `${mode === 'light' ? 'f' : 'd'}${ID[k]}`
  return [
    {
      slug: `${p}.brand_colors`,
      fields: [
        field(id('primary'), `${p}.brand_colors.primary_color`, c.primary, lockedBy, updatedAt),
        field(id('secondary'), `${p}.brand_colors.secondary_color`, c.secondary),
        field(id('accent'), `${p}.brand_colors.accent_color`, c.accent),
        field(id('highlight'), `${p}.brand_colors.highlight_color`, c.highlight),
        field(id('tertiary'), `${p}.brand_colors.tertiary_color`, c.tertiary),
        field(id('titles'), `${p}.brand_colors.titles_text_color`, c.titles),
        field(id('body'), `${p}.brand_colors.body_text_color`, c.body),
      ],
    },
    {
      slug: `${p}.surfaces`,
      fields: [
        field(id('background'), `${p}.surfaces.background_color`, c.background),
        field(id('surface'), `${p}.surfaces.surface_color`, c.surface),
        field(id('card'), `${p}.surfaces.card_color`, c.card),
      ],
    },
    {
      slug: `${p}.text_interaction`,
      fields: [
        field(id('text'), `${p}.text_interaction.text_primary`, c.text),
        field(id('textSecondary'), `${p}.text_interaction.text_secondary`, c.textSecondary),
        field(id('border'), `${p}.text_interaction.border_color`, c.border),
      ],
    },
  ]
}

const FONT_CHOICES = ['Inter', 'Sora', 'Roboto', 'Poppins', 'Poppins, Sora', 'SF Pro', 'System UI']
const row = (name: string, family: string) => ({
  name,
  size: 16,
  sizeUnit: 'px',
  family,
  weight: '700',
  lineHeight: 1.5,
  letterSpacing: 0,
})
// The stock table: H1-H3 in one font, H4-H6 in another, everything else body text.
const HEADINGS = ['H1 (Title)', 'H2', 'H3', 'H4', 'H5', 'H6']
const BODY_ROWS = ['Paragraph', 'Body', 'List (li)', 'Small Text', 'Navigation']
const typoTable = (top: string, sub: string, body: string) =>
  JSON.stringify([
    ...HEADINGS.map((name, i) => row(name, i < 3 ? top : sub)),
    ...BODY_ROWS.map((name) => row(name, body)),
  ])
// The stock Custom Fonts list: the only font the live site loads.
const STOCK_CUSTOM_FONTS = [
  {
    type: 'google',
    name: 'Inter',
    src: 'https://fonts.googleapis.com/css2?family=Inter:wght@300..800',
  },
]

// Mirrors the real pane: one `typo_table` per device (+ the Custom Fonts repeater).
function typographyPane(lockedBy: string | null, kind: 'tables' | 'empty' | 'no-custom-fonts') {
  const table = (id: string, device: string) => ({
    ...field(
      id,
      `webapp.typography.${device}.typography_scale.typography_scale`,
      typoTable('Sora', 'Poppins', 'Inter'),
      lockedBy
    ),
    input_type: 'typo_table',
    options: JSON.stringify({ choices: FONT_CHOICES }),
  })
  return {
    id: 'typography',
    type_id: 'type2',
    groups: [
      ...(kind === 'no-custom-fonts'
        ? []
        : [
            {
              slug: 'webapp.typography.custom_fonts',
              fields: [
                {
                  ...field(
                    't0',
                    'webapp.typography.custom_fonts.custom_fonts',
                    JSON.stringify(STOCK_CUSTOM_FONTS)
                  ),
                  input_type: 'fonts',
                  options: null,
                },
              ],
            },
          ]),
      ...(kind === 'empty'
        ? []
        : [
            {
              slug: 'webapp.typography.desktop.typography_scale',
              fields: [table('t1', 'desktop')],
            },
            {
              slug: 'webapp.typography.mobile_v.typography_scale',
              fields: [table('t2', 'mobile_v')],
            },
          ]),
    ],
  }
}

// The Buttons pane: only the primary button's text colour matters here (the `background_color`
// next to it proves the view picks the field by its exact slug).
function buttonsPane(text: { light: string; dark: string }) {
  const group = (mode: 'light' | 'dark', n: number) => ({
    slug: `webapp.buttons.${mode}.primary_button`,
    fields: [
      field(`b${n}`, `webapp.buttons.${mode}.primary_button.background_color`, '#0a66f0'),
      field(`b${n + 1}`, `webapp.buttons.${mode}.primary_button.text_color`, text[mode]),
    ],
  })
  return { id: 'buttons', type_id: 'type3', groups: [group('dark', 1), group('light', 3)] }
}

interface SchemaOptions {
  lockedBy?: string | null
  updatedAt?: string | null
  /** 'none': no typography pane at all; 'empty': no typography table in it. */
  typography?: 'tables' | 'none' | 'empty' | 'no-custom-fonts'
  /** Published primary-button text colour per mode; false: the schema has no Buttons pane. */
  buttonText?: { light: string; dark: string } | false
  light?: typeof LIGHT
}

function schema({
  lockedBy = null,
  updatedAt = null,
  typography = 'tables',
  buttonText = { light: STOCK_BUTTON_TEXT, dark: STOCK_BUTTON_TEXT },
  light = LIGHT,
}: SchemaOptions = {}) {
  return {
    data: {
      data: {
        schema: [
          {
            id: 'branding',
            type_id: 'type1',
            groups: [
              ...brandingGroups('light', light, lockedBy, updatedAt),
              ...brandingGroups('dark', DARK, null, null),
            ],
          },
          ...(typography === 'none' ? [] : [typographyPane(lockedBy, typography)]),
          ...(buttonText ? [buttonsPane(buttonText)] : []),
        ],
      },
    },
  }
}

type Schema = ReturnType<typeof schema>

interface Served {
  /** The reply to GET /theme-engine/schema, or a function that gives it (each call asks again). */
  schema?: Schema | (() => Schema | Promise<Schema>)
  versions?: { id: string; created_at: string; field_count: number }[]
  projects?: { id: string; is_default?: boolean }[]
  /** Body of GET /brand-kit/:id/theme-colors, or the error it fails with. */
  kit?: unknown
}

// Routes the view's GETs; anything else (e.g. the provider's token fetch) gets an empty payload.
function serve({ schema: s = schema(), versions = [], projects, kit }: Served = {}) {
  get.mockImplementation((url: string) => {
    if (url.includes('/theme-engine/schema'))
      return Promise.resolve(typeof s === 'function' ? s() : s)
    if (url.includes('/theme-engine/versions'))
      return Promise.resolve({ data: { data: { versions } } })
    if (url === '/projects')
      return Promise.resolve({ data: { data: projects ?? [{ id: 'p1', is_default: true }] } })
    if (url.includes('/theme-colors'))
      return kit instanceof Error ? Promise.reject(kit) : Promise.resolve({ data: { data: kit } })
    return Promise.resolve({ data: { data: {} } })
  })
}

const schemaLoads = () =>
  get.mock.calls.filter(([url]) => String(url).includes('/theme-engine/schema')).length

// A promise the test settles by hand, to hold a request in flight.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const kitColours = (c: Record<string, string>) => ({
  primary: c.primary,
  secondary: c.secondary,
  accent: c.accent,
  highlight: c.highlight,
  background: c.background,
  text: c.text,
})

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } })
const publishButton = () => screen.getByRole('button', { name: /publish theme/i })
const toasted = (title: string) =>
  waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title })))

describe('SimpleThemeView', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    loadFont.mockReset()
    toast.mockReset()
    bundle.broken = false
    window.localStorage.clear()
    serve()
  })
  // A spy made inside a test never outlives it, even when the test fails half-way.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps Publish disabled until a colour changes, then posts every branding field', async () => {
    post.mockResolvedValue({ data: { success: true } })
    render(<SimpleThemeView />)

    const publish = await screen.findByRole('button', { name: /publish theme/i })
    expect(publish).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#ff0000' } })
    expect(publish).toBeEnabled()
    fireEvent.click(publish)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const [url, body] = post.mock.calls[0]!
    expect(url).toBe('/theme-engine/values')
    expect(body.type_id).toBe('type1')
    expect(body.values).toHaveLength(BRANDING_FIELDS)
    expect(body.values.find((v: { field_id: string }) => v.field_id === 'f1').value).toBe('#ff0000')
    // a colour-only publish never touches the typography Type
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('shows the Brand Kit lock banner and blocks publishing when fields are locked', async () => {
    serve({ schema: schema({ lockedBy: 'template-engine' }) })
    render(<SimpleThemeView />)

    expect(
      await screen.findByText(/set automatically from your approved brand kit/i)
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Main colour')).toBeDisabled()
    expect(screen.getByLabelText('Highlight')).toBeDisabled()
    expect(screen.getByLabelText('Heading font')).toBeDisabled()
    expect(screen.getByRole('button', { name: /use my brand kit colours/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /publish theme/i })).toBeDisabled()
  })

  it('shows who controls the colours and when they were last published when unlocked', async () => {
    serve({ schema: schema({ updatedAt: '2026-10-24T07:00:00Z' }) })
    render(<SimpleThemeView />)

    expect(
      await screen.findByText(/you control these colours\. last published/i)
    ).toBeInTheDocument()
  })

  it('warns when text on the background is hard to read', async () => {
    render(<SimpleThemeView />)
    await screen.findByLabelText('Main colour')
    expect(screen.queryByTestId('contrast-warning')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Text'), { target: { value: '#f3f3f8' } })
    expect(await screen.findByTestId('contrast-warning')).toHaveTextContent(
      /text on the page background/i
    )
  })

  describe('button text on the main colour', () => {
    // Publish leaves the primary button's text colour alone (it is not a branding field), so
    // the site keeps pairing the PUBLISHED text with whatever Main colour is published.
    it('warns when the published button text cannot be read on the main colour, and says where to fix it', async () => {
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
      // the stock dark theme (white on #7468f3, 4.2:1) is not worth a warning
      expect(screen.queryByTestId('contrast-warning')).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#38bdf8' } })

      const warning = await screen.findByTestId('contrast-warning')
      expect(warning).toHaveTextContent(
        /button text on the main colour is hard to read \(contrast 2\.1:1, aim for 3:1 or more\)/i
      )
      expect(warning).toHaveTextContent(/button text colour in advanced, under buttons/i)
    })

    it('goes by the text published for the mode being shown', async () => {
      // dark text on the light mode's dark main colour; white on the dark mode's
      serve({ schema: schema({ buttonText: { light: '#111111', dark: '#ffffff' } }) })
      render(<SimpleThemeView />)

      expect(await screen.findByTestId('contrast-warning')).toHaveTextContent(
        /button text on the main colour/i
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
      expect(screen.queryByTestId('contrast-warning')).not.toBeInTheDocument()
    })

    it('says nothing about it when the schema has no Buttons pane', async () => {
      serve({ schema: schema({ buttonText: false }) })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))

      fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#38bdf8' } })

      expect(screen.queryByTestId('contrast-warning')).not.toBeInTheDocument()
    })

    it.each(['Ocean', 'Forest', 'Sunset', 'Slate'])(
      'is not raised by the %s look in either mode',
      async (name) => {
        render(<SimpleThemeView />)
        await screen.findByLabelText('Main colour')
        for (const mode of ['Light', 'Dark']) {
          fireEvent.click(screen.getByRole('button', { name: mode }))
          fireEvent.click(screen.getByRole('button', { name }))
          expect(
            screen.queryByTestId('contrast-warning'),
            `${name} ${mode}`
          ).not.toBeInTheDocument()
        }
      }
    )
  })

  describe('Take over', () => {
    const takeOver = () => screen.getByRole('button', { name: /take over to edit/i })

    it('releases the lock on the route the backend serves, re-reads the theme and unlocks the view', async () => {
      serve({ schema: schema({ lockedBy: 'template-engine' }) })
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)
      await screen.findByText(/set automatically from your approved brand kit/i)
      expect(screen.getByLabelText('Main colour')).toBeDisabled()
      expect(schemaLoads()).toBe(1)
      // once the lock is released the server reports the fields as free
      post.mockImplementation(async () => {
        serve({ schema: schema() })
        return { data: { success: true } }
      })

      fireEvent.click(takeOver())

      // `locks` (plural): the one release route the backend registers
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith('/theme-engine/locks/release', { platform: 'webapp' })
      )
      await toasted('Taken over')
      expect(schemaLoads()).toBe(2)
      expect(await screen.findByText(/you control these colours/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Main colour')).toBeEnabled()
      expect(screen.queryByRole('button', { name: /take over to edit/i })).not.toBeInTheDocument()
    })

    it.each([403, 500])(
      'stays locked and says so when the lock cannot be released (HTTP %s)',
      async (status) => {
        serve({ schema: schema({ lockedBy: 'template-engine' }) })
        post.mockRejectedValue(httpError(status))
        render(<SimpleThemeView />)
        await screen.findByText(/set automatically from your approved brand kit/i)

        fireEvent.click(takeOver())

        await toasted('Take over failed')
        expect(
          screen.getByText(/set automatically from your approved brand kit/i)
        ).toBeInTheDocument()
        expect(screen.getByLabelText('Main colour')).toBeDisabled()
        // and the button is usable again for another try
        await waitFor(() => expect(takeOver()).toBeEnabled())
        expect(schemaLoads()).toBe(1)
      }
    )
  })

  describe('history', () => {
    const version = { id: 'v9', created_at: '2026-10-24T07:00:00Z', field_count: BRANDING_FIELDS }

    it('lists earlier versions and restores the latest with Undo last colour change', async () => {
      serve({ versions: [version] })
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)

      const undo = await screen.findByRole('button', { name: /undo last colour change/i })
      await waitFor(() => expect(undo).toBeEnabled())
      fireEvent.click(undo)

      await waitFor(() => expect(post).toHaveBeenCalledWith('/theme-engine/versions/v9/restore'))
    })

    it('is not "undo last publish": an undo is itself the last colour change, so a second click puts the colours back', async () => {
      // The backend saves the state a restore replaces as a new, newest version.
      const undone = { id: 'v10', created_at: '2026-10-24T07:05:00Z', field_count: BRANDING_FIELDS }
      serve({ versions: [version] })
      post.mockImplementation(async () => {
        serve({ versions: [undone, version] })
        return { data: { success: true } }
      })
      render(<SimpleThemeView />)
      const undo = () => screen.getByRole('button', { name: /undo last colour change/i })
      await waitFor(() => expect(undo()).toBeEnabled())

      fireEvent.click(undo())
      await waitFor(() =>
        expect(post).toHaveBeenLastCalledWith('/theme-engine/versions/v9/restore')
      )
      await toasted('Restored')
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2)
      )

      fireEvent.click(undo())
      await waitFor(() =>
        expect(post).toHaveBeenLastCalledWith('/theme-engine/versions/v10/restore')
      )
    })

    it('is the colour history: scoped to the branding Type and labelled as colours only', async () => {
      serve({ versions: [version] })
      render(<SimpleThemeView />)

      expect(await screen.findByText('Colour history')).toBeInTheDocument()
      expect(screen.getByText(/font changes are not kept in this list/i)).toBeInTheDocument()
      await waitFor(() =>
        expect(get).toHaveBeenCalledWith('/theme-engine/versions', {
          params: { platform: 'webapp', type_id: 'type1' },
        })
      )
      // never asked for the typography Type's versions
      expect(get.mock.calls.filter(([u]) => String(u).includes('/versions'))).toHaveLength(1)
    })
  })

  it('re-reads the schema when it is shown again, so Publish never overwrites newer Advanced edits', async () => {
    const { rerender } = render(<SimpleThemeView />)
    await screen.findByLabelText('Main colour')
    expect(schemaLoads()).toBe(1)

    rerender(<p>Advanced view</p>)
    rerender(<SimpleThemeView />)

    await waitFor(() => expect(schemaLoads()).toBe(2))
  })

  it('keeps Publish off while that re-read is in flight, then publishes what Advanced saved', async () => {
    const { rerender } = render(<SimpleThemeView />)
    await screen.findByLabelText('Main colour')
    rerender(<p>Advanced view</p>)

    // Advanced saved a new Second colour meanwhile, and the re-read is slow
    const reread = deferred<Schema>()
    serve({ schema: () => reread.promise })
    post.mockResolvedValue({ data: { success: true } })
    rerender(<SimpleThemeView />)

    // the copy from before is on screen at once, and can be edited, but not published yet:
    // it would overwrite the Second colour with the old value
    fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#ff0000' } })
    expect(screen.getByText('You have unpublished changes.')).toBeInTheDocument()
    expect(publishButton()).toBeDisabled()

    reread.resolve(schema({ light: { ...LIGHT, secondary: '#00ff00' } }))
    await waitFor(() => expect(publishButton()).toBeEnabled())
    expect(screen.getByLabelText('Second colour')).toHaveValue('#00ff00')
    fireEvent.click(publishButton())

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const values = post.mock.calls[0]![1].values as { field_id: string; value: string }[]
    const valueOf = (id: string) => values.find((v) => v.field_id === id)!.value
    expect(valueOf('f2')).toBe('#00ff00') // what Advanced saved, not the old copy
    expect(valueOf('f1')).toBe('#ff0000') // and the draft survived the re-read
  })

  describe('after Publish', () => {
    it('keeps showing the draft until the published values are back, so the colours never flash back', async () => {
      // the server has the new colour from the moment the POST lands; the re-read is slow
      let published: typeof LIGHT = LIGHT
      const reread = deferred<Schema>()
      let loads = 0
      serve({ schema: () => (++loads === 1 ? schema({ light: published }) : reread.promise) })
      post.mockImplementation(async () => {
        published = { ...LIGHT, primary: '#ff0000' }
        return { data: { success: true } }
      })
      render(<SimpleThemeView />)
      fireEvent.change(await screen.findByLabelText('Main colour'), {
        target: { value: '#ff0000' },
      })

      fireEvent.click(publishButton())
      await waitFor(() => expect(loads).toBe(2))

      // saved, but not re-read: the draft is still what the inputs and the preview show
      expect(post).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Main colour')).toHaveValue('#ff0000')
      expect(
        screen
          .getByTestId('simple-theme-preview')
          .style.getPropertyValue('--branding_brand_colors_primary_color')
      ).toBe('#ff0000')
      expect(screen.getByRole('button', { name: /publishing/i })).toBeDisabled()
      expect(screen.getByText('You have unpublished changes.')).toBeInTheDocument()
      expect(toast).not.toHaveBeenCalled()

      reread.resolve(schema({ light: published }))
      expect(await screen.findByText('Everything is published.')).toBeInTheDocument()
      await toasted('Published')
      expect(screen.getByLabelText('Main colour')).toHaveValue('#ff0000')
    })

    it('does the same when the colours went out and the fonts did not', async () => {
      let published: typeof LIGHT = LIGHT
      const reread = deferred<Schema>()
      let loads = 0
      serve({ schema: () => (++loads === 1 ? schema({ light: published }) : reread.promise) })
      post.mockImplementationOnce(async () => {
        published = { ...LIGHT, primary: '#ff0000' }
        return { data: { success: true } }
      })
      post.mockRejectedValueOnce(httpError(422))
      render(<SimpleThemeView />)
      fireEvent.change(await screen.findByLabelText('Main colour'), {
        target: { value: '#ff0000' },
      })
      fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'Roboto' } })

      fireEvent.click(publishButton())

      await toasted('Fonts not published')
      await waitFor(() => expect(loads).toBe(2))
      expect(screen.getByLabelText('Main colour')).toHaveValue('#ff0000')

      reread.resolve(schema({ light: published }))
      await waitFor(() => expect(publishButton()).toBeEnabled())
      expect(screen.getByLabelText('Main colour')).toHaveValue('#ff0000')
      // the font pick is still a draft
      expect(screen.getByLabelText('Heading font')).toHaveValue('Roboto')
      expect(screen.getByText('You have unpublished changes.')).toBeInTheDocument()
    })
  })

  describe('preview', () => {
    it('hands the unsaved draft to the preview as CSS variables and leaves the global theme alone', async () => {
      render(<SimpleThemeView />)
      const preview = await screen.findByTestId('simple-theme-preview')
      // the lazy block chunk has resolved, for the first pack
      expect(await screen.findByTestId('preview-blocks')).toHaveTextContent(CONSTRUCTION)

      fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#ff0000' } })
      fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: '#00ff00' } })
      fireEvent.change(screen.getByLabelText('Page background'), { target: { value: '#101010' } })
      fireEvent.change(screen.getByLabelText('Text'), { target: { value: '#eeeeee' } })

      const v = (name: string) => preview.style.getPropertyValue(name)
      expect(v('--branding_brand_colors_primary_color')).toBe('#ff0000')
      expect(v('--branding_brand_colors_highlight_color')).toBe('#00ff00')
      expect(v('--branding_surfaces_background_color')).toBe('#101010')
      expect(v('--branding_text_interaction_text_primary')).toBe('#eeeeee')
      // a token the quick colours skip keeps its published webapp value
      expect(v('--branding_brand_colors_tertiary_color')).toBe('#0891b2')
      expect(preview.style.backgroundColor).toBe('rgb(16, 16, 16)')
      expect(preview.style.color).toBe('rgb(238, 238, 238)')

      // nothing leaked onto the page the admin itself runs on
      expect(
        document.documentElement.style.getPropertyValue('--branding_brand_colors_primary_color')
      ).toBe('')
      expect(post).not.toHaveBeenCalled()
    })

    it('shows everything Publish leaves alone exactly as published, whatever the draft says', async () => {
      // Publish saves the six colours and the rest as loaded (and never the button text), so a
      // value the preview worked out from the draft would be one the site never gets.
      serve({ schema: schema({ buttonText: { light: '#111111', dark: '#ffffff' } }) })
      render(<SimpleThemeView />)
      const preview = await screen.findByTestId('simple-theme-preview')
      const v = (name: string) => preview.style.getPropertyValue(name)
      const PUBLISHED = {
        '--branding_brand_colors_tertiary_color': LIGHT.tertiary,
        '--branding_brand_colors_titles_text_color': LIGHT.titles,
        '--branding_brand_colors_body_text_color': LIGHT.body,
        '--branding_surfaces_surface_color': LIGHT.surface,
        '--branding_surfaces_card_color': LIGHT.card,
        '--branding_text_interaction_text_secondary': LIGHT.textSecondary,
        '--branding_text_interaction_border_color': LIGHT.border,
        '--buttons_primary_button_text_color': '#111111',
      }
      for (const [name, value] of Object.entries(PUBLISHED)) expect(v(name), name).toBe(value)

      // a dark page, light text and a light main colour: nothing above may follow
      for (const [label, value] of [
        ['Main colour', '#38bdf8'],
        ['Second colour', '#22d3ee'],
        ['Accent', '#a78bfa'],
        ['Highlight', '#fbbf24'],
        ['Page background', '#0b1220'],
        ['Text', '#e2e8f0'],
      ] as const) {
        fireEvent.change(screen.getByLabelText(label), { target: { value } })
      }

      expect(v('--branding_brand_colors_primary_color')).toBe('#38bdf8')
      for (const [name, value] of Object.entries(PUBLISHED)) expect(v(name), name).toBe(value)
    })

    it('shows, for every branding field, the very value Publish sends for it', async () => {
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)
      const preview = await screen.findByTestId('simple-theme-preview')
      for (const [label, value] of [
        ['Main colour', '#38bdf8'],
        ['Second colour', '#22d3ee'],
        ['Accent', '#a78bfa'],
        ['Highlight', '#fbbf24'],
        ['Page background', '#0b1220'],
        ['Text', '#e2e8f0'],
      ] as const) {
        fireEvent.change(screen.getByLabelText(label), { target: { value } })
      }
      // what the card shows for each light field now, before Publish re-reads the theme
      const slugOf = Object.fromEntries(
        schema().data.data.schema[0]!.groups.flatMap((g) => g.fields.map((f) => [f.id, f.slug]))
      ) as Record<string, string>
      const shown = Object.fromEntries(
        Object.values(slugOf)
          .filter((slug) => slug.startsWith('webapp.branding.light.'))
          .map((slug) => [slug, preview.style.getPropertyValue(tokenVar(slug))])
      )

      fireEvent.click(publishButton())
      await waitFor(() => expect(post).toHaveBeenCalledTimes(1))

      const sent = post.mock.calls[0]![1].values as { field_id: string; value: string }[]
      expect(sent).toHaveLength(BRANDING_FIELDS)
      const light = sent.filter((v) => slugOf[v.field_id]!.startsWith('webapp.branding.light.'))
      expect(light).toHaveLength(BRANDING_FIELDS / 2)
      for (const { field_id, value } of light) {
        expect(shown[slugOf[field_id]!], slugOf[field_id]).toBe(value)
      }
    })

    it('previews the dark palette when Dark is picked', async () => {
      render(<SimpleThemeView />)
      const preview = await screen.findByTestId('simple-theme-preview')
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))

      expect(preview.style.getPropertyValue('--branding_brand_colors_primary_color')).toBe(
        '#7468f3'
      )
      expect(preview.style.getPropertyValue('--branding_brand_colors_tertiary_color')).toBe(
        '#64d2ff'
      )
    })

    it('previews the picked heading and body fonts', async () => {
      render(<SimpleThemeView />)
      const preview = await screen.findByTestId('simple-theme-preview')
      const family = (alias: string) => preview.style.getPropertyValue(`--th-typo-${alias}-family`)
      // before any pick the preview shows the published table row by row, mixed headings included
      expect(family('h1')).toBe('"Sora"')
      expect(family('h4')).toBe('"Poppins"')
      expect(family('body')).toBe('"Inter"')
      // nothing is fetched until the user actually picks a font
      expect(loadFont).not.toHaveBeenCalled()

      fireEvent.change(screen.getByLabelText('Heading font'), {
        target: { value: 'Poppins, Sora' },
      })
      fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'Roboto' } })

      // one pick covers every heading (H4-H6 were Poppins) or every body style
      for (const alias of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        expect(family(alias)).toBe('"Poppins", "Sora"')
      }
      for (const alias of ['paragraph', 'body', 'list', 'small', 'nav']) {
        expect(family(alias)).toBe('"Roboto"')
      }
      // a "Poppins, Sora" stack loads each family it names, so the preview shows them for real
      expect(loadFont.mock.calls.map(([name]) => name)).toEqual(['Poppins', 'Sora', 'Roboto'])
    })

    it('lets the user pick which pack to preview and remembers the choice', async () => {
      const first = render(<SimpleThemeView />)
      expect(await screen.findByTestId('preview-blocks')).toHaveTextContent(CONSTRUCTION)
      expect(screen.getByRole('button', { name: 'Construction' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )

      fireEvent.click(screen.getByRole('button', { name: 'General' }))
      expect(await screen.findByText(GENERAL)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(window.localStorage.getItem(LS_PACK)).toBe('general')
      expect(screen.getByRole('button', { name: 'Medical' })).toBeInTheDocument()

      first.unmount()
      render(<SimpleThemeView />)
      expect(await screen.findByText(GENERAL)).toBeInTheDocument()
    })

    it('falls back to the first pack when the remembered one is unknown or storage throws', async () => {
      window.localStorage.setItem(LS_PACK, 'retired-pack')
      const first = render(<SimpleThemeView />)
      expect(await screen.findByTestId('preview-blocks')).toHaveTextContent(CONSTRUCTION)
      first.unmount()

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked')
      })
      render(<SimpleThemeView />)
      expect(await screen.findByTestId('preview-blocks')).toHaveTextContent(CONSTRUCTION)
    })

    it('shows the simple mock instead of crashing when the block bundle cannot render', async () => {
      // The throw is expected: keep React's and jsdom's reports of it out of the test log.
      // (console.error is restored by afterEach; the listener must not outlive the test either.)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const expected = (e: ErrorEvent) => e.preventDefault()
      window.addEventListener('error', expected)
      try {
        bundle.broken = true
        render(<SimpleThemeView />)

        expect(await screen.findByTestId('simple-theme-preview-mock')).toBeInTheDocument()
        expect(screen.getByText('Welcome to your site')).toBeInTheDocument()
        expect(screen.queryByTestId('preview-blocks')).not.toBeInTheDocument()
        // the rest of the view is still alive
        expect(screen.getByLabelText('Main colour')).toBeEnabled()
      } finally {
        window.removeEventListener('error', expected)
      }
    })

    it('has the stand-in put the published button text on the main colour, not one worked out from the draft', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const expected = (e: ErrorEvent) => e.preventDefault()
      window.addEventListener('error', expected)
      try {
        bundle.broken = true
        serve({ schema: schema({ buttonText: { light: '#111111', dark: '#ffffff' } }) })
        render(<SimpleThemeView />)
        const button = await screen.findByText('Primary button')
        // white on #2119b3 would be the draft's pick; the site gets the published token
        fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#fde047' } })

        expect(button.style.background).toContain('rgb(253, 224, 71)')
        expect(button.getAttribute('style')).toContain('var(--buttons_primary_button_text_color')
        expect(
          screen
            .getByTestId('simple-theme-preview')
            .style.getPropertyValue('--buttons_primary_button_text_color')
        ).toBe('#111111')
      } finally {
        window.removeEventListener('error', expected)
      }
    })
  })

  describe('Highlight colour', () => {
    it('is one of six pickers and publishes with the pane', async () => {
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')
      for (const label of [
        'Main colour',
        'Second colour',
        'Accent',
        'Highlight',
        'Page background',
        'Text',
      ]) {
        expect(screen.getByLabelText(label)).toBeInTheDocument()
      }
      expect(screen.getByLabelText('Highlight')).toHaveValue('#f9941f')

      fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: '#00ff88' } })
      fireEvent.click(publishButton())

      await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
      const body = post.mock.calls[0]![1]
      expect(body.type_id).toBe('type1')
      expect(body.values.find((v: { field_id: string }) => v.field_id === 'f6').value).toBe(
        '#00ff88'
      )
    })

    it('is part of every preset', async () => {
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')
      fireEvent.click(screen.getByRole('button', { name: 'Forest' }))

      expect(screen.getByLabelText('Main colour')).toHaveValue('#15803d')
      expect(screen.getByLabelText('Highlight')).toHaveValue('#ea580c')
      expect(publishButton()).toBeEnabled()
    })
  })

  describe('heading and body fonts', () => {
    it.each([
      ['there is no typography pane', 'none'],
      ['the typography pane has no typography table', 'empty'],
    ] as const)('hides the selects when %s', async (_name, typography) => {
      serve({ schema: schema({ typography }) })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      expect(screen.queryByLabelText('Heading font')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Body font')).not.toBeInTheDocument()
      // and the rest of the view still works
      fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#ff0000' } })
      expect(publishButton()).toBeEnabled()
    })

    it('offers the choices from the field itself and starts on what the table uses today', async () => {
      render(<SimpleThemeView />)
      const heading = await screen.findByLabelText('Heading font')

      expect(heading).toHaveValue('Sora')
      expect(screen.getByLabelText('Body font')).toHaveValue('Inter')
      expect(Array.from((heading as HTMLSelectElement).options).map((o) => o.value)).toEqual(
        FONT_CHOICES
      )
    })

    it('publishes a font change to the typography Type only, rewriting every device table', async () => {
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)

      fireEvent.change(await screen.findByLabelText('Heading font'), {
        target: { value: 'Roboto' },
      })
      fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'Sora' } })
      fireEvent.click(publishButton())

      await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
      const [url, body] = post.mock.calls[0]!
      expect(url).toBe('/theme-engine/values')
      expect(body).toMatchObject({ platform: 'webapp', type_id: 'type2' })
      // both device tables, then the Custom Fonts list (see the next tests)
      expect(body.values.map((v: { field_id: string }) => v.field_id)).toEqual(['t1', 't2', 't0'])
      for (const { value } of body.values.slice(0, 2)) {
        const rows = JSON.parse(value) as { name: string; family: string; size: number }[]
        expect(rows.map((r) => [r.name, r.family])).toEqual([
          ...HEADINGS.map((name) => [name, 'Roboto']),
          ...BODY_ROWS.map((name) => [name, 'Sora']),
        ])
        expect(rows[0]).toMatchObject({ size: 16, weight: '700', lineHeight: 1.5 })
      }
      expect(await screen.findByText('Everything is published.')).toBeInTheDocument()
    })

    describe('Custom Fonts: the only fonts the live site loads', () => {
      const customFontsSent = async () => {
        await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
        const values = post.mock.calls[0]![1].values as { field_id: string; value: string }[]
        const custom = values.find((v) => v.field_id === 't0')
        return { values, custom: custom && JSON.parse(custom.value) }
      }

      it('lists every picked family in the same request, so it is not just the preview that shows it', async () => {
        post.mockResolvedValue({ data: { success: true } })
        render(<SimpleThemeView />)

        fireEvent.change(await screen.findByLabelText('Heading font'), {
          target: { value: 'Poppins, Sora' },
        })
        fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'Roboto' } })
        fireEvent.click(publishButton())

        const { custom } = await customFontsSent()
        // Inter stays; a "Poppins, Sora" stack is two families, one row each
        expect(custom).toEqual([
          ...STOCK_CUSTOM_FONTS,
          { type: 'google', name: 'Poppins', src: googleFontUrl('Poppins') },
          { type: 'google', name: 'Sora', src: googleFontUrl('Sora') },
          { type: 'google', name: 'Roboto', src: googleFontUrl('Roboto') },
        ])
      })

      it('leaves the list alone when the family is already in it', async () => {
        post.mockResolvedValue({ data: { success: true } })
        render(<SimpleThemeView />)

        fireEvent.change(await screen.findByLabelText('Heading font'), {
          target: { value: 'Inter' },
        })
        fireEvent.click(publishButton())

        const { values, custom } = await customFontsSent()
        expect(custom).toBeUndefined()
        expect(values.map((v) => v.field_id)).toEqual(['t1', 't2'])
      })

      it('adds nothing for a font the operating system provides', async () => {
        post.mockResolvedValue({ data: { success: true } })
        render(<SimpleThemeView />)

        fireEvent.change(await screen.findByLabelText('Heading font'), {
          target: { value: 'SF Pro' },
        })
        fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'System UI' } })
        fireEvent.click(publishButton())

        const { values, custom } = await customFontsSent()
        expect(custom).toBeUndefined()
        expect(values.map((v) => v.field_id)).toEqual(['t1', 't2'])
      })

      it('still publishes the fonts when the pane has no Custom Fonts field', async () => {
        serve({ schema: schema({ typography: 'no-custom-fonts' }) })
        post.mockResolvedValue({ data: { success: true } })
        render(<SimpleThemeView />)

        fireEvent.change(await screen.findByLabelText('Heading font'), {
          target: { value: 'Roboto' },
        })
        fireEvent.click(publishButton())

        const { values, custom } = await customFontsSent()
        expect(custom).toBeUndefined()
        expect(values.map((v) => v.field_id)).toEqual(['t1', 't2'])
      })

      it('names the stylesheet the preview loads for the same family', async () => {
        // Preview and live site must fetch one and the same font: compare with the real loader.
        const { loadGoogleFont } =
          await vi.importActual<typeof import('@/lib/load-google-font')>('@/lib/load-google-font')
        loadGoogleFont('Source Sans 3')
        const link = document.head.querySelector('link[href*="Source+Sans+3"]')
        try {
          expect(link?.getAttribute('href')).toBe(googleFontUrl('Source Sans 3'))
        } finally {
          link?.remove()
        }
      })
    })

    it('is not a change when the picked font is the one already in use', async () => {
      render(<SimpleThemeView />)
      const body = await screen.findByLabelText('Body font')

      fireEvent.change(body, { target: { value: 'Roboto' } })
      expect(publishButton()).toBeEnabled()
      fireEvent.change(body, { target: { value: 'Inter' } })
      expect(publishButton()).toBeDisabled()
      expect(screen.getByText('Everything is published.')).toBeInTheDocument()
    })

    it('posts colours first, then fonts, one after the other', async () => {
      let finishColours: () => void = () => {}
      post.mockImplementationOnce(
        () => new Promise((resolve) => (finishColours = () => resolve({ data: { success: true } })))
      )
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)

      fireEvent.change(await screen.findByLabelText('Main colour'), {
        target: { value: '#ff0000' },
      })
      fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'Roboto' } })
      fireEvent.click(publishButton())

      await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
      expect(post.mock.calls[0]![1].type_id).toBe('type1')
      // the font save waits for the colour save
      await new Promise((r) => setTimeout(r, 20))
      expect(post).toHaveBeenCalledTimes(1)

      finishColours()
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
      expect(post.mock.calls[1]![1].type_id).toBe('type2')
      expect(await screen.findByText('Everything is published.')).toBeInTheDocument()
    })

    it('keeps the font draft, and says so, when the colours went out but the fonts did not', async () => {
      post.mockResolvedValueOnce({ data: { success: true } })
      post.mockRejectedValueOnce(httpError(422))
      post.mockResolvedValue({ data: { success: true } })
      render(<SimpleThemeView />)

      fireEvent.change(await screen.findByLabelText('Main colour'), {
        target: { value: '#ff0000' },
      })
      fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'Roboto' } })
      fireEvent.click(publishButton())

      await toasted('Fonts not published')
      expect(post).toHaveBeenCalledTimes(2)
      // the published colours are no longer a draft; the font pick still is
      expect(screen.getByLabelText('Heading font')).toHaveValue('Roboto')
      expect(screen.getByText('You have unpublished changes.')).toBeInTheDocument()

      // Publish again sends only the fonts (once the re-read after the failed attempt is done)
      await waitFor(() => expect(publishButton()).toBeEnabled())
      fireEvent.click(publishButton())
      await waitFor(() => expect(post).toHaveBeenCalledTimes(3))
      expect(post.mock.calls[2]![1].type_id).toBe('type2')
    })

    it('reports a plain failure when nothing went out', async () => {
      post.mockRejectedValue(httpError(500))
      render(<SimpleThemeView />)

      fireEvent.change(await screen.findByLabelText('Main colour'), {
        target: { value: '#ff0000' },
      })
      fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'Roboto' } })
      fireEvent.click(publishButton())

      await toasted('Publish failed')
      // fonts are not attempted after the colours failed; both drafts stay
      expect(post).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Main colour')).toHaveValue('#ff0000')
      expect(screen.getByLabelText('Heading font')).toHaveValue('Roboto')
    })

    it('Discard drops font picks along with colour edits', async () => {
      render(<SimpleThemeView />)
      fireEvent.change(await screen.findByLabelText('Heading font'), {
        target: { value: 'Roboto' },
      })
      fireEvent.change(screen.getByLabelText('Main colour'), { target: { value: '#ff0000' } })

      fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

      expect(screen.getByLabelText('Heading font')).toHaveValue('Sora')
      expect(screen.getByLabelText('Main colour')).toHaveValue('#2119b3')
      expect(publishButton()).toBeDisabled()
    })
  })

  describe('Use my Brand Kit colours', () => {
    const kit = {
      approved: true,
      kitId: 'k1',
      light: kitColours({
        primary: '#112233',
        secondary: '#223344',
        accent: '#334455',
        highlight: '#445566',
        background: '#fefefe',
        text: '#010203',
      }),
      dark: kitColours({
        primary: '#aabbcc',
        secondary: '#bbccdd',
        accent: '#ccddee',
        highlight: '#ddeeff',
        background: '#0a0a0a',
        text: '#f0f0f0',
      }),
    }
    const brandKitButton = () => screen.getByRole('button', { name: /use my brand kit colours/i })

    it('loads the current mode into the draft without publishing anything', async () => {
      serve({ kit })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')
      expect(publishButton()).toBeDisabled()

      fireEvent.click(brandKitButton())

      await waitFor(() => expect(screen.getByLabelText('Main colour')).toHaveValue('#112233'))
      expect(screen.getByLabelText('Second colour')).toHaveValue('#223344')
      expect(screen.getByLabelText('Accent')).toHaveValue('#334455')
      expect(screen.getByLabelText('Highlight')).toHaveValue('#445566')
      expect(screen.getByLabelText('Page background')).toHaveValue('#fefefe')
      expect(screen.getByLabelText('Text')).toHaveValue('#010203')
      expect(get).toHaveBeenCalledWith('/brand-kit/p1/theme-colors')
      expect(screen.getByTestId('brand-kit-note')).toHaveTextContent(
        /loaded your brand kit colours\. check the preview, then publish/i
      )
      // a draft: the preview follows, nothing is saved, Publish is still the user's call
      expect(
        screen
          .getByTestId('simple-theme-preview')
          .style.getPropertyValue('--branding_brand_colors_primary_color')
      ).toBe('#112233')
      expect(post).not.toHaveBeenCalled()
      expect(publishButton()).toBeEnabled()

      // the dark palette was not touched while Light was showing
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
      expect(screen.getByLabelText('Main colour')).toHaveValue('#7468f3')
    })

    it('uses the dark palette when Dark is showing', async () => {
      serve({ kit })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')
      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))

      fireEvent.click(brandKitButton())

      await waitFor(() => expect(screen.getByLabelText('Main colour')).toHaveValue('#aabbcc'))
      expect(screen.getByLabelText('Page background')).toHaveValue('#0a0a0a')
      fireEvent.click(screen.getByRole('button', { name: 'Light' }))
      expect(screen.getByLabelText('Main colour')).toHaveValue('#2119b3')
    })

    it('can be undone with Discard, and says when the kit is not approved yet', async () => {
      serve({ kit: { ...kit, approved: false } })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      fireEvent.click(brandKitButton())
      await waitFor(() => expect(screen.getByLabelText('Main colour')).toHaveValue('#112233'))
      expect(screen.getByTestId('brand-kit-note')).toHaveTextContent(/not approved yet/i)

      fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
      expect(screen.getByLabelText('Main colour')).toHaveValue('#2119b3')
    })

    it('ignores anything that is not a 6-digit hex', async () => {
      serve({
        kit: { approved: true, light: { ...kit.light, primary: 'rebeccapurple', accent: '#fff' } },
      })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      fireEvent.click(brandKitButton())

      await waitFor(() => expect(screen.getByLabelText('Second colour')).toHaveValue('#223344'))
      expect(screen.getByLabelText('Main colour')).toHaveValue('#2119b3')
      expect(screen.getByLabelText('Accent')).toHaveValue('#7c3aed')
    })

    it.each([404, 409])(
      'shows a gentle note on a %s and keeps the button usable',
      async (status) => {
        serve({ kit: httpError(status) })
        render(<SimpleThemeView />)
        await screen.findByLabelText('Main colour')

        fireEvent.click(brandKitButton())

        expect(await screen.findByTestId('brand-kit-note')).toHaveTextContent(
          /no colours yet\. finish its palette step/i
        )
        expect(brandKitButton()).toBeEnabled()
        expect(screen.getByLabelText('Main colour')).toHaveValue('#2119b3')
        expect(publishButton()).toBeDisabled()
        expect(post).not.toHaveBeenCalled()

        // and it really is usable: a second click asks again
        fireEvent.click(brandKitButton())
        await waitFor(() =>
          expect(get.mock.calls.filter(([u]) => String(u).includes('/theme-colors'))).toHaveLength(
            2
          )
        )
      }
    )

    it('shows a note when the Brand Kit cannot be reached', async () => {
      serve({ kit: new Error('Network Error') })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      fireEvent.click(brandKitButton())

      expect(await screen.findByTestId('brand-kit-note')).toHaveTextContent(
        /could not reach your brand kit/i
      )
      expect(brandKitButton()).toBeEnabled()
    })

    it('shows a note, and asks nothing else, when there is no project yet', async () => {
      serve({ projects: [] })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      fireEvent.click(brandKitButton())

      expect(await screen.findByTestId('brand-kit-note')).toHaveTextContent(/no project found/i)
      expect(get.mock.calls.some(([u]) => String(u).includes('/theme-colors'))).toBe(false)
      expect(brandKitButton()).toBeEnabled()
    })

    it('uses the default project when there are several', async () => {
      serve({
        kit,
        projects: [{ id: 'p-other' }, { id: 'p-default', is_default: true }],
      })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      fireEvent.click(brandKitButton())

      await waitFor(() => expect(get).toHaveBeenCalledWith('/brand-kit/p-default/theme-colors'))
    })

    it('says so when the kit has no colours for this mode', async () => {
      serve({ kit: { approved: true, light: {} } })
      render(<SimpleThemeView />)
      await screen.findByLabelText('Main colour')

      fireEvent.click(brandKitButton())

      expect(await screen.findByTestId('brand-kit-note')).toHaveTextContent(
        /no light colours to load yet/i
      )
      expect(publishButton()).toBeDisabled()
    })
  })
})
