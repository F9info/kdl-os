/**
 * RTL regression tests for KDL-558 roadmap row 1 — IntakeStage gains a real
 * "Logo & Contact Details" form (company name, primary/secondary email,
 * primary/secondary phone, address1/2), backed by Application Settings
 * (Types/SettingField) via useBrandContactFields/useSaveBrandContactFields,
 * not new BrandKit columns.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeStage } from '@/app/admin/template-engine/_components/stages/IntakeStage'
import type { TemplateEngineRun } from '@/types/template-engine.types'

const { mockSaveMutate } = vi.hoisted(() => ({ mockSaveMutate: vi.fn() }))

const CONTACT_FIELDS = [
  { key: 'company_name', label: 'Company name', value: '' },
  { key: 'primary_email', label: 'Primary email', value: '' },
  { key: 'secondary_email', label: 'Secondary email', value: '' },
  { key: 'primary_phone', label: 'Primary phone', value: '' },
  { key: 'secondary_phone', label: 'Secondary phone', value: '' },
  { key: 'address1', label: 'Address 1', value: '' },
  { key: 'address2', label: 'Address 2', value: '' },
]

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: vi.fn(), isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: () => ({ data: { logo_media_id: null }, isLoading: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandContactFields: () => ({ data: CONTACT_FIELDS }),
  useSaveBrandContactFields: () => ({ mutate: mockSaveMutate, isPending: false }),
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

beforeEach(() => vi.clearAllMocks())

describe('IntakeStage — Logo & Contact Details form', () => {
  it('renders all 7 contact fields with their labels', () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    for (const f of CONTACT_FIELDS) {
      expect(screen.getByLabelText(new RegExp(f.label, 'i'))).toBeInTheDocument()
    }
  })

  it('Submit is disabled until company name is filled', () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('submits the current field values via useSaveBrandContactFields', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: 'Aster Foundation' },
    })
    fireEvent.change(screen.getByLabelText(/primary email/i), { target: { value: 'hi@aster.org' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() =>
      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({ company_name: 'Aster Foundation', primary_email: 'hi@aster.org' })
      )
    )
  })
})
