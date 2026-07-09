import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { getObjectMock, putObjectMock } = vi.hoisted(() => ({
  getObjectMock: vi.fn(),
  putObjectMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: { findUnique: vi.fn() },
  },
}));

// Mock the minio client used by the transform service
vi.mock('../../src/config/minio.js', () => ({
  minio: {
    getObject: getObjectMock,
    putObject: putObjectMock,
  },
}));

// Sharp must produce a real buffer — use a tiny 1×1 webp stub
vi.mock('sharp', () => {
  const chain = {
    resize: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('FAKEIMG')),
  };
  return { default: vi.fn(() => chain) };
});

import { prisma } from '../../src/config/database.js';
import { transformMedia, buildSrcset } from '../../src/modules/media/transform.service.js';

const MEDIA = {
  id: 'med001',
  bucket: 'media',
  path: 'uploads/img.png',
  workflow_status: 'PUBLISHED',
  type: 'IMAGE',
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.media.findUnique.mockResolvedValue(MEDIA);
  getObjectMock.mockRejectedValue(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }));
  putObjectMock.mockResolvedValue(null);
});

describe('transformMedia', () => {
  it('throws 404 when media not found', async () => {
    prisma.media.findUnique.mockResolvedValue(null);
    await expect(transformMedia('none', { format: 'webp' })).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 for unsupported format', async () => {
    await expect(transformMedia('med001', { format: 'bmp' })).rejects.toMatchObject({ status: 400 });
  });

  it('returns buffer with fromCache=false on first transform (cache miss)', async () => {
    getObjectMock
      .mockRejectedValueOnce(new Error('miss'))  // cache miss
      .mockResolvedValueOnce(Buffer.from('ORIG')); // original fetch
    const result = await transformMedia('med001', { format: 'webp', w: '400' });
    expect(result.fromCache).toBe(false);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it('returns fromCache=true when cache bucket has the object', async () => {
    getObjectMock.mockResolvedValue(Buffer.from('CACHED'));
    const result = await transformMedia('med001', { format: 'webp' });
    expect(result.fromCache).toBe(true);
    expect(result.buffer).toEqual(Buffer.from('CACHED'));
  });

  it('caps width at 4096', async () => {
    getObjectMock
      .mockRejectedValueOnce(new Error('miss'))
      .mockResolvedValueOnce(Buffer.from('ORIG'));
    // Should not throw for huge w — capped internally
    await expect(transformMedia('med001', { format: 'webp', w: '99999' })).resolves.toBeDefined();
  });

  it('clamps quality between 1 and 100', async () => {
    getObjectMock
      .mockRejectedValueOnce(new Error('miss'))
      .mockResolvedValueOnce(Buffer.from('ORIG'));
    // q=-5 should be clamped to 1, not throw
    await expect(transformMedia('med001', { format: 'webp', q: '-5' })).resolves.toBeDefined();
  });

  it('throws 403 for non-published media accessed without actor', async () => {
    prisma.media.findUnique.mockResolvedValue({ ...MEDIA, workflow_status: 'REVIEW' });
    await expect(transformMedia('med001', { format: 'webp' }, null)).rejects.toMatchObject({ status: 403 });
  });

  it('allows non-published media when actorId is provided', async () => {
    prisma.media.findUnique.mockResolvedValue({ ...MEDIA, workflow_status: 'REVIEW' });
    getObjectMock
      .mockRejectedValueOnce(new Error('miss'))
      .mockResolvedValueOnce(Buffer.from('ORIG'));
    await expect(transformMedia('med001', { format: 'webp' }, 'user1')).resolves.toBeDefined();
  });
});

describe('buildSrcset', () => {
  it('returns a string with 4 width entries', () => {
    const srcset = buildSrcset('med001', 'http://localhost:4000');
    const parts = srcset.split(', ');
    expect(parts).toHaveLength(4);
  });

  it('includes w=400 w=800 w=1200 w=1600 descriptors', () => {
    const srcset = buildSrcset('med001', 'http://localhost:4000');
    expect(srcset).toContain('w=400');
    expect(srcset).toContain('w=800');
    expect(srcset).toContain('w=1200');
    expect(srcset).toContain('w=1600');
    expect(srcset).toContain('400w');
    expect(srcset).toContain('1600w');
  });

  it('includes format=webp in all entries', () => {
    const srcset = buildSrcset('med001', 'http://localhost:4000');
    const parts = srcset.split(', ');
    parts.forEach((part) => expect(part).toContain('format=webp'));
  });

  it('encodes the media id in each URL', () => {
    const srcset = buildSrcset('med001', 'http://localhost:4000');
    const parts = srcset.split(', ');
    parts.forEach((part) => expect(part).toContain('med001'));
  });
});
