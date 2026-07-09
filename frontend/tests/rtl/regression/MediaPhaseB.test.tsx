// KDL-120 B7 — RTL gate: Phase B frontend components
//   MediaImage      — lazy picture/source srcset (B3)
//   WorkflowBadge   — status badge + transition buttons (B6)
//   CommentsThread  — list, post, delete comments (B5)
//   ShareDialog     — list shares, create share link (B4)
//   VersionHistoryPanel — list versions, restore (B5)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import { MediaImage } from '@/components/media/MediaImage'
import { WorkflowBadge } from '@/components/media/WorkflowBadge'
import { CommentsThread } from '@/components/media/CommentsThread'
import { ShareDialog } from '@/components/media/ShareDialog'
import { VersionHistoryPanel } from '@/components/media/VersionHistoryPanel'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

import api from '@/lib/axios'
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
}

// ─── MediaImage (B3) ─────────────────────────────────────────────────────────

describe('MediaImage (B3)', () => {
  it('renders picture with avif + webp sources and lazy img', () => {
    render(<MediaImage id="m1" alt="test" />)
    const img = screen.getByRole('img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
    // img src uses jpg format
    expect(img.getAttribute('src')).toContain('/api/media/m1/t?')
    expect(img.getAttribute('src')).toContain('format=jpg')
    // picture element must exist wrapping the img
    const picture = img.closest('picture')
    expect(picture).toBeTruthy()
    // both avif and webp sources
    const sources = picture!.querySelectorAll('source')
    const types = Array.from(sources).map((s) => s.getAttribute('type'))
    expect(types).toContain('image/avif')
    expect(types).toContain('image/webp')
    // srcsets contain 400, 800, 1200, 1600 breakpoints
    const webpSource = Array.from(sources).find((s) => s.getAttribute('type') === 'image/webp')
    const srcset = webpSource?.getAttribute('srcset') ?? ''
    expect(srcset).toContain('400w')
    expect(srcset).toContain('1600w')
    expect(srcset).toContain('format=webp')
  })

  it('passes className and dimensions to the img', () => {
    const { container } = render(<MediaImage id="m2" alt="" className="rounded" width={640} height={480} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('width')).toBe('640')
    expect(img.getAttribute('height')).toBe('480')
    expect(img.className).toContain('rounded')
  })
})

// ─── WorkflowBadge (B6) ──────────────────────────────────────────────────────

describe('WorkflowBadge (B6)', () => {
  it('renders status badge text', () => {
    render(<WorkflowBadge status="DRAFT" mediaId="m1" />)
    expect(screen.getByText('DRAFT')).toBeTruthy()
  })

  it('shows no action button when no transitions allowed (ARCHIVED)', () => {
    const { container } = render(<WorkflowBadge status="ARCHIVED" mediaId="m1" />)
    expect(container.querySelector('button[title="Workflow actions"]')).toBeNull()
  })

  it('renders transition dropdown trigger for DRAFT status', () => {
    render(<WorkflowBadge status="DRAFT" mediaId="m1" permissions={['media:review:submit']} />)
    const trigger = screen.getByTitle('Workflow actions')
    expect(trigger).toBeTruthy()
  })

  it('opens dropdown and shows transition options on click', async () => {
    render(<WorkflowBadge status="REVIEW" mediaId="m1" permissions={['media:review:approve', 'media:review:reject']} />)
    const trigger = screen.getByTitle('Workflow actions')
    fireEvent.click(trigger)
    expect(screen.getByText('Approve')).toBeTruthy()
    expect(screen.getByText('Reject')).toBeTruthy()
  })

  it('calls PATCH workflow on transition click', async () => {
    mockApi.patch.mockResolvedValue({ data: { data: { workflow_status: 'APPROVED' } } })
    render(<WorkflowBadge status="REVIEW" mediaId="m1" permissions={['media:review:approve']} />)
    fireEvent.click(screen.getByTitle('Workflow actions'))
    fireEvent.click(screen.getByText('Approve'))
    await waitFor(() => expect(mockApi.patch).toHaveBeenCalledWith('/media/m1/workflow', { status: 'APPROVED' }))
  })
})

// ─── CommentsThread (B5) ─────────────────────────────────────────────────────

const COMMENTS = [
  { id: 'c1', user_id: 'u1', user: { id: 'u1', name: 'Alice' }, body: 'Great shot', created_at: '2026-01-01T10:00:00Z' },
  { id: 'c2', user_id: 'u2', user: { id: 'u2', name: 'Bob' }, body: 'Thanks!', created_at: '2026-01-01T11:00:00Z' },
]

describe('CommentsThread (B5)', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: { data: { comments: COMMENTS } } })
  })

  it('renders comments after loading', async () => {
    render(<CommentsThread mediaId="m1" currentUserId="u1" />)
    await waitFor(() => expect(screen.getByText('Great shot')).toBeTruthy())
    expect(screen.getByText('Thanks!')).toBeTruthy()
  })

  it('shows user names', async () => {
    render(<CommentsThread mediaId="m1" currentUserId="u1" />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
  })

  it('submits a new comment on form submit', async () => {
    const newComment = { id: 'c3', user_id: 'u1', user: { id: 'u1', name: 'Alice' }, body: 'Nice!', created_at: '2026-01-01T12:00:00Z' }
    mockApi.post.mockResolvedValue({ data: { data: { comment: newComment } } })
    render(<CommentsThread mediaId="m1" currentUserId="u1" />)
    await waitFor(() => screen.getByText('Great shot'))
    const textarea = screen.getByPlaceholderText(/comment/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Nice!' } })
    // Submit via the button
    const btn = screen.getByRole('button', { name: /send|post|submit/i })
    fireEvent.click(btn)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/media/m1/comments', { body: 'Nice!' }))
  })

  it('shows delete button only for own comments', async () => {
    render(<CommentsThread mediaId="m1" currentUserId="u1" />)
    await waitFor(() => screen.getByText('Great shot'))
    const deleteButtons = screen.getAllByRole('button', { name: /delete|trash/i })
    // u1 owns c1 only → 1 delete button
    expect(deleteButtons.length).toBe(1)
  })
})

