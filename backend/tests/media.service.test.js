import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/shared/services/storage.service.js', () => ({
  uploadFile: vi.fn(),
  getFileUrl: vi.fn(async (p) => `https://cdn/${p}`),
  deleteFile: vi.fn(),
  deleteFiles: vi.fn(),
}));

vi.mock('../src/modules/media/settings.js', () => ({
  getUploadSettings: vi.fn(async () => ({
    maxFileSizeMb: 10,
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedMimes: new Set(['image/jpeg', 'image/png', 'application/pdf']),
  })),
  isAiAutotagEnabled: vi.fn(async () => false),
}));

vi.mock('../src/modules/media/media.queue.js', () => ({
  enqueueVariantJob: vi.fn(),
  enqueueSearchIndexJob: vi.fn(),
  enqueueScanJob: vi.fn(async () => {}),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn(async () => ({ width: 800, height: 600 })),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(async () => Buffer.from('webp-data')),
  })),
}));

vi.mock('../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    media: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    mediaFolder: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mediaUsage: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    mediaShare: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../src/config/database.js';
import {
  listMedia, getMediaById, uploadMedia, resolveUrls,
  createFolder, updateFolder, deleteFolder, moveMedia,
  bulkDelete, listTrash, restoreTrash, purgeTrash,
  registerMediaUsage, releaseMediaUsage, getMediaUsage,
} from '../src/modules/media/service.js';
import { getFileUrl, deleteFiles } from '../src/shared/services/storage.service.js';
import { enqueueVariantJob } from '../src/modules/media/media.queue.js';

const prismaMock = vi.mocked(prisma, { deep: true });

describe('media service — regression + new', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Original regression: presigned URLs generated on every list ──────────
  it('generates fresh presigned URLs on every list call (KDL-14 MEDIUM)', async () => {
    const records = [
      { id: 'm1', path: 'u1/a.png', original_name: 'a.png', variants: null },
      { id: 'm2', path: 'u1/b.png', original_name: 'b.png', variants: null },
    ];
    prismaMock.media.findMany.mockResolvedValue(records);
    prismaMock.media.count.mockResolvedValue(2);
    let counter = 0;
    vi.mocked(getFileUrl).mockImplementation(async () => `url-${++counter}`);

    const result = await listMedia('u1', { page: 1, limit: 10 });
    expect(result.media).toHaveLength(2);
    expect(result.media[0].url).toBe('url-1');
    expect(result.media[1].url).toBe('url-2');
    expect(getFileUrl).toHaveBeenCalledTimes(2);
  });

  it('returns null when media not found', async () => {
    prismaMock.media.findFirst.mockResolvedValue(null);
    const result = await getMediaById('missing');
    expect(result).toBeNull();
  });

  // ── Upload: enqueues variant job for images ───────────────────────────────
  it('enqueues variant job on image upload', async () => {
    const file = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake'),
    };
    prismaMock.media.create.mockResolvedValue({ id: 'media1', path: 'u1/uuid.jpg', type: 'IMAGE', variants: null });
    await uploadMedia(file, 'u1', null);
    expect(enqueueVariantJob).toHaveBeenCalledWith('media1', expect.stringMatching(/^u1\/.+\.jpg$/), 'image/jpeg');
  });

  it('does not enqueue variant job for non-image uploads', async () => {
    const file = {
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('fake'),
    };
    prismaMock.media.create.mockResolvedValue({ id: 'media2', path: 'u1/yyy.pdf', type: 'DOCUMENT', variants: null });
    await uploadMedia(file, 'u1', null);
    expect(enqueueVariantJob).not.toHaveBeenCalled();
  });

  // ── Folder: cycle guard (move into own descendant) ────────────────────────
  it('rejects moving a folder into itself', async () => {
    prismaMock.mediaFolder.findUnique.mockResolvedValue({ id: 'f1', name: 'Root', parent_id: null });
    await expect(updateFolder('f1', { parent_id: 'f1' }, 'actor')).rejects.toMatchObject({ status: 422 });
  });

  it('rejects moving a folder into its own descendant', async () => {
    // f1 → f2 → f3; try to move f1 into f3
    prismaMock.mediaFolder.findUnique.mockImplementation(async ({ where: { id } }) => {
      const tree = { f1: { id: 'f1', parent_id: null }, f2: { id: 'f2', parent_id: 'f1' }, f3: { id: 'f3', parent_id: 'f2' } };
      return tree[id] ?? null;
    });
    prismaMock.mediaFolder.findMany.mockImplementation(async ({ where: { parent_id } }) => {
      const tree = { f1: [{ id: 'f2' }], f2: [{ id: 'f3' }], f3: [] };
      return tree[parent_id] ?? [];
    });
    await expect(updateFolder('f1', { parent_id: 'f3' }, 'actor')).rejects.toMatchObject({ status: 422 });
  });

  // ── Folder delete: 409 when not empty ────────────────────────────────────
  it('rejects non-empty folder delete without cascade', async () => {
    prismaMock.mediaFolder.findUnique.mockResolvedValue({
      id: 'f1', name: 'Pics', _count: { media: 3, children: 0 },
    });
    await expect(deleteFolder('f1', false, 'actor')).rejects.toMatchObject({ status: 409 });
  });

  it('allows cascade delete of non-empty folder', async () => {
    prismaMock.mediaFolder.findUnique.mockResolvedValue({
      id: 'f1', name: 'Pics', _count: { media: 3, children: 0 },
    });
    prismaMock.mediaFolder.findMany.mockResolvedValue([]); // no sub-folders
    prismaMock.media.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.mediaFolder.delete.mockResolvedValue({ id: 'f1' });
    const result = await deleteFolder('f1', true, 'actor');
    expect(result).toBeTruthy();
    expect(prismaMock.media.updateMany).toHaveBeenCalled();
  });

  // ── Bulk delete: 409 if any file in use ──────────────────────────────────
  it('rejects bulk delete when files have usages', async () => {
    prismaMock.media.findMany.mockResolvedValue([
      { id: 'm1', original_name: 'avatar.jpg', usages: [{ id: 'u1', entity: 'user.avatar', entity_id: 'usr1' }] },
    ]);
    prismaMock.mediaUsage.findMany.mockResolvedValue([{ id: 'u1', entity: 'user.avatar', entity_id: 'usr1' }]);
    await expect(bulkDelete(['m1'], 'actor')).rejects.toMatchObject({ status: 409 });
  });

  it('bulk deletes files with no usages (soft delete)', async () => {
    prismaMock.media.findMany.mockResolvedValue([
      { id: 'm1', original_name: 'a.jpg', usages: [] },
      { id: 'm2', original_name: 'b.jpg', usages: [] },
    ]);
    prismaMock.media.updateMany.mockResolvedValue({ count: 2 });
    const result = await bulkDelete(['m1', 'm2'], 'actor');
    expect(result.deleted).toBe(2);
    expect(prismaMock.media.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deleted_at: expect.any(Date) }) })
    );
  });

  // ── Purge: deletes storage objects ───────────────────────────────────────
  it('purge deletes MinIO objects for original + variants', async () => {
    prismaMock.media.findMany.mockResolvedValue([
      { id: 'm1', original_name: 'a.jpg', path: 'u/a.jpg', variants: { thumb: 'u/variants/a_thumb.webp', small: null } },
    ]);
    prismaMock.media.deleteMany.mockResolvedValue({ count: 1 });
    const result = await purgeTrash('actor');
    expect(result.purged).toBe(1);
    expect(deleteFiles).toHaveBeenCalledWith(['u/a.jpg', 'u/variants/a_thumb.webp']);
  });

  // ── Settings cache: upload validates against settings ────────────────────
  it('rejects upload when mime not in allowed list', async () => {
    const { getUploadSettings } = await import('../src/modules/media/settings.js');
    vi.mocked(getUploadSettings).mockResolvedValueOnce({
      maxFileSizeMb: 10,
      maxFileSizeBytes: 10 * 1024 * 1024,
      allowedMimes: new Set(['image/jpeg']),
    });
    const file = { originalname: 'video.mp4', mimetype: 'video/mp4', size: 1024, buffer: Buffer.from('fake') };
    await expect(uploadMedia(file, 'u1', null)).rejects.toMatchObject({ status: 422 });
  });

  it('rejects upload when file exceeds max size', async () => {
    const file = { originalname: 'big.jpg', mimetype: 'image/jpeg', size: 100 * 1024 * 1024, buffer: Buffer.from('x') };
    await expect(uploadMedia(file, 'u1', null)).rejects.toMatchObject({ status: 422 });
  });

  it('rejects upload when sharp cannot parse image (fake image → 422)', async () => {
    const sharpModule = await import('sharp');
    vi.mocked(sharpModule.default).mockImplementationOnce(() => ({
      metadata: vi.fn(async () => { throw new Error('Input buffer contains unsupported image format') }),
    }));
    const file = { originalname: 'fake.jpg', mimetype: 'image/jpeg', size: 1024, buffer: Buffer.from('notanimage') };
    await expect(uploadMedia(file, 'u1', null)).rejects.toMatchObject({ status: 422 });
  });

  // ── A6 virus scan: every upload enqueues a scan job ───────────────────────
  it('enqueues a media-scan job on upload', async () => {
    const { enqueueScanJob } = await import('../src/modules/media/media.queue.js');
    const file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('pdf') };
    prismaMock.media.create.mockResolvedValue({ id: 'm-scan', path: 'u1/x.pdf', type: 'DOCUMENT', variants: null });
    await uploadMedia(file, 'u1', null);
    expect(enqueueScanJob).toHaveBeenCalledWith('m-scan');
  });

  // ── A6 require_scan gate: no serving URLs unless verified CLEAN ──────────
  describe('resolveUrls require_scan gate', () => {
    const withRequireScan = async (requireScan) => {
      const { getUploadSettings } = await import('../src/modules/media/settings.js');
      vi.mocked(getUploadSettings).mockResolvedValueOnce({
        maxFileSizeMb: 10,
        maxFileSizeBytes: 10 * 1024 * 1024,
        allowedMimes: new Set(['image/jpeg']),
        requireScan,
      });
    };

    it('withholds url and variants for unscanned file when require_scan is on', async () => {
      await withRequireScan(true);
      const result = await resolveUrls({ id: 'm1', path: 'u/a.jpg', scan_result: null, variants: { thumb: 'v/t.webp' } });
      expect(result.url).toBeNull();
      expect(result.variants).toBeNull();
      expect(getFileUrl).not.toHaveBeenCalled();
    });

    it('withholds url for SKIPPED scan when require_scan is on (fail closed)', async () => {
      await withRequireScan(true);
      const result = await resolveUrls({ id: 'm1', path: 'u/a.jpg', scan_result: 'SKIPPED', variants: null });
      expect(result.url).toBeNull();
    });

    it('serves url for CLEAN file when require_scan is on', async () => {
      await withRequireScan(true);
      vi.mocked(getFileUrl).mockResolvedValue('https://cdn/u/a.jpg');
      const result = await resolveUrls({ id: 'm1', path: 'u/a.jpg', scan_result: 'CLEAN', variants: null });
      expect(result.url).toBe('https://cdn/u/a.jpg');
    });

    it('serves url for unscanned file when require_scan is off', async () => {
      await withRequireScan(false);
      vi.mocked(getFileUrl).mockResolvedValue('https://cdn/u/a.jpg');
      const result = await resolveUrls({ id: 'm1', path: 'u/a.jpg', scan_result: null, variants: null });
      expect(result.url).toBe('https://cdn/u/a.jpg');
    });
  });
});
