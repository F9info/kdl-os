/**
 * RTL regression tests for KDL-558 roadmap row 4a — WebsiteStage gets the
 * design prototype's "Brands" cards grid (one brand surface per card, click
 * to open). Only the "Web app" card is wired up per explicit instruction —
 * ship one card's flow before adding the rest.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WebsiteStage } from '@/app/admin/template-engine/_components/stages/WebsiteStage'
import type { TemplateEngineRun } from '@/types/template-engine.types'

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: vi.fn(), isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useSkipStage: () => ({ mutate: vi.fn(), isPending: false }),
}))

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

  it('opens the Web app flow on click, and Back returns to the grid', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    fireEvent.click(screen.getByText('Web app'))
    expect(screen.getByText(/no pages assembled yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Brands')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back to brands/i }))
    expect(screen.getByText('Brands')).toBeInTheDocument()
    expect(screen.getByText('Web app')).toBeInTheDocument()
  })

  it('shows the assembled page count inside the opened Web app card', () => {
    renderWithQC(<WebsiteStage run={makeRun({ home: 'page-1', about: 'page-2' })} />)

    fireEvent.click(screen.getByText('Web app'))
    expect(screen.getByText('2 pages assembled')).toBeInTheDocument()
  })
})
