/**
 * RTL regression tests for KDL-558 roadmap row 4a — WebsiteStage gets the
 * design prototype's "Brands" cards grid (one brand surface per card, click
 * to open) and, per the follow-up instruction, the "Web app" card opens the
 * prototype's Typography step (pick heading/body fonts) before the existing
 * assemble/skip flow. Only the "Web app" card is wired up — ship one card's
 * flow before adding the rest.
 */
import React from 'react'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WebsiteStage } from '@/app/admin/template-engine/_components/stages/WebsiteStage'
import type { TemplateEngineRun, BrandKit } from '@/admin/types/template-engine.types'

const { mockPatchTypography, mockUseBrandKit, mockCreateSite } = vi.hoisted(() => ({
  mockPatchTypography: vi.fn(),
  mockUseBrandKit: vi.fn(),
  mockCreateSite: vi.fn(),
}))

vi.mock('@/admin/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: vi.fn(), isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useSkipStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: mockUseBrandKit,
  usePatchTypography: () => ({ mutate: mockPatchTypography, isPending: false }),
  useCreateSite: () => ({ mutate: mockCreateSite, isPending: false }),
  useTemplateEngineRuns: () => ({ data: [], isLoading: false }),
}))

const surfaceState = vi.hoisted(() => ({ off: [] as string[] }))
vi.mock('@/app/admin/template-engine/_components/stages/NavPagesGrid', () => ({
  NavPagesGrid: ({ homeId }: { homeId?: string }) => (
    <div data-testid="nav-pages-grid">home:{homeId ?? 'none'}</div>
  ),
}))

vi.mock('@/admin/hooks/useModules', () => ({
  useModules: () => ({ isEnabled: (slug: string) => !surfaceState.off.includes(slug) }),
}))

vi.mock('@/components/shared/MediaPicker', () => ({
  MediaPicker: () => null,
}))

const BRAND_KIT: BrandKit = {
  id: 'kit-1',
  project_id: 'proj-1',
  status: 'inferred',
  logo_media_id: 'media-1',
  logo_raster_media_id: null,
  palette: null,
  contrast_report: null,
  typography: null,
  tone: null,
  approved_at: null,
}

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function makeRun(pageIds?: Record<string, string>): TemplateEngineRun {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    status: 'IN_PROGRESS',
    brandKitVersion: null,
    createdBy: 'user-1',
    createdAt: '2026-08-25T00:00:00Z',
    updatedAt: '2026-08-25T00:00:00Z',
    stages: [
      {
        id: 'stage-1',
        runId: 'run-1',
        stage: 'WEBSITE',
        status: pageIds ? 'DONE' : 'PENDING',
        errorCode: null,
        outputRef: pageIds ? { pageIds: Object.values(pageIds), pageKeyToId: pageIds } : null,
        startedAt: null,
        completedAt: null,
      },
    ],
  }
}

// WebsiteStage persists its step to localStorage and resumes from it on mount.
function resumeAt(
  webAppStep: 'typography' | 'fontSettings' | 'styles' | 'navigation' | 'assemble'
) {
  window.localStorage.setItem(
    'te-website-ui:proj-1',
    JSON.stringify({ openBrand: 'webapp', webAppStep })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mockUseBrandKit.mockReturnValue({ data: BRAND_KIT, isLoading: false })
})

