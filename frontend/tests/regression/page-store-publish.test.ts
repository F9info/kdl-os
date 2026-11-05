import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Data } from '@puckeditor/core'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: h }))

import { autosavePage, getPage, publishPage } from '@/app/admin/page-builder/store'

const data = { root: { props: { title: 'Home' } }, content: [] } as unknown as Data

beforeEach(() => {
  vi.clearAllMocks()
  h.post.mockResolvedValue({ data: { data: {} } })
  h.put.mockResolvedValue({ data: { data: {} } })
})

describe('page store: draft vs publish (T6.2)', () => {
  it('autosave only writes the draft content (no status, no title)', async () => {
    await autosavePage('p1', data)
    expect(h.put).toHaveBeenCalledWith('/page-builder/p1', { data })
    expect(h.post).not.toHaveBeenCalled()
  })

  it('publish posts the content and the title from the page root to /publish', async () => {
    await publishPage('p1', data)
    expect(h.post).toHaveBeenCalledWith('/page-builder/p1/publish', { title: 'Home', data })
    expect(h.put).not.toHaveBeenCalled()
  })

  it('getPage maps the publish state from the API', async () => {
    h.get.mockResolvedValue({
      data: {
        data: {
          page: {
            id: 'p1',
            slug: 's',
            title: 'Home',
            data,
            status: 'PUBLISHED',
            updated_at: 'x',
            project_id: 'pr',
            has_unpublished_changes: true,
            live_version: 4,
          },
        },
      },
    })
    expect(await getPage('p1')).toMatchObject({ hasUnpublishedChanges: true, liveVersion: 4 })
  })
})
