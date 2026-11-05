import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import {
  PublishStatus,
  VersionsButton,
  publishLabel,
} from '@/app/admin/page-builder/PublishControls'
import type { PageRecord } from '@/app/admin/page-builder/store'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, post: h.post, put: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

const page = (over: Partial<PageRecord> = {}): PageRecord => ({
  id: 'pg1',
  slug: 's',
  title: 'T',
  data: { root: { props: {} }, content: [] },
  status: 'PUBLISHED',
  updatedAt: '',
  projectId: 'p',
  liveVersion: 3,
  hasUnpublishedChanges: false,
  ...over,
})

const versions = [
  {
    id: 'v3',
    version: 3,
    title: 'T',
    note: null,
    created_at: '2026-11-05T10:00:00Z',
    is_live: true,
  },
  {
    id: 'v2',
    version: 2,
    title: 'T',
    note: 'Restored from v1',
    created_at: '2026-11-04T10:00:00Z',
    is_live: false,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  h.get.mockResolvedValue({ data: { data: { versions } } })
  h.post.mockResolvedValue({ data: { data: {} } })
})

describe('publishLabel (T6.2)', () => {
  it('Draft, Published vN, and unpublished changes', () => {
    expect(publishLabel(page({ status: 'DRAFT', liveVersion: null }))).toEqual({
      text: 'Draft',
      tone: 'muted',
    })
    expect(publishLabel(page())).toEqual({ text: 'Published v3', tone: 'ok' })
    expect(publishLabel(page({ hasUnpublishedChanges: true }))).toEqual({
      text: 'Published v3 · unpublished changes',
      tone: 'warn',
    })
    expect(publishLabel(page({ liveVersion: null })).text).toBe('Published')
  })

  it('renders as a status badge', () => {
    render(<PublishStatus page={page({ hasUnpublishedChanges: true })} />)
    expect(screen.getByTestId('publish-status').textContent).toContain('unpublished changes')
  })
})

describe('VersionsButton (T6.2)', () => {
  const open = async (p = page()) => {
    render(<VersionsButton page={p} />)
    fireEvent.click(screen.getByRole('button', { name: /versions/i }))
    await screen.findByText('v3')
  }

  it('lists versions, marks the live one, and only older ones can be restored', async () => {
    await open()
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(1)
    expect(screen.getByText(/Restored from v1/)).toBeTruthy()
  })

  it('restore asks for confirmation, then calls the restore endpoint', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(await screen.findByText(/goes live now, as a new version/i)).toBeTruthy()
    expect(h.post).not.toHaveBeenCalled()
    const confirm = screen.getAllByRole('button', { name: 'Restore' }).at(-1)!
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/page-builder/pg1/versions/v2/restore')
    )
  })

  it('unpublish asks for confirmation, then calls the unpublish endpoint', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /unpublish page/i }))
    expect(await screen.findByText(/visitors will get a 404/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    await waitFor(() => expect(h.post).toHaveBeenCalledWith('/page-builder/pg1/unpublish'))
  })

  it('a draft page has no Unpublish button and says so when there are no versions', async () => {
    h.get.mockResolvedValue({ data: { data: { versions: [] } } })
    render(<VersionsButton page={page({ status: 'DRAFT', liveVersion: null })} />)
    fireEvent.click(screen.getByRole('button', { name: /versions/i }))
    expect(await screen.findByText(/not published yet/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /unpublish page/i })).toBeNull()
  })
})
