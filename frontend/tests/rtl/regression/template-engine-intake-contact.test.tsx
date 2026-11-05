/**
 * RTL regression tests for IntakeStage (Overview). The logo and contact details are edited
 * under CMS → Company Details; this stage only checks the logo and company name exist
 * (read from the "brand-profile" settings Type) and lets the run move on to the palette.
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

describe('IntakeStage — Overview (checks Company Details, then continues)', () => {
  it('reads the company name from GET /setting-fields/by-type/brand-profile', async () => {
    const api = (await import('@/lib/axios')).default
    renderWithQC(<IntakeStage run={makeRun()} />)

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/setting-fields/by-type/brand-profile')
    )
  })

  it('links to Company Details instead of editing the fields itself', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    const link = await screen.findByRole('link', { name: /edit company details/i })
    expect(link).toHaveAttribute('href', '/admin/website-details')
    expect(screen.queryByLabelText(/^Company name/)).not.toBeInTheDocument()
  })

  it('shows the logo and company checks', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    expect(await screen.findByText('Logo uploaded')).toBeInTheDocument()
    expect(screen.getByText('Company name entered')).toBeInTheDocument()
  })

  it('Next is disabled until the company name is filled in', async () => {
    renderWithQC(<IntakeStage run={makeRun()} />)

    // FIELDS has an empty company name
    const next = await screen.findByRole('button', { name: /^next$/i })
    expect(next).toBeDisabled()
  })

  it('Next is disabled when no logo is uploaded', async () => {
    mockUseBrandKit.mockReturnValue({
      data: { logo_media_id: null, status: 'draft' },
      isLoading: false,
    })
    renderWithQC(<IntakeStage run={makeRun()} />)

    expect(await screen.findByRole('button', { name: /^next$/i })).toBeDisabled()
  })

  it('Next advances the stage and opens the Color Palette page when logo and company are set', async () => {
    const { mockPush } = await import('../../__mocks__/next-navigation')
    const company = FIELDS.find((f) => f.slug === 'brand-profile-company-name')!
    company.value = 'Acme'
    try {
      renderWithQC(<IntakeStage run={makeRun()} />)
      const next = await screen.findByRole('button', { name: /^next$/i })
      await waitFor(() => expect(next).toBeEnabled())
      fireEvent.click(next)
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/admin/template-engine/projects/proj-1/palette')
      )
    } finally {
      company.value = ''
    }
  })
})
