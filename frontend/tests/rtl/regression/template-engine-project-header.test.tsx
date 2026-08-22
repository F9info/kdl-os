/**
 * RTL regression tests for KDL-594:
 *   Studio stage buttons dead — frontend never sent X-Project-Id; advance
 *   errors were swallowed silently.
 *
 * Covers:
 *   A. advance/retry/skip POST with the X-Project-Id header
 *   B. advance failure → destructive toast with the backend error code
 *   C. ExportStage DONE → manifest GET carries the header and renders,
 *      including with collateral: null (real backend shape — was a crash)
 */
import React from 'react'
import { render, screen, waitFor, act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useAdvanceStage,
  useRetryStage,
  useSkipStage,
} from '@/hooks/useTemplateEngine'
import { ExportStage } from '@/app/admin/template-engine/_components/stages/ExportStage'
import type { TemplateEngineRun } from '@/types/template-engine.types'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/axios', () => {
  const get = vi.fn()
  const post = vi.fn()
  return { default: { get, post } }
})

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_SCOPE = { headers: { 'X-Project-Id': 'proj-1' } }

const MOCK_STAGE = {
  id: 'stage-9',
  runId: 'run-1',
  stage: 'EXPORT' as const,
  status: 'DONE' as const,
  errorCode: null,
  outputRef: null,
  startedAt: '2026-08-20T00:00:00Z',
  completedAt: '2026-08-20T00:01:00Z',
}

const DONE_RUN: TemplateEngineRun = {
  id: 'run-1',
  projectId: 'proj-1',
  status: 'COMPLETED',
  brandKitVersion: null,
  createdBy: 'user-1',
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:01:00Z',
  stages: [MOCK_STAGE],
}

// Real backend shape from run cmt3vjol9 on project cmt3vgjf3: collateral is
// null when the stage was skipped, guidelines has fileUrl (not downloadUrl).
const MOCK_MANIFEST = {
  runId: 'run-1',
  projectId: 'proj-1',
  brandKitVersion: null,
  site: { themeEndpoint: '/api/theme-engine/tokens?platform=webapp', pageIds: ['p1', 'p2'] },
  guidelines: {
    renderId: 'brand-kit/guidelines/proj-1/abc.pdf',
    fileUrl: 'brand-kit/guidelines/proj-1/abc.pdf',
    bytes: 5060,
    renderedAt: '2026-08-20T00:00:30Z',
  },
  collateral: null,
  exportedAt: '2026-08-20T00:01:00Z',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Studio project scoping — X-Project-Id header (KDL-594)', () => {
  let apiGet: ReturnType<typeof vi.fn>
  let apiPost: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const api = await import('@/lib/axios')
    apiGet = api.default.get as ReturnType<typeof vi.fn>
    apiPost = api.default.post as ReturnType<typeof vi.fn>
  })

  // A: every stage mutation carries the project scope header
  it.each([
    ['advance', useAdvanceStage],
    ['retry', useRetryStage],
    ['skip', useSkipStage],
  ] as const)('POSTs stage %s with the X-Project-Id header', async (action, useHook) => {
    apiPost.mockResolvedValue({ data: { success: true, data: MOCK_STAGE } })

    const { result } = renderHook(() => useHook('run-1', 'proj-1'), { wrapper })
    await act(async () => {
      result.current.mutate('INTAKE')
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        `/template-engine/runs/run-1/stages/intake/${action}`,
        undefined,
        PROJECT_SCOPE
      )
    })
  })

  // B: advance failures surface the backend error code (was swallowed)
  it('shows a destructive toast with the backend code when advance fails', async () => {
    apiPost.mockRejectedValue({
      response: { status: 409, data: { code: 'BRAND_KIT_NOT_APPROVED' } },
    })
    const { toast } = await import('@/hooks/use-toast')

    const { result } = renderHook(() => useAdvanceStage('run-1', 'proj-1'), { wrapper })
    await act(async () => {
      result.current.mutate('APPROVAL')
    })

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'BRAND_KIT_NOT_APPROVED', variant: 'destructive' })
      )
    })
  })

  // C: DONE export renders the manifest — header sent, null collateral survives
  it('renders the export manifest (collateral null) instead of the placeholder', async () => {
    apiGet.mockResolvedValue({ data: { success: true, data: MOCK_MANIFEST } })

    render(
      <QueryClientProvider client={makeQC()}>
        <ExportStage run={DONE_RUN} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/template-engine/runs/run-1/export', PROJECT_SCOPE)
    })
    await waitFor(() => {
      expect(screen.getByText(/Export ready/)).toBeTruthy()
    })
    expect(screen.getByText(/2 assembled pages/)).toBeTruthy()
    expect(screen.getByText(/Collateral stage skipped/)).toBeTruthy()
    expect(screen.queryByText(/Export not yet complete/)).toBeNull()
  })
})
