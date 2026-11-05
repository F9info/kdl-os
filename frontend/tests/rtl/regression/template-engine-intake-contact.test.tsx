/**
 * RTL regression tests for IntakeStage (Overview). Company name, logo and contact details are
 * managed once in Settings → Identity; this stage only checks the name and logo exist (read from
 * Application Identity) and lets the run move on to the palette.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeStage } from '@/app/admin/template-engine/_components/stages/IntakeStage'
import type { TemplateEngineRun } from '@/admin/types/template-engine.types'

const { identity, kit } = vi.hoisted(() => ({
  identity: { v: {} as Record<string, string> },
  kit: { v: { logo_media_id: null } as { logo_media_id: string | null } },
}))

vi.mock('@/hooks/useIdentity', () => ({
  useIdentity: () => ({ identity: identity.v, appName: identity.v.app_name, isLoading: false }),
}))

vi.mock('@/admin/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({
    mutate: (_stage: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
    isPending: false,
  }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: () => ({ data: kit.v, isLoading: false }),
}))

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
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
        stage: 'INTAKE',
        status: 'PENDING',
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
  identity.v = { app_name: 'Acme', logo_light: 'https://minio.test/logo.png' }
  kit.v = { logo_media_id: null }
})

describe('IntakeStage — Overview (checks Identity, then continues)', () => {
  it('reads the company name and logo from Application Identity, not from the legacy brand-profile fields', async () => {
    const api = (await import('@/lib/axios')).default
    renderWithQC(<IntakeStage run={makeRun()} />)
    expect(await screen.findByText('Company name entered')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('brand-profile'))
  })

  it('links to Identity instead of editing the fields itself', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)
    const link = await screen.findByRole('link', { name: /edit in identity/i })
    expect(link).toHaveAttribute('href', '/admin/settings/identity')
    expect(screen.queryByLabelText(/^Company name/)).not.toBeInTheDocument()
  })

  it('Next is disabled until the company name is set', async () => {
    identity.v = { logo_light: 'https://minio.test/logo.png' }
    renderWithQC(<IntakeStage run={makeRun()} />)
    expect(await screen.findByRole('button', { name: /^next$/i })).toBeDisabled()
  })

  it('a project with its own logo is ready even when the company has none', async () => {
    identity.v = { app_name: 'Acme' }
    kit.v = { logo_media_id: 'own-logo' }
    renderWithQC(<IntakeStage run={makeRun()} />)
    expect(await screen.findByRole('button', { name: /^next$/i })).toBeEnabled()
  })

  it('Next is disabled when neither the project nor the company has a logo', async () => {
    identity.v = { app_name: 'Acme' }
    renderWithQC(<IntakeStage run={makeRun()} />)
    expect(await screen.findByRole('button', { name: /^next$/i })).toBeDisabled()
  })

  it('Next advances the stage and opens the Color Palette page when logo and company are set', async () => {
    const { mockPush } = await import('../../__mocks__/next-navigation')
    renderWithQC(<IntakeStage run={makeRun()} />)
    const next = await screen.findByRole('button', { name: /^next$/i })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
    )
  })
})
