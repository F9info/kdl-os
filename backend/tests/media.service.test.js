import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/shared/services/storage.service.js', () => ({
  uploadFile: vi.fn(),
  getFileUrl: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    media: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '../src/config/database.js';
import { listMedia, getMediaById } from '../src/modules/media/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

describe('media service regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates fresh presigned URLs on every list call instead of storing them (KDL-14 MEDIUM)', async () => {
    const records = [
      { id: 'm1', path: 'u1/a.png', original_name: 'a.png' },
      { id: 'm2', path: 'u1/b.png', original_name: 'b.png' },
    ];
    prismaMock.media.findMany.mockResolvedValue(records);
    prismaMock.media.count.mockResolvedValue(2);

    const { getFileUrl } = await import('../src/shared/services/storage.service.js');
    let counter = 0;
    vi.mocked(getFileUrl).mockImplementation(() => Promise.resolve(`url-${++counter}`));

    const result = await listMedia('u1', { page: 1, limit: 10 });

    expect(result.media).toHaveLength(2);
    expect(result.media[0].url).toBe('url-1');
    expect(result.media[1].url).toBe('url-2');
    expect(getFileUrl).toHaveBeenCalledTimes(2);
    expect(getFileUrl).toHaveBeenNthCalledWith(1, 'u1/a.png');
    expect(getFileUrl).toHaveBeenNthCalledWith(2, 'u1/b.png');
    for (const m of records) {
      expect(m).not.toHaveProperty('url');
    }
  });

  it('returns null when media not found', async () => {
    prismaMock.media.findFirst.mockResolvedValue(null);
    const result = await getMediaById('missing', 'u1');
    expect(result).toBeNull();
  });
});
