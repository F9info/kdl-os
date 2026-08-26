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

const { mockUseBrandKit } = vi.hoisted(() => ({
  mockUseBrandKit: vi.fn(
    (): { data: { logo_media_id: string | null; status: string }; isLoading: boolean } => ({
      data: { logo_media_id: 'media-1', status: 'draft' },
      isLoading: false,
    })
  ),
}))

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({
    mutate: (_stage: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
    isPending: false,
  }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useBrandKit: mockUseBrandKit,
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/media/')) {
        return Promise.resolve({
          data: { data: { media: { url: 'https://minio.test/logo.png' } } },
        })
      }
      return Promise.resolve({
        data: { data: { type: { id: 'type-1', name: 'Brand Profile' }, fields: FIELDS } },
      })
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

beforeEach(() => {
  vi.clearAllMocks()
  // Re-arm the default (logo present) after clearAllMocks and after any
  // test overrides it — the component re-renders multiple times per test,
  // so a mockReturnValueOnce would only cover the first render.
  mockUseBrandKit.mockReturnValue({
    data: { logo_media_id: 'media-1', status: 'draft' },
    isLoading: false,
  })
})

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

    // Company name's label includes a trailing " *" (required marker), so it's matched by regex.
    for (const label of [
      /^Company name/,
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
    // No "Category: …" clutter — every field shares the one category the card title already names.
    expect(screen.queryByText(/Category:/)).not.toBeInTheDocument()
  })

  it('shows the uploaded logo as an image preview once its media record resolves', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    const img = await screen.findByAltText('Uploaded logo')
    expect(img).toHaveAttribute('src', 'https://minio.test/logo.png')
  })

  it('clicking Next with an empty company name shows a validation error and does not save', async () => {
    const api = (await import('@/lib/axios')).default
    renderWithQC(<IntakeStage run={makeRun()} />)
    await screen.findByLabelText(/^Company name/)

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Company name is required.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('clicking Next with no logo uploaded shows a validation error and does not save', async () => {
    const api = (await import('@/lib/axios')).default
    mockUseBrandKit.mockReturnValue({
      data: { logo_media_id: null, status: 'draft' },
      isLoading: false,
    })
    renderWithQC(<IntakeStage run={makeRun()} />)

    fireEvent.change(await screen.findByLabelText(/^Company name/), {
      target: { value: 'Aster Foundation' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Logo file is required.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('clicking Next saves via POST /setting-fields/values with the Brand Profile type_id, excluding the logo field', async () => {
    const api = (await import('@/lib/axios')).default
    renderWithQC(<IntakeStage run={makeRun()} />)

    fireEvent.change(await screen.findByLabelText(/^Company name/), {
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

  it('navigates to the Palette stage once the stage actually advances', async () => {
    const { mockPush } = await import('../../__mocks__/next-navigation')
    renderWithQC(<IntakeStage run={makeRun()} />)

    fireEvent.change(await screen.findByLabelText(/^Company name/), {
      target: { value: 'Aster Foundation' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
    )
  })
})
