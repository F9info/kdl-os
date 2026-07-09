import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const { putObjectMock } = vi.hoisted(() => ({ putObjectMock: vi.fn() }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    mediaVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    media: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mediaComment: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/minio.js', () => ({
  minio: { putObject: putObjectMock },
}));

vi.mock('../../src/shared/services/storage.service.js', () => ({
  getFileUrl: vi.fn().mockResolvedValue('https://cdn/file'),
  putObject: putObjectMock,
  uploadFile: vi.fn().mockResolvedValue('uploads/med001/versions/img_v1.png'),
}));

import { prisma } from '../../src/config/database.js';
import { createMediaVersion } from '../../src/modules/media/processing.service.js';
import { listComments, createComment, deleteComment } from '../../src/modules/media/comments.service.js';

const MEDIA = {
  id: 'med001',
  bucket: 'media',
  path: 'uploads/med001/img.png',
  size: 1000,
  checksum: 'abc',
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.media.findUnique.mockResolvedValue(MEDIA);
  prisma.media.update.mockImplementation(({ data }) =>
    Promise.resolve({ ...MEDIA, ...data }));
  putObjectMock.mockResolvedValue(null);
});

describe('createMediaVersion — version chain', () => {
  it('creates version 1 when no prior versions exist', async () => {
    prisma.mediaVersion.findFirst.mockResolvedValue(null);
    prisma.mediaVersion.create.mockResolvedValue({ id: 'v1', version: 1, path: 'uploads/med001/versions/img_v1.png' });

    const result = await createMediaVersion('med001', {
      buffer: Buffer.from('DATA'),
      ext: 'png',
      note: 'initial',
      createdBy: 'user1',
    });
    expect(result.version.version).toBe(1);
  });

  it('increments version number to 2 for second version', async () => {
    prisma.mediaVersion.findFirst.mockResolvedValue({ version: 1 });
    prisma.mediaVersion.create.mockResolvedValue({ id: 'v2', version: 2, path: 'uploads/med001/versions/img_v2.png' });

    const result = await createMediaVersion('med001', {
      buffer: Buffer.from('DATA2'),
      ext: 'png',
      note: 'update',
      createdBy: 'user1',
    });
    expect(result.version.version).toBe(2);
  });

  it('stores file to a path containing /versions/', async () => {
    prisma.mediaVersion.findFirst.mockResolvedValue(null);
    prisma.mediaVersion.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'v1', version: 1, path: data.path }));

    const result = await createMediaVersion('med001', {
      buffer: Buffer.from('DATA'),
      ext: 'png',
      createdBy: 'user1',
    });
    expect(result.path).toContain('versions');
  });
});

describe('comments', () => {
  const COMMENT = {
    id: 'c001',
    media_id: 'med001',
    user_id: 'user1',
    body: 'Nice shot',
    created_at: new Date(),
    user: { id: 'user1', name: 'Alice', email: 'alice@example.com' },
  };

  beforeEach(() => {
    prisma.mediaComment.findMany.mockResolvedValue([COMMENT]);
    prisma.mediaComment.create.mockResolvedValue(COMMENT);
    prisma.mediaComment.findUnique.mockResolvedValue(COMMENT);
    prisma.mediaComment.delete.mockResolvedValue(COMMENT);
  });

  it('listComments returns ordered list with user include', async () => {
    const result = await listComments('med001');
    expect(prisma.mediaComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { media_id: 'med001' },
        include: expect.objectContaining({ user: expect.anything() }),
        orderBy: { created_at: 'asc' },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].user.name).toBe('Alice');
  });

  it('createComment creates with user relation', async () => {
    const comment = await createComment('med001', 'user1', 'Nice shot');
    expect(prisma.mediaComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ media_id: 'med001', user_id: 'user1', body: 'Nice shot' }),
        include: expect.objectContaining({ user: expect.anything() }),
      }),
    );
    expect(comment.body).toBe('Nice shot');
  });

  it('deleteComment deletes own comment successfully', async () => {
    await expect(deleteComment('c001', 'user1')).resolves.not.toThrow();
    expect(prisma.mediaComment.delete).toHaveBeenCalledWith({ where: { id: 'c001' } });
  });

  it('deleteComment throws 403 for another user', async () => {
    await expect(deleteComment('c001', 'otherUser')).rejects.toMatchObject({ status: 403 });
  });

  it('deleteComment throws 404 when comment not found', async () => {
    prisma.mediaComment.findUnique.mockResolvedValue(null);
    await expect(deleteComment('c001', 'user1')).rejects.toMatchObject({ status: 404 });
  });
});
