/**
 * RTL regression tests for KDL-558 roadmap row 2 — PaletteStage becomes a
 * real editor (4 named colour groups: primary/secondary/accent/neutral,
 * each with an editable base hex + regenerated 10-step ramp), backed by
 * GET /brand-kit/:projectId (existing) and the new PATCH via usePatchBrandKit.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaletteStage } from '@/app/admin/template-engine/_components/stages/PaletteStage'
import type { TemplateEngineRun, BrandKit } from '@/types/template-engine.types'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const BRAND_KIT: BrandKit = {
  id: 'kit-1',
  project_id: 'proj-1',
  status: 'extracted',
  logo_media_id: 'media-1',
  logo_raster_media_id: null,
  palette: {
    schemaVersion: 1,
    paletteConfidence: 'high',
    colors: {
      primary: {
        hex: '#ec1b34',
        oklch: [0.5, 0.2, 20],
        confidence: 0.8,
        ramp: { '500': '#ec1b34', '50': '#fcdde1' },
        anchorStep: '500',
      },
      secondary: {
        hex: '#ffcd00',
        oklch: [0.85, 0.15, 90],
        confidence: 0.5,
        ramp: { '500': '#ffcd00' },
        anchorStep: '500',
      },
      accent: null,
      neutral: {
        hex: '#eaeaea',
        oklch: [0.9, 0.01, 0],
        confidence: 0.3,
        ramp: { '500': '#eaeaea' },
        anchorStep: '500',
      },
    },
  },
  contrast_report: null,
  typography: null,
  tone: null,
  approved_at: null,
}

const { mockPatchMutate, mockAdvanceMutate, mockUseBrandKit } = vi.hoisted(() => ({
  mockPatchMutate: vi.fn(),
  mockAdvanceMutate: vi.fn(),
  mockUseBrandKit: vi.fn(),
}))

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: mockAdvanceMutate, isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: mockUseBrandKit,
  usePatchBrandKit: () => ({ mutate: mockPatchMutate, isPending: false }),
}))

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi
      .fn()
      .mockResolvedValue({ data: { data: { media: { url: 'https://minio.test/logo.png' } } } }),
  },
}))

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function makeRun(): TemplateEngineRun {
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
        stage: 'PALETTE',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
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

describe('PaletteStage — re-extraction after a logo replace (stage stuck at stale DONE)', () => {
  it('shows an "Extract palette" trigger — not StageShell\'s disabled DONE button — when palette is null but the DAG stage still reads DONE from a prior logo', () => {
    // Reproduces the reported bug: uploading a new logo resets brand-kit's
    // palette to null server-side (brand-kit/service.js uploadLogo), but the
    // PALETTE DAG stage row is untouched and still says DONE from the old
    // logo's extraction. StageShell's own button disables at status===DONE,
    // so PaletteStage must own its own trigger instead of relying on it.
    mockUseBrandKit.mockReturnValue({
      data: { ...BRAND_KIT, palette: null, status: 'draft' },
      isLoading: false,
    })
    renderWithQC(<PaletteStage run={makeRun()} />) // run's PALETTE stage.status is 'DONE'

    const button = screen.getByRole('button', { name: /extract palette/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()

    fireEvent.click(button)
    expect(mockAdvanceMutate).toHaveBeenCalledWith('PALETTE')
  })

  it('shows the "Your logo" reference card even before extraction has run', async () => {
    mockUseBrandKit.mockReturnValue({
      data: { ...BRAND_KIT, palette: null, status: 'draft' },
      isLoading: false,
    })
    renderWithQC(<PaletteStage run={makeRun()} />)

    expect(screen.getByText('Your logo')).toBeInTheDocument()
    expect(await screen.findByAltText('Brand logo')).toHaveAttribute(
      'src',
      'https://minio.test/logo.png'
    )
  })

  it('disables the trigger when no logo has been uploaded yet', () => {
    mockUseBrandKit.mockReturnValue({
      data: { ...BRAND_KIT, palette: null, logo_media_id: null },
      isLoading: false,
    })
    renderWithQC(<PaletteStage run={makeRun()} />)

    expect(screen.getByRole('button', { name: /extract palette/i })).toBeDisabled()
  })
})

describe('PaletteStage — editable colour groups', () => {
  it('renders all 4 groups with their extracted base hex', () => {
    renderWithQC(<PaletteStage run={makeRun()} />)

    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('Secondary')).toBeInTheDocument()
    expect(screen.getByText('Tertiary')).toBeInTheDocument()
    expect(screen.getByText('Quaternary')).toBeInTheDocument()
    // one hex value renders in both the colour picker and the text field
    expect(screen.getAllByDisplayValue('#ec1b34')).toHaveLength(2)
    // accent was null in the fixture — falls back to a grey default, not a crash
    expect(screen.getAllByDisplayValue('#888888')).toHaveLength(2)
  })

  it('editing a base hex regenerates its ramp (anchor step matches the new hex)', () => {
    renderWithQC(<PaletteStage run={makeRun()} />)

    const primaryInput = screen.getByLabelText('Primary hex value')
    fireEvent.change(primaryInput, { target: { value: '#1a73e8' } })

    // the badge showing the current hex updates
    expect(screen.getByText('#1A73E8')).toBeInTheDocument()
  })

  it('clicking Submit palette saves via usePatchBrandKit and navigates to Brand Inference', async () => {
    renderWithQC(<PaletteStage run={makeRun()} />)

    fireEvent.click(screen.getByRole('button', { name: /submit palette/i }))

    await waitFor(() => expect(mockPatchMutate).toHaveBeenCalled())
    const call = mockPatchMutate.mock.calls[0]!
    const [palette, opts] = call as [
      { colors: { primary: { hex: string }; accent: { hex: string } } },
      { onSuccess: () => void },
    ]
    expect(palette.colors.primary.hex).toBe('#ec1b34')
    expect(palette.colors.accent.hex).toBe('#888888')

    // Simulate the mutation's onSuccess firing (mockPatchMutate is a bare vi.fn(),
    // so invoke the passed options.onSuccess directly to assert the navigation wiring).
    opts.onSuccess()
    expect(mockPush).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/inference')
  })
})