describe('WebsiteStage — Brands cards grid (KDL-558)', () => {
  beforeEach(() => {
    surfaceState.off = []
  })

  it('lands on the Brands grid with the Web app card', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    expect(screen.getByText('Brands')).toBeInTheDocument()
    expect(screen.getByText('Web app')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Landing Pages/ })).toHaveAttribute(
      'href',
      '/admin/landing-pages'
    )
    expect(screen.getByRole('link', { name: /Collateral/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/projects\/.+\/collateral$/)
    )
    // Forms and the static export are inside the Web app, not cards of their own.
    expect(screen.queryByRole('link', { name: /^Forms/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Static website')).not.toBeInTheDocument()
    // No other brand cards yet — Admin app / Visiting card / etc. aren't wired up.
    expect(screen.queryByText('Admin app')).not.toBeInTheDocument()
    expect(screen.queryByText('Visiting card')).not.toBeInTheDocument()
    // The stage's own assemble/skip controls stay hidden until a card is opened.
    expect(screen.queryByRole('button', { name: /^run$/i })).not.toBeInTheDocument()
  })

  it('the Landing Pages card only shows when that module is enabled', () => {
    surfaceState.off = ['landing']
    renderWithQC(<WebsiteStage run={makeRun()} />)
    expect(screen.queryByRole('link', { name: /Landing Pages/ })).not.toBeInTheDocument()
    expect(screen.getByText('Web app')).toBeInTheDocument()
  })

  it('inside the Web app: its Forms and "Convert to Static Website" buttons', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))
    const tools = screen.getByTestId('webapp-tools')
    expect(within(tools).getByRole('link', { name: /Forms/ })).toHaveAttribute(
      'href',
      '/admin/forms'
    )
    expect(within(tools).getByRole('link', { name: /Convert to Static Website/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/admin\/static-website\?projectId=/)
    )
  })

  it('the Forms button needs the Forms module, the conversion does not', () => {
    surfaceState.off = ['forms']
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))
    const tools = screen.getByTestId('webapp-tools')
    expect(within(tools).queryByRole('link', { name: /Forms/ })).not.toBeInTheDocument()
    expect(
      within(tools).getByRole('link', { name: /Convert to Static Website/ })
    ).toBeInTheDocument()
  })

  it('has no placeholder buttons that do nothing; other things point at the page that owns them', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    // These were dead cards ("no flow yet"). Landing pages belong to the CMS, products to Settings.
    for (const name of ['Landing Page', 'Portfolio', 'Progressive Web App (PWA)']) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    }
    // Products are not a Settings entry any more: the cards here are the entry points.
    expect(screen.queryByRole('link', { name: /Settings > Products/ })).not.toBeInTheDocument()
  })

  it('opens the Web app flow (Typography step) on click, and Back returns to the grid', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    fireEvent.click(screen.getByText('Web app'))
    expect(screen.getByText(/pick the heading and body fonts/i)).toBeInTheDocument()
    expect(screen.queryByText('Brands')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back to brands/i }))
    expect(screen.getByText('Brands')).toBeInTheDocument()
    expect(screen.getByText('Web app')).toBeInTheDocument()
  })

  it('generates the project site folder when the Web app card is clicked', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    expect(mockCreateSite).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Web app'))
    expect(mockCreateSite).toHaveBeenCalledTimes(1)
  })
})

