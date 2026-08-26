/**
 * RTL regression tests for KDL-570:
 *   Studio dead-end fix — "Start Studio run" CTA when no run exists.
 *
 * Covers:
 *   A. No runs → NoRunPlaceholder renders with "Start Studio run" button
 *   B. Click → POST /template-engine/runs called with projectId
 *   C. Success → router.push to intake AND IntakeStage renders after refetch
 *   D. Failure → destructive toast shown
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Hoisted mocks (available when vi.mock factories run) ──────────────────────

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/axios', () => {
  const get = vi.fn()
  const post = vi.fn()
  return { default: { get, post } }
})

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

// Override the global next/navigation mock (from setup.ts) with one that also
// exposes useParams so StagePage can read projectId + stageSlug.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ projectId: 'proj-1', stageSlug: 'intake' }),
}))

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_RUN = {
  id: 'run-1',
  projectId: 'proj-1',
  status: 'IN_PROGRESS' as const,
  brandKitVersion: null,
  createdBy: 'user-1',
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
  stages: [
    {
      id: 'stage-1',
      runId: 'run-1',
      stage: 'INTAKE' as const,
      status: 'PENDING' as const,
      errorCode: null,
      outputRef: null,
      startedAt: null,
      completedAt: null,
    },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

async function importStagePage() {
  const mod = await import('@/app/admin/template-engine/projects/[projectId]/[stageSlug]/page')
  return mod.default
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Studio StagePage — no-run dead-end fix (KDL-570)', () => {
  let apiGet: ReturnType<typeof vi.fn>
  let apiPost: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const api = await import('@/lib/axios')
    apiGet = api.default.get as ReturnType<typeof vi.fn>
    apiPost = api.default.post as ReturnType<typeof vi.fn>
  })

  afterEach(() => {
    vi.resetModules()
  })

  // A: No runs → placeholder with actionable button
  it('renders "Start Studio run" button when the project has no runs', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: [] } })
    const StagePage = await importStagePage()
    renderWithQC(<StagePage />)

    await waitFor(() => {
      expect(screen.getByTestId('btn-start-run')).toBeTruthy()
    })
    expect(screen.getByText('Start Studio run')).toBeTruthy()
    // Dead-end link to landing page must be gone
    expect(screen.queryByText('Studio landing page')).toBeNull()
  })

  // B: Click fires POST with correct projectId
  it('calls POST /template-engine/runs with projectId on button click', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: [] } })
    apiPost.mockResolvedValue({ data: { success: true, data: MOCK_RUN } })

    const StagePage = await importStagePage()
    renderWithQC(<StagePage />)

    await waitFor(() => screen.getByTestId('btn-start-run'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-start-run'))
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/template-engine/runs', { projectId: 'proj-1' })
    })
  })

  // C: Success → router.push and IntakeStage renders after refetch
  it('navigates to intake and renders IntakeStage after successful run creation', async () => {
    // First fetch: no runs; subsequent fetches (after invalidation): run exists
    apiGet
      .mockResolvedValueOnce({ data: { success: true, data: [] } })
      .mockResolvedValue({ data: { success: true, data: [MOCK_RUN] } })
    apiPost.mockResolvedValue({ data: { success: true, data: MOCK_RUN } })

    const StagePage = await importStagePage()
    renderWithQC(<StagePage />)

    await waitFor(() => screen.getByTestId('btn-start-run'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-start-run'))
    })

    // router.push is called with the intake URL
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/intake')
    })

    // After query invalidation + refetch, IntakeStage renders (heading "Intake" visible)
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeTruthy() // IntakeStage title (KDL-558)
    })
  })

  // D: Failure → destructive toast, button re-enabled
  it('shows a destructive toast when run creation fails', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: [] } })
    apiPost.mockRejectedValue(new Error('network error'))

    const { toast } = await import('@/hooks/use-toast')
    const StagePage = await importStagePage()
    renderWithQC(<StagePage />)

    await waitFor(() => screen.getByTestId('btn-start-run'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-start-run'))
    })

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })

    // Button should be re-enabled after failure
    await waitFor(() => {
      const btn = screen.getByTestId('btn-start-run') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })
})