// ─── ShareDialog (B4) ────────────────────────────────────────────────────────

const SHARES = [
  {
    id: 's1',
    token: 'tok1',
    has_password: false,
    expires_at: null,
    max_downloads: null,
    download_count: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
]

describe('ShareDialog (B4)', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: { data: { shares: SHARES } } })
    mockApi.post.mockResolvedValue({
      data: {
        data: {
          share: { id: 's2', token: 'tok2', has_password: false, expires_at: null, max_downloads: null, download_count: 0, created_at: '2026-01-02T00:00:00Z' },
        },
      },
    })
    mockApi.delete.mockResolvedValue({ data: {} })
  })

  it('renders when open', async () => {
    render(<ShareDialog mediaId="m1" mediaName="test.jpg" open onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('lists existing shares', async () => {
    render(<ShareDialog mediaId="m1" mediaName="test.jpg" open onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText(/tok1|2 download/i)).toBeTruthy())
  })

  it('opens create form and submits a new share', async () => {
    render(<ShareDialog mediaId="m1" mediaName="test.jpg" open onClose={() => {}} />)
    await waitFor(() => screen.getByText(/tok1|download/i))
    const addBtn = screen.getByRole('button', { name: /new|create|add|link/i })
    fireEvent.click(addBtn)
    const createBtn = screen.getByRole('button', { name: /create|generate|save/i })
    fireEvent.click(createBtn)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalled())
  })
})

// ─── VersionHistoryPanel (B5) ────────────────────────────────────────────────

const VERSIONS = [
  { id: 'v1', version_number: 1, size: 1024, note: 'Initial', created_at: '2026-01-01T00:00:00Z', download_url: '/dl/v1', mime_type: 'image/png' },
  { id: 'v2', version_number: 2, size: 2048, note: 'Updated', created_at: '2026-01-02T00:00:00Z', download_url: '/dl/v2', mime_type: 'image/png' },
]

describe('VersionHistoryPanel (B5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: { data: { versions: VERSIONS } } })
    mockApi.post.mockResolvedValue({ data: { data: { restored: true } } })
  })

  it('lists versions after loading', async () => {
    render(<VersionHistoryPanel mediaId="m1" />)
    await waitFor(() => expect(screen.getAllByText(/Initial/i).length).toBeGreaterThan(0))
    expect(screen.getAllByText(/Updated/i).length).toBeGreaterThan(0)
  })

  it('shows restore button for each version', async () => {
    render(<VersionHistoryPanel mediaId="m1" />)
    await waitFor(() => screen.getByText(/Initial/i))
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i })
    expect(restoreButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('calls POST restore on restore click', async () => {
    render(<VersionHistoryPanel mediaId="m1" />)
    await waitFor(() => screen.getByText(/Initial/i))
    const [firstRestore] = screen.getAllByRole('button', { name: /restore/i })
    fireEvent.click(firstRestore!)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalled())
    const call = mockApi.post.mock.calls[0] as string[]
    expect(call[0]).toMatch(/\/media\/m1\/versions\/.+\/restore/)
  })
})