describe('WebsiteStage — Web app Typography step (KDL-558)', () => {
  it('defaults to Poppins/Inter and saves the selection (Save stays on the Typography step)', async () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))

    // Defaults pre-selected (first curated option per role).
    const poppinsTile = screen.getByText('Poppins').closest('button')!
    expect(poppinsTile.querySelector('input[type="checkbox"]')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() => expect(mockPatchTypography).toHaveBeenCalled())
    expect(mockPatchTypography).toHaveBeenCalledWith(
      {
        heading: { family: 'Poppins', families: ['Poppins'] },
        body: { family: 'Inter', families: ['Inter'] },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )

    // The mutation's onSuccess hands back the saved kit; the step stays put (Font settings is
    // reached from its own step, not by Save).
    const [, opts] = mockPatchTypography.mock.calls[0] as [
      unknown,
      { onSuccess: (kit: { typography: unknown }) => void },
    ]
    act(() =>
      opts.onSuccess({
        typography: { heading: { family: 'Poppins' }, body: { family: 'Inter' } },
      })
    )
    expect(screen.getByText(/pick the heading and body fonts/i)).toBeInTheDocument()
  })

  describe('after the fonts: Save, Next: Typography, or Skip to Navigation', () => {
    const savedKit = { typography: { heading: { family: 'Poppins' }, body: { family: 'Inter' } } }
    const persistedStep = () =>
      JSON.parse(window.localStorage.getItem('te-website-ui:proj-1') ?? '{}').webAppStep

    // Presses a button, then plays the part of the server saying "saved".
    function pressAndConfirmSaved(name: RegExp) {
      renderWithQC(<WebsiteStage run={makeRun()} />)
      fireEvent.click(screen.getByText('Web app'))
      fireEvent.click(screen.getByRole('button', { name }))
      const [, opts] = mockPatchTypography.mock.calls[0] as [
        unknown,
        { onSuccess: (kit: unknown) => void },
      ]
      act(() => opts.onSuccess(savedKit))
    }

    it('offers all three side by side', () => {
      renderWithQC(<WebsiteStage run={makeRun()} />)
      fireEvent.click(screen.getByText('Web app'))
      expect(screen.getByTestId('typography-save')).toHaveTextContent('Save')
      expect(screen.getByTestId('typography-skip')).toHaveTextContent('Skip to Navigation')
      expect(screen.getByTestId('typography-next')).toHaveTextContent('Next: Typography')
    })

    it('Next: Typography saves the chosen fonts first, then opens the Typography settings', () => {
      pressAndConfirmSaved(/next: typography/i)
      expect(mockPatchTypography).toHaveBeenCalledWith(
        {
          heading: { family: 'Poppins', families: ['Poppins'] },
          body: { family: 'Inter', families: ['Inter'] },
        },
        expect.anything()
      )
      expect(persistedStep()).toBe('fontSettings')
      expect(screen.queryByText(/pick the heading and body fonts/i)).not.toBeInTheDocument()
    })

    it('Skip to Navigation saves the fonts first too, then jumps over the Typography settings', () => {
      pressAndConfirmSaved(/skip to navigation/i)
      expect(mockPatchTypography).toHaveBeenCalledTimes(1)
      expect(persistedStep()).toBe('navigation')
      expect(screen.queryByText(/pick the heading and body fonts/i)).not.toBeInTheDocument()
    })

    it('does not move on until the save has gone through (a failed save keeps you here)', () => {
      renderWithQC(<WebsiteStage run={makeRun()} />)
      fireEvent.click(screen.getByText('Web app'))
      fireEvent.click(screen.getByRole('button', { name: /skip to navigation/i }))
      expect(mockPatchTypography).toHaveBeenCalled() // asked to save...
      expect(persistedStep()).toBe('typography') // ...but nothing has confirmed it yet
      expect(screen.getByText(/pick the heading and body fonts/i)).toBeInTheDocument()
    })

    it('all three are available as soon as each role has a font (it always does: the last one cannot be unchecked)', () => {
      renderWithQC(<WebsiteStage run={makeRun()} />)
      fireEvent.click(screen.getByText('Web app'))
      for (const id of ['typography-save', 'typography-skip', 'typography-next'])
        expect(screen.getByTestId(id)).toBeEnabled()
    })
  })

  it('is a true multi-select — picking another heading font keeps the first one checked too', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))

    fireEvent.click(screen.getByText('Manrope'))

    const poppinsTile = screen.getByText('Poppins').closest('button')!
    const manropeTile = screen.getByText('Manrope').closest('button')!
    expect(poppinsTile.querySelector('input[type="checkbox"]')).toBeChecked()
    expect(manropeTile.querySelector('input[type="checkbox"]')).toBeChecked()
    expect(screen.getByText('Heading — pick one or more (2 selected)')).toBeInTheDocument()
  })

  it('never lets the last selected font in a role be unchecked', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))

    // Poppins is the only heading font selected by default — clicking it
    // again must not drop the selection to zero.
    fireEvent.click(screen.getByText('Poppins'))

    const poppinsTile = screen.getByText('Poppins').closest('button')!
    expect(poppinsTile.querySelector('input[type="checkbox"]')).toBeChecked()
    expect(screen.getByText('Heading — pick one or more (1 selected)')).toBeInTheDocument()
  })

  it('adding a custom Google Font name selects it immediately', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))

    const [headingInput] = screen.getAllByPlaceholderText(/google font name/i)
    fireEvent.change(headingInput!, { target: { value: 'Sora' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^add$/i })[0]!)

    const soraTile = screen.getByText('Sora').closest('button')!
    expect(soraTile.querySelector('input[type="checkbox"]')).toBeChecked()
  })

  it('supports adding and removing custom font rows ("+ Add row" from the prototype)', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))

    // Starts with 1 custom-font row per section (Heading + Body = 2 total).
    expect(screen.getAllByPlaceholderText(/google font name/i)).toHaveLength(2)

    const [addRowHeading] = screen.getAllByRole('button', { name: /add row/i })
    fireEvent.click(addRowHeading!)
    expect(screen.getAllByPlaceholderText(/google font name/i)).toHaveLength(3)

    // The new row works independently — typing + Add adds a new tile.
    const headingInputs = screen.getAllByPlaceholderText(/google font name/i)
    fireEvent.change(headingInputs[1]!, { target: { value: 'Lato' } })
    const addButtons = screen.getAllByRole('button', { name: /^add$/i })
    fireEvent.click(addButtons[1]!)
    expect(screen.getByText('Lato')).toBeInTheDocument()

    // Removing a row drops it back down.
    const removeButtons = screen.getAllByRole('button', { name: /remove font row/i })
    fireEvent.click(removeButtons[0]!)
    expect(screen.getAllByPlaceholderText(/google font name/i)).toHaveLength(2)
  })

  it('resumes at the assemble view when the saved UI state says so', () => {
    resumeAt('assemble')
    renderWithQC(<WebsiteStage run={makeRun()} />)

    expect(screen.queryByText(/pick the heading and body fonts/i)).not.toBeInTheDocument()
    // Pages is a live view of Navigation, not the last assemble snapshot.
    expect(screen.getByTestId('nav-pages-grid')).toBeInTheDocument()
  })
})

