import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../rtl/utils'
import MediaPage from '@/app/admin/media/page'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import api from '@/lib/axios'

const imageMedia = {
  id: 'm1',
  user_id: 'u1',
  folder_id: null,
  filename: 'a.png',
  original_name: 'a.png',
  mime_type: 'image/png',
  size: 1024,
  bucket: 'media',
  path: 'a.png',
  url: 'http://localhost:9000/a.png',
  title: null,
  alt_text: null,
  caption: null,
  width: 800,
  height: 600,
  duration: null,
  variants: null,
  type: 'IMAGE',
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const nullUrlMedia = {
  id: 'm2',
  user_id: 'u1',
  folder_id: null,
  filename: 'b.pdf',
  original_name: 'b.pdf',
  mime_type: 'application/pdf',
  size: 2048,
  bucket: 'media',
  path: 'b.pdf',
  url: null,
  title: null,
  alt_text: null,
  caption: null,
  width: null,
  height: null,
  duration: null,
  variants: null,
  type: 'DOCUMENT',
  deleted_at: null,
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}

function mockMedia(media: unknown[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/auth/me/permissions') {
      return Promise.resolve({
        data: {
          data: {
            permissions: ['media:view', 'media:add', 'media:delete'],
            roles: ['admin'],
            bypass: false,
          },
        },
      } as any)
    }
    if (url === '/media/folders') {
      return Promise.resolve({ data: { data: { folders: [] } } } as any)
    }
    if (url === '/media/trash') {
      return Promise.resolve({ data: { data: { media: [] } } } as any)
    }
    return Promise.resolve({
      data: { data: { media, pagination: { total: media.length, pages: 1 } } },
    } as any)
  })
}

describe('MediaPage regression — nullable URL guard (KDL-20 H5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      accessToken: 'access-token',
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('renders image thumbnail when URL is present (KDL-20)', async () => {
    mockMedia([imageMedia])
    render(<MediaPage />)

    await waitFor(() => {
      expect(screen.getByAltText('a.png')).toHaveAttribute('src', 'http://localhost:9000/a.png')
    })
  })

  it('renders non-image file without crashing when url is non-null (KDL-20 H5)', async () => {
    mockMedia([
      {
        ...imageMedia,
        id: 'm3',
        mime_type: 'application/pdf',
        type: 'DOCUMENT',
        url: 'http://localhost:9000/b.pdf',
        original_name: 'report.pdf',
      },
    ])
    render(<MediaPage />)

    // Page renders without crash — file name visible
    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument()
    })
  })

  it('renders file without crashing when URL is null (KDL-20 H5)', async () => {
    mockMedia([nullUrlMedia])
    render(<MediaPage />)

    // Page renders without crash — file name visible
    await waitFor(() => {
      expect(screen.getByText('b.pdf')).toBeInTheDocument()
    })
  })
})
