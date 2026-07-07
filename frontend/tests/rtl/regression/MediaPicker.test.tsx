import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../rtl/utils';
import { MediaPicker } from '@/components/shared/MediaPicker';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import api from '@/lib/axios';

const imageMedia = {
  id: 'm1',
  user_id: 'u1',
  folder_id: null,
  filename: 'photo.jpg',
  original_name: 'photo.jpg',
  mime_type: 'image/jpeg',
  size: 2048,
  bucket: 'media',
  path: 'u1/photo.jpg',
  url: 'http://localhost:9000/photo.jpg',
  title: null,
  alt_text: null,
  caption: null,
  width: 800,
  height: 600,
  duration: null,
  variants: { thumb: 'http://localhost:9000/thumb.webp' },
  type: 'IMAGE' as const,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function setupAuth() {
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', name: 'Test', email: 't@t.com', is_active: true } as any });
}

function mockApiMedia(media: unknown[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/auth/me/permissions') {
      return Promise.resolve({
        data: { data: { permissions: ['media:view', 'media:add'], roles: ['admin'], bypass: false } },
      } as any);
    }
    if (url === '/media') {
      return Promise.resolve({
        data: { data: { media } },
      } as any);
    }
    return Promise.resolve({ data: { data: {} } } as any);
  });
}

describe('MediaPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('renders dialog when open', async () => {
    mockApiMedia([]);
    render(<MediaPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('Select Media')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    mockApiMedia([]);
    render(<MediaPicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByText('Select Media')).not.toBeInTheDocument();
  });

  it('shows media items after loading', async () => {
    mockApiMedia([imageMedia]);
    render(<MediaPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
  });

  it('calls onSelect with selected media on confirm', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    mockApiMedia([imageMedia]);
    render(<MediaPicker open={true} onClose={onClose} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('photo.jpg'));
    fireEvent.click(screen.getByText('photo.jpg'));
    // Click the confirm button (shows "Select (1)" after selection)
    const confirmBtn = screen.getByRole('button', { name: /^Select \(1\)/ })
    fireEvent.click(confirmBtn);

    expect(onSelect).toHaveBeenCalledWith([imageMedia]);
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel closes without calling onSelect', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    mockApiMedia([imageMedia]);
    render(<MediaPicker open={true} onClose={onClose} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows empty state when no media', async () => {
    mockApiMedia([]);
    render(<MediaPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/No files/)).toBeInTheDocument();
    });
  });

  it('applies typeFilter to query params', async () => {
    mockApiMedia([]);
    render(<MediaPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} typeFilter="IMAGE" />);
    await waitFor(() => {
      const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/media');
      expect(call?.[1]?.params?.type).toBe('IMAGE');
    });
  });
});
