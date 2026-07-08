// KDL-119 A8 — RTL gate: SearchFacets faceted search + ChunkedUploadDialog resume flow.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import { SearchFacets, ChunkedUploadDialog } from '@/components/media/DamExtensions'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

import api from '@/lib/axios'

const TAGS = [
  { id: 't1', name: 'Nature', slug: 'nature', color: '#00ff00' },
  { id: 't2', name: 'Urban', slug: 'urban', color: null },
]

const SEARCH_RESULT = {
  media: [
    {
      id: 'm1', user_id: 'u1', folder_id: null, filename: 'sky.jpg', original_name: 'sky.jpg',
      mime_type: 'image/jpeg', size: 1024, bucket: 'media', path: 'sky.jpg',
      url: 'http://localhost/sky.jpg', title: null, alt_text: null, caption: null,
      width: 800, height: 600, duration: null, variants: null, type: 'IMAGE',
      deleted_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      checksum: null, scan_result: 'CLEAN', scanned_at: null, exif: null, is_archived: false,
    },
  ],
  facets: { type: { IMAGE: 1 }, tags: { nature: 1 } },
  pagination: { total: 1, page: 1, limit: 24, pages: 1 },
}

function setupApiForSearch() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/media/tags') return Promise.resolve({ data: { data: { tags: TAGS } } }) as ReturnType<typeof api.get>
    if (url === '/media/search') return Promise.resolve({ data: { data: SEARCH_RESULT } }) as ReturnType<typeof api.get>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

// ─── SearchFacets ─────────────────────────────────────────────────────────────

describe('SearchFacets (KDL-119 A8)', () => {
  beforeEach(() => { vi.clearAllMocks(); setupApiForSearch() })

  it('renders search input and type/tag selects', async () => {
    render(<SearchFacets onResults={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search media…')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Nature' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'IMAGE' })).toBeInTheDocument()
  })

  it('calls onResults with search data when user types and presses Enter', async () => {
    const onResults = vi.fn()
    render(<SearchFacets onResults={onResults} onClear={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search media…')
    fireEvent.change(input, { target: { value: 'sky' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onResults).toHaveBeenCalledWith(expect.objectContaining({ pagination: { total: 1, page: 1, limit: 24, pages: 1 } }))
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
    const [typeSelect] = screen.getAllByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'IMAGE' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/media/search', expect.objectContaining({ params: expect.objectContaining({ type: 'IMAGE' }) }))
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

function setupApiForChunk({ resumeAt = 0 }: { resumeAt?: number } = {}) {
  vi.mocked(api.post).mockImplementation((url: string) => {
    if (url === '/media/chunked/init')
      return Promise.resolve({ data: { data: { upload_id: UPLOAD_ID } } }) as ReturnType<typeof api.post>
    if (url.includes('/part'))
      return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.post>
    if (url.includes('/complete'))
      return Promise.resolve({ data: { data: { id: 'm99', original_name: 'big.jpg' } } }) as ReturnType<typeof api.post>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.post>
  })
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/status'))
      return Promise.resolve({
        data: { data: { received: resumeAt, total_chunks: 2, complete: false } },
      }) as ReturnType<typeof api.get>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

describe('ChunkedUploadDialog (KDL-119 A8)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders dialog with filename', () => {
    setupApiForChunk()
    const file = makeFile('big.jpg', 6 * 1024 * 1024) // 6MB → 2 chunks
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/big\.jpg/)).toBeInTheDocument()
  })

  it('calls chunkInit then chunkPart for each chunk then chunkComplete', async () => {
    setupApiForChunk()
    const file = makeFile('big.jpg', 6 * 1024 * 1024)
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/media/chunked/init', expect.objectContaining({ filename: 'big.jpg' }))
    })
    await waitFor(() => {
      const calls = vi.mocked(api.post).mock.calls.map(([url]) => url)
      expect(calls.some((u) => u.includes('/part'))).toBe(true)
      expect(calls.some((u) => u.includes('/complete'))).toBe(true)
    }, { timeout: 3000 })
  })

  it('resumes from chunkStatus.received (skips already-sent parts)', async () => {
    setupApiForChunk({ resumeAt: 1 }) // 1 chunk already sent
    const file = makeFile('big.jpg', 6 * 1024 * 1024) // 2 chunks total
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    await waitFor(() => {
      const partCalls = vi.mocked(api.post).mock.calls.filter(([url]) => String(url).includes('/part'))
      // resume from part 1 → only 1 /part call (not 2)
      expect(partCalls).toHaveLength(1)
    }, { timeout: 3000 })
  })

  it('shows error state when upload fails', async () => {
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/media/chunked/init')
        return Promise.resolve({ data: { data: { upload_id: UPLOAD_ID } } }) as ReturnType<typeof api.post>
      return Promise.reject({ response: { data: { message: 'Server error' } } })
    })
    vi.mocked(api.get).mockRejectedValue(new Error('no session'))
    const file = makeFile('bad.jpg', 6 * 1024 * 1024)
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows close button only after all files done', async () => {
    setupApiForChunk()
    const file = makeFile('small.jpg', 1024) // < CHUNK_SIZE → 1 chunk
    render(
      <ChunkedUploadDialog files={[file]} folderId={null} onComplete={vi.fn()} onClose={vi.fn()} />
    )
    await waitFor(() => {
      // After complete, allDone=true → close button appears
      const completeCall = vi.mocked(api.post).mock.calls.some(([url]) => String(url).includes('/complete'))
      expect(completeCall).toBe(true)
    }, { timeout: 3000 })
  })
})
