/**
 * RTL regression tests for KDL-558 roadmap row 4a — WebsiteStage gets the
 * design prototype's "Brands" cards grid (one brand surface per card, click
 * to open) and, per the follow-up instruction, the "Web app" card opens the
 * prototype's Typography step (pick heading/body fonts) before the existing
 * assemble/skip flow. Only the "Web app" card is wired up — ship one card's
 * flow before adding the rest.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WebsiteStage } from '@/app/admin/template-engine/_components/stages/WebsiteStage'
import type { TemplateEngineRun, BrandKit } from '@/types/template-engine.types'

const { mockPatchTypography, mockUseBrandKit } = vi.hoisted(() => ({
  mockPatchTypography: vi.fn(),
  mockUseBrandKit: vi.fn(),
}))

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: vi.fn(), isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useSkipStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: mockUseBrandKit,
  usePatchTypography: () => ({ mutate: mockPatchTypography, isPending: false }),
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
        outputRef: pageIds ? { pageIds } : null,
        startedAt: null,
        completedAt: null,
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseBrandKit.mockReturnValue({ data: BRAND_KIT, isLoading: false })
})

describe('WebsiteStage — Brands cards grid (KDL-558)', () => {
  it('lands on the Brands grid with a single Web app card', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    expect(screen.getByText('Brands')).toBeInTheDocument()
    expect(screen.getByText('Web app')).toBeInTheDocument()
    // No other brand cards yet — Admin app / Visiting card / etc. aren't wired up.
    expect(screen.queryByText('Admin app')).not.toBeInTheDocument()
    expect(screen.queryByText('Visiting card')).not.toBeInTheDocument()
    // The stage's own assemble/skip controls stay hidden until a card is opened.
    expect(screen.queryByRole('button', { name: /^run$/i })).not.toBeInTheDocument()
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
})

describe('WebsiteStage — Web app Typography step (KDL-558)', () => {
  it('defaults to Poppins/Inter, saves the selection, and advances to the assemble view', async () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)
    fireEvent.click(screen.getByText('Web app'))

    // Defaults pre-selected (first curated option per role).
    const poppinsTile = screen.getByText('Poppins').closest('button')!
    expect(poppinsTile.querySelector('input[type="checkbox"]')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /^next/i }))

    await waitFor(() => expect(mockPatchTypography).toHaveBeenCalled())
    expect(mockPatchTypography).toHaveBeenCalledWith(
      {
        heading: { family: 'Poppins', families: ['Poppins'] },
        body: { family: 'Inter', families: ['Inter'] },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )

    // Simulate the mutation's onSuccess firing (mutate is a bare vi.fn()).
    const [, opts] = mockPatchTypography.mock.calls[0] as [unknown, { onSuccess: () => void }]
    act(() => opts.onSuccess())
    expect(screen.getByText(/no pages assembled yet/i)).toBeInTheDocument()
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

  it('skips straight to the assemble view when typography was already saved', () => {
    mockUseBrandKit.mockReturnValue({
      data: {
        ...BRAND_KIT,
        typography: { heading: { family: 'Manrope' }, body: { family: 'Roboto' } },
      },
      isLoading: false,
    })
    renderWithQC(<WebsiteStage run={makeRun()} />)

    fireEvent.click(screen.getByText('Web app'))
    expect(screen.queryByText(/pick the heading and body fonts/i)).not.toBeInTheDocument()
    expect(screen.getByText(/no pages assembled yet/i)).toBeInTheDocument()
  })
})

describe('WebsiteStage — assemble view (post-typography)', () => {
  it('shows the assembled page count once typography is already saved', () => {
    mockUseBrandKit.mockReturnValue({
      data: {
        ...BRAND_KIT,
        typography: { heading: { family: 'Poppins' }, body: { family: 'Inter' } },
      },
      isLoading: false,
    })
    renderWithQC(<WebsiteStage run={makeRun({ home: 'page-1', about: 'page-2' })} />)

    fireEvent.click(screen.getByText('Web app'))
    expect(screen.getByText('2 pages assembled')).toBeInTheDocument()
  })
})
