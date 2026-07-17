// KDL-119 A8 — RTL gate: SearchFacets faceted search + ChunkedUploadDialog resume flow.
// Mocks mirror the real backend contract (verified against backend/src/modules/media):
//   GET  /media/search                    → { hits, facets, pagination }
//   GET  /media/tags                      → { tags: [{id,name,created_at,_count}] }
//   POST /media/upload/chunked/init       → { upload_id, total_parts }
//   GET  /media/upload/chunked/:id/status → { received_parts: number[], total_parts, complete }
//   PUT  /media/upload/chunked/:id/part?index=N (multipart field "chunk")
//   POST /media/upload/chunked/:id/complete → { media }
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import { SearchFacets, ChunkedUploadDialog } from '@/components/media/DamExtensions'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

import api from '@/lib/axios'

const TAGS = [
  { id: 't1', name: 'nature', created_at: '2026-01-01T00:00:00.000Z', _count: { media: 3 } },
  { id: 't2', name: 'urban', created_at: '2026-01-01T00:00:00.000Z', _count: { media: 1 } },
]

const SEARCH_RESULT = {
  hits: [
    {
      id: 'm1',
      name: 'sky.jpg',
      title: null,
      alt: null,
      caption: null,
      tags: ['nature'],
      meta: {},
      folder_id: null,
      folder_path: null,
      type: 'IMAGE',
      mime_type: 'image/jpeg',
      size: 1024,
      width: 800,
      height: 600,
      owner_id: 'u1',
      owner_name: 'Admin',
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  facets: { type: { IMAGE: 1 }, tags: { nature: 1 } },
  pagination: { total: 1, page: 1, limit: 24, pages: 1 },
}

function setupApiForSearch() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/media/tags')
      return Promise.resolve({ data: { data: { tags: TAGS } } }) as ReturnType<typeof api.get>
    if (url === '/media/search')
      return Promise.resolve({ data: { data: SEARCH_RESULT } }) as ReturnType<typeof api.get>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

// ─── SearchFacets ─────────────────────────────────────────────────────────────

describe('SearchFacets (KDL-119 A8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupApiForSearch()
  })

  it('renders search input and type/tag selects', async () => {
    render(<SearchFacets onResults={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search media…')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'nature' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'IMAGE' })).toBeInTheDocument()
  })

  it('calls onResults with search hits when user types and presses Enter', async () => {
    const onResults = vi.fn()
    render(<SearchFacets onResults={onResults} onClear={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search media…')
    fireEvent.change(input, { target: { value: 'sky' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onResults).toHaveBeenCalledWith(
        expect.objectContaining({
          hits: [expect.objectContaining({ id: 'm1', name: 'sky.jpg' })],
          pagination: { total: 1, page: 1, limit: 24, pages: 1 },
        })
      )
    })
  })

  it('shows result count after search', async () => {
    render(<SearchFacets onResults={vi.fn()} onClear={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search media…')
    fireEvent.change(input, { target: { value: 'sky' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByText(/1 result/)).toBeInTheDocument()
    })
  })

  it('activates search when type filter changes', async () => {
    const onResults = vi.fn()
    render(<SearchFacets onResults={onResults} onClear={vi.fn()} />)
    // First combobox is type filter, second is tag filter
    const typeSelect = screen.getAllByRole('combobox')[0]!
    fireEvent.change(typeSelect, { target: { value: 'IMAGE' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/media/search',
        expect.objectContaining({ params: expect.objectContaining({ type: 'IMAGE' }) })
      )
    })
  })

  it('calls onClear and hides clear button when cleared', async () => {
    const onClear = vi.fn()
    render(<SearchFacets onResults={vi.fn()} onClear={onClear} />)
    const input = screen.getByPlaceholderText('Search media…')
    fireEvent.change(input, { target: { value: 'sky' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByTitle('Clear search')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Clear search'))
    expect(onClear).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByTitle('Clear search')).not.toBeInTheDocument())
  })
})

// ─── ChunkedUploadDialog ──────────────────────────────────────────────────────

function makeFile(name: string, sizeBytes: number): File {
  const buf = new Uint8Array(sizeBytes).fill(65)
  return new File([buf], name, { type: 'image/jpeg' })
}

const UPLOAD_ID = 'upload-abc123'

function setupApiForChunk({ receivedParts = [] as number[] } = {}) {
  vi.mocked(api.post).mockImplementation((url: string) => {
    if (url === '/media/upload/chunked/init')
      return Promise.resolve({
        data: { data: { upload_id: UPLOAD_ID, total_parts: 2 } },
      }) as ReturnType<typeof api.post>
    if (url.includes('/complete'))
      return Promise.resolve({
        data: { data: { media: { id: 'm99', original_name: 'big.jpg' } } },
      }) as ReturnType<typeof api.post>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.post>
  })
  vi.mocked(api.put).mockResolvedValue({ data: { data: {} } } as never)
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/status'))
      return Promise.resolve({
        data: {
          data: {
            upload_id: UPLOAD_ID,
            filename: 'big.jpg',
            size: 6 * 1024 * 1024,
            total_parts: 2,
            received_parts: receivedParts,
            complete: false,
          },
        },
      }) as ReturnType<typeof api.get>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

describe('ChunkedUploadDialog (KDL-119 A8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with filename', () => {
    setupApiForChunk()
    const file = makeFile('big.jpg', 6 * 1024 * 1024) // 6MB → 2 chunks
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/big\.jpg/)).toBeInTheDocument()
  })

  it('inits with size+mime+total_parts, PUTs each part, then completes', async () => {
    setupApiForChunk()
    const file = makeFile('big.jpg', 6 * 1024 * 1024)
    const onComplete = vi.fn()
    render(
      <ChunkedUploadDialog
        files={[file]}
        folderId={null}
        onComplete={onComplete}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/media/upload/chunked/init',
        expect.objectContaining({
          filename: 'big.jpg',
          size: 6 * 1024 * 1024,
          mime_type: 'image/jpeg',
          total_parts: 2,
        })
      )
    })
    await waitFor(
      () => {
        expect(api.put).toHaveBeenCalledTimes(2) // parts 0 and 1
        const postCalls = vi.mocked(api.post).mock.calls.map(([url]) => String(url))
        expect(postCalls).toContain(`/media/upload/chunked/${UPLOAD_ID}/complete`)
        expect(onComplete).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })

  it('resumes: skips parts the server already has (received_parts)', async () => {
    setupApiForChunk({ receivedParts: [0] }) // part 0 already on server
    const file = makeFile('big.jpg', 6 * 1024 * 1024) // 2 parts total
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    await waitFor(
      () => {
        // only part 1 uploaded — index param says which
        expect(api.put).toHaveBeenCalledTimes(1)
        expect(api.put).toHaveBeenCalledWith(
          `/media/upload/chunked/${UPLOAD_ID}/part`,
          expect.anything(),
          expect.objectContaining({ params: { index: '1' } })
        )
      },
      { timeout: 3000 }
    )
  })

  it('shows error state when upload fails', async () => {
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/media/upload/chunked/init')
        return Promise.resolve({
          data: { data: { upload_id: UPLOAD_ID, total_parts: 2 } },
        }) as ReturnType<typeof api.post>
      return Promise.reject({ response: { data: { message: 'Server error' } } })
    })
    vi.mocked(api.get).mockRejectedValue(new Error('no session'))
    vi.mocked(api.put).mockRejectedValue({ response: { data: { message: 'Server error' } } })
    const file = makeFile('bad.jpg', 6 * 1024 * 1024)
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    await waitFor(
      () => {
        expect(screen.getByText('Server error')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('does not call onComplete when a file failed', async () => {
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/media/upload/chunked/init')
        return Promise.reject({ response: { data: { message: 'File type not allowed' } } })
      return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.post>
    })
    vi.mocked(api.get).mockRejectedValue(new Error('no session'))
    const onComplete = vi.fn()
    const file = makeFile('bad.exe', 6 * 1024 * 1024)
    render(
      <ChunkedUploadDialog
        files={[file]}
        folderId={null}
        onComplete={onComplete}
        onClose={vi.fn()}
      />
    )
    await waitFor(
      () => {
        expect(screen.getByText('File type not allowed')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    expect(onComplete).not.toHaveBeenCalled()
  })
})
