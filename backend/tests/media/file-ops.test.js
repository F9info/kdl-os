import { describe, it, expect, vi, beforeEach } from 'vitest';

const { uploadMediaMock } = vi.hoisted(() => ({ uploadMediaMock: vi.fn() }));
vi.mock('../../src/modules/media/service.js', () => ({ uploadMedia: uploadMediaMock }));
vi.mock('../../src/modules/media/media-search.service.js', () => ({ enqueueReindex: vi.fn() }));
vi.mock('../../src/modules/media/media.queue.js', () => ({ enqueueVariantJob: vi.fn() }));
vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../src/shared/services/storage.service.js', () => ({ copyFile: vi.fn() }));
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    mediaFolder: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    mediaTagPivot: { createMany: vi.fn() },
    mediaMetaValue: { createMany: vi.fn() },
  },
}));

import { prisma } from '../../src/config/database.js';
import * as storageService from '../../src/shared/services/storage.service.js';
import { enqueueVariantJob } from '../../src/modules/media/media.queue.js';
import {
  copyMedia, setArchived, sanitizePathSegments, ensureFolderPath, uploadFilesWithPaths,
} from '../../src/modules/media/file-ops.service.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('copyMedia', () => {
  const SRC = {
    id: 'm1', user_id: 'owner', folder_id: 'f1', path: 'owner/abc.jpg', bucket: 'b',
    original_name: 'photo.jpg', mime_type: 'image/jpeg', size: 100, type: 'IMAGE',
    title: 'T', alt_text: 'A', caption: null, width: 10, height: 10, duration: null,
    exif: { camera_make: 'Canon' }, checksum: 'sha', scanned_at: null, scan_result: null,
    tags: [{ tag_id: 't1' }], meta_values: [{ field_id: 'f1', value: 'v' }],
  };

  it('returns null when source missing', async () => {
    prisma.media.findFirst.mockResolvedValue(null);
    expect(await copyMedia('nope', {}, 'actor')).toBeNull();
  });

  it('copies object, row, tags and meta; reports checksum duplicates', async () => {
    prisma.media.findFirst.mockResolvedValue(SRC);
    prisma.media.create.mockImplementation(async ({ data }) => ({ id: 'm2', ...data }));
    prisma.media.findMany.mockResolvedValue([{ id: 'm9', original_name: 'same-bytes.jpg', folder_id: null }]);

    const result = await copyMedia('m1', {}, 'actor');

    expect(storageService.copyFile).toHaveBeenCalledWith('owner/abc.jpg', expect.stringMatching(/^actor\/.+\.jpg$/));
    expect(result.media.original_name).toBe('photo (copy).jpg');
    expect(result.media.user_id).toBe('actor');
    expect(result.media.folder_id).toBe('f1'); // inherits source folder
    expect(prisma.mediaTagPivot.createMany).toHaveBeenCalledWith({
      data: [{ media_id: 'm2', tag_id: 't1' }], skipDuplicates: true,
    });
    expect(prisma.mediaMetaValue.createMany).toHaveBeenCalled();
    expect(enqueueVariantJob).toHaveBeenCalled(); // sharp-safe image regenerates variants
    expect(result.duplicates).toEqual([{ id: 'm9', original_name: 'same-bytes.jpg', folder_id: null }]);
  });

  it('honors explicit target folder including null (root)', async () => {
    prisma.media.findFirst.mockResolvedValue(SRC);
    prisma.media.create.mockImplementation(async ({ data }) => ({ id: 'm2', ...data }));
    prisma.media.findMany.mockResolvedValue([]);
    const result = await copyMedia('m1', { folder_id: null }, 'actor');
    expect(result.media.folder_id).toBeNull();
  });
});

describe('setArchived', () => {
  it('bulk-updates the flag and reports count', async () => {
    prisma.media.updateMany.mockResolvedValue({ count: 2 });
    const result = await setArchived(['a', 'b'], true, 'actor');
    expect(prisma.media.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, deleted_at: null },
      data: { is_archived: true },
    });
    expect(result).toEqual({ updated: 2, archived: true });
  });
});

describe('sanitizePathSegments', () => {
  it('drops the filename and unsafe segments', () => {
    expect(sanitizePathSegments('brand/logos/dark/logo.png')).toEqual(['brand', 'logos', 'dark']);
    expect(sanitizePathSegments('..\\evil\\x.png')).toEqual(['evil']);
    expect(sanitizePathSegments('a/./../b/file.png')).toEqual(['a', 'b']);
    expect(sanitizePathSegments('file.png')).toEqual([]);
    expect(sanitizePathSegments(null)).toEqual([]);
  });
});

describe('ensureFolderPath', () => {
  it('returns base folder unchanged for empty segments', async () => {
    expect(await ensureFolderPath('base', [], 'actor')).toBe('base');
    expect(await ensureFolderPath(null, [], 'actor')).toBeNull();
  });

  it('find-or-creates nested folders and caches within a batch', async () => {
    prisma.mediaFolder.findFirst.mockResolvedValue(null);
    let n = 0;
    prisma.mediaFolder.create.mockImplementation(async ({ data }) => ({ id: `nf${++n}`, ...data }));

    const cache = new Map();
    const id1 = await ensureFolderPath(null, ['a', 'b'], 'actor', cache);
    expect(id1).toBe('nf2');
    expect(prisma.mediaFolder.create).toHaveBeenCalledTimes(2);

    // second file in same dirs — cache short-circuits DB
    const id2 = await ensureFolderPath(null, ['a', 'b'], 'actor', cache);
    expect(id2).toBe('nf2');
    expect(prisma.mediaFolder.create).toHaveBeenCalledTimes(2);
  });

  it('enforces the max depth cap', async () => {
    await expect(ensureFolderPath(null, ['1', '2', '3', '4', '5', '6', '7'], 'actor'))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('depth') });
  });
});

describe('uploadFilesWithPaths', () => {
  it('routes each file into its resolved folder', async () => {
    prisma.mediaFolder.findFirst.mockResolvedValue(null);
    let n = 0;
    prisma.mediaFolder.create.mockImplementation(async ({ data }) => ({ id: `nf${++n}`, ...data }));
    uploadMediaMock.mockImplementation(async (file, _u, folderId) => ({ id: file.originalname, folder_id: folderId }));

    const files = [{ originalname: 'root.png' }, { originalname: 'nested.png' }];
    const results = await uploadFilesWithPaths(files, ['root.png', 'sub/nested.png'], null, 'actor');

    expect(results[0].folder_id).toBeNull();
    expect(results[1].folder_id).toBe('nf1');
  });
});