describe('WebsiteStage — Font settings hands over to the next steps', () => {
  const persistedStep = () =>
    JSON.parse(window.localStorage.getItem('te-website-ui:proj-1') ?? '{}').webAppStep

  it('Next: Buttons and form fields opens that step (type-scale rows already autosave)', () => {
    resumeAt('fontSettings')
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByTestId('fontsettings-next'))
    expect(persistedStep()).toBe('styles')
    expect(screen.queryByTestId('fontsettings-next')).not.toBeInTheDocument()
  })

  it('Skip to Navigation jumps over the buttons and form fields', () => {
    resumeAt('fontSettings')
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByTestId('fontsettings-skip'))
    expect(persistedStep()).toBe('navigation')
  })

  it('Save stays on Font settings, next to the two buttons', () => {
    resumeAt('fontSettings')
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByTestId('fontsettings-save'))
    expect(persistedStep()).toBe('fontSettings')
    expect(screen.getByTestId('fontsettings-skip')).toHaveTextContent('Skip to Navigation')
    expect(screen.getByTestId('fontsettings-next')).toHaveTextContent(
      'Next: Buttons and form fields'
    )
  })

  it('the Buttons and form fields step is part of the flow (Back returns to Font settings)', () => {
    resumeAt('styles')
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByRole('button', { name: /back to font settings/i }))
    expect(persistedStep()).toBe('fontSettings')
  })
})

describe('WebsiteStage — assemble view (post-typography)', () => {
  it('shows the live Navigation-driven pages grid once typography is already saved', () => {
    mockUseBrandKit.mockReturnValue({
      data: {
        ...BRAND_KIT,
        typography: { heading: { family: 'Poppins' }, body: { family: 'Inter' } },
      },
      isLoading: false,
    })
    resumeAt('assemble')
    renderWithQC(<WebsiteStage run={makeRun({ home: 'page-1', about: 'page-2' })} />)

    expect(screen.getByTestId('nav-pages-grid')).toHaveTextContent('home:page-1')
  })
})
