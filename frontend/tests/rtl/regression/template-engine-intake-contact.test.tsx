/**
 * RTL regression tests for KDL-558 roadmap row 1 (corrected) — IntakeStage's
 * "Logo & Contact Details" card sources its 7 contact fields from the
 * standalone Application Settings "brand-profile" Type (seeded by
 * backend/prisma/seeders/brand-profile-fields.seed.js) via the generic
 * GET /setting-fields/by-type/:slug + POST /setting-fields/values endpoints —
 * the same mechanism /admin/settings/view/[slug] uses — not a per-project
 * hidden store.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeStage } from '@/app/admin/template-engine/_components/stages/IntakeStage'
import type { TemplateEngineRun } from '@/types/template-engine.types'

const { FIELDS } = vi.hoisted(() => ({
  FIELDS: [
    {
      id: 'f-logo',
      field_name: 'Logo file',
      slug: 'brand-profile-logo',
      input_type: 'file',
      value: null,
      alt_text: null,
      options: null,
      sort: 0,
    },
    {
      id: 'f-company',
      field_name: 'Company name',
      slug: 'brand-profile-company-name',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 1,
    },
    {
      id: 'f-pemail',
      field_name: 'Primary email',
      slug: 'brand-profile-primary-email',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 2,
    },
    {
      id: 'f-semail',
      field_name: 'Secondary email',
      slug: 'brand-profile-secondary-email',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 3,
    },
    {
      id: 'f-pphone',
      field_name: 'Primary phone',
      slug: 'brand-profile-primary-phone',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 4,
    },
    {
      id: 'f-sphone',
      field_name: 'Secondary phone',
      slug: 'brand-profile-secondary-phone',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 5,
    },
    {
      id: 'f-addr1',
      field_name: 'Address 1',
      slug: 'brand-profile-address-1',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 6,
    },
    {
      id: 'f-addr2',
      field_name: 'Address 2',
      slug: 'brand-profile-address-2',
      input_type: 'textbox',
      value: '',
      alt_text: null,
      options: null,
      sort: 7,
    },
  ],
}))

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: vi.fn(), isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: () => ({ data: { logo_media_id: 'media-1', status: 'draft' }, isLoading: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { data: { type: { id: 'type-1', name: 'Brand Profile' }, fields: FIELDS } },
    }),
    post: vi.fn().mockResolvedValue({ data: { data: { fields: FIELDS } } }),
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

describe('IntakeStage — Logo & Contact Details (standalone Application Settings fields)', () => {
  it('fetches fields from GET /setting-fields/by-type/brand-profile', async () => {
    const api = (await import('@/lib/axios')).default
    renderWithQC(<IntakeStage run={makeRun()} />)

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/setting-fields/by-type/brand-profile')
    )
  })

  it('renders the 7 contact fields (not the generic Logo field, which stays on brand-kit upload)', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    for (const label of [
      'Company name',
      'Primary email',
      'Secondary email',
      'Primary phone',
      'Secondary phone',
      'Address 1',
      'Address 2',
    ]) {
      expect(await screen.findByLabelText(label)).toBeInTheDocument()
    }
    // Two "Logo file" labels would be ambiguous — assert Studio's own upload button instead.
    // hasLogo is true in this fixture, so the button reads "Replace file".
    expect(screen.getByRole('button', { name: /replace file/i })).toBeInTheDocument()
  })

  it('Next is disabled until company name is filled', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)
    await screen.findByLabelText('Company name')

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('clicking Next saves via POST /setting-fields/values with the Brand Profile type_id, excluding the logo field', async () => {
    const api = (await import('@/lib/axios')).default
    renderWithQC(<IntakeStage run={makeRun()} />)

    fireEvent.change(await screen.findByLabelText('Company name'), {
      target: { value: 'Aster Foundation' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/setting-fields/values',
        expect.objectContaining({
          type_id: 'type-1',
          values: expect.arrayContaining([
            expect.objectContaining({ id: 'f-company', value: 'Aster Foundation' }),
          ]),
        })
      )
    )
    const call = (api.post as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = call?.[1] as { values: Array<{ id: string }> }
    expect(body.values.some((v) => v.id === 'f-logo')).toBe(false)
  })
})
