import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../rtl/utils';
import MediaPage from '@/app/admin/media/page';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import api from '@/lib/axios';

const imageMedia = {
  id: 'm1',
  user_id: 'u1',
  filename: 'a.png',
  original_name: 'a.png',
  mime_type: 'image/png',
  size: 1024,
  bucket: 'media',
  path: 'a.png',
  url: 'http://localhost:9000/a.png',
  created_at: '2026-01-01T00:00:00.000Z',
};

const nullUrlMedia = {
  id: 'm2',
  user_id: 'u1',
  filename: 'b.pdf',
  original_name: 'b.pdf',
  mime_type: 'application/pdf',
  size: 2048,
  bucket: 'media',
  path: 'b.pdf',
  url: null,
  created_at: '2026-01-02T00:00:00.000Z',
};

function mockMedia(media: unknown[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/auth/me/permissions') {
      return Promise.resolve({
        data: { data: { permissions: ['media:view', 'media:create', 'media:delete'], roles: ['admin'], bypass: false } },
      } as any);
    }
    return Promise.resolve({
      data: { data: { media, pagination: { total: media.length, pages: 1 } } },
    } as any);
  });
}

describe('MediaPage regression — nullable URL guard (KDL-20 H5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'access-token',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders image preview when URL is present', async () => {
    mockMedia([imageMedia]);
    render(<MediaPage />);

    await waitFor(() => {
      expect(screen.getByAltText('a.png')).toHaveAttribute(
        'src',
        'http://localhost:9000/a.png'
      );
    });
  });

  it('renders Open link for non-image URL', async () => {
    mockMedia([
      { ...imageMedia, id: 'm3', mime_type: 'application/pdf', url: 'http://localhost:9000/b.pdf' },
    ]);
    render(<MediaPage />);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /open/i });
      expect(link).toHaveAttribute('href', 'http://localhost:9000/b.pdf');
    });
  });

  it('renders em dash when URL is null', async () => {
    mockMedia([nullUrlMedia]);
    render(<MediaPage />);

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });
});
