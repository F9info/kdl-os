import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/config/database.js';
import * as mediaService from '../../src/modules/media/service.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    appSetting: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/shared/services/storage.service.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://presigned-old.example.com/1'),
  getFileUrl: vi.fn().mockResolvedValue('https://presigned-fresh.example.com/2'),
  deleteFile: vi.fn().mockResolvedValue({}),
  deleteFiles: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/modules/media/settings.js', () => ({
  getUploadSettings: vi.fn().mockResolvedValue({
    maxFileSizeMb: 10,
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedMimes: new Set(['image/png', 'image/jpeg']),
  }),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn(async () => ({ width: 200, height: 200 })),
  })),
}));

vi.mock('../../src/modules/media/media.queue.js', () => ({
  enqueueVariantJob: vi.fn(),
}));

vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

const mockFile = (overrides = {}) => ({
  fieldname: 'file',
  originalname: 'avatar.png',
  encoding: '7bit',
  mimetype: 'image/png',
  size: 2048,
  buffer: Buffer.from('fake'),
  ...overrides,
});

describe('media presigned URL regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadMedia does not store a presigned URL in the database (regression KDL-15)', async () => {
    const userId = 'usr_1';
    const file = mockFile();
    prisma.media.create.mockResolvedValue({
      id: 'med_1',
      user_id: userId,
      path: `${userId}/uuid.png`,
      url: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await mediaService.uploadMedia(file, userId);

    expect(prisma.media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ url: expect.any(String) }),
      })
    );
  });

  it('listMedia generates fresh URLs on every request instead of returning stored URLs', async () => {
    const userId = 'usr_1';
    prisma.media.findMany.mockResolvedValue([
      { id: 'med_1', path: 'a/1.png', url: null },
      { id: 'med_2', path: 'a/2.png', url: null },
    ]);
    prisma.media.count.mockResolvedValue(2);
    const { getFileUrl } = await import('../../src/shared/services/storage.service.js');

    await mediaService.listMedia(userId, {});

    expect(getFileUrl).toHaveBeenCalledTimes(2);
    expect(getFileUrl).toHaveBeenNthCalledWith(1, 'a/1.png');
    expect(getFileUrl).toHaveBeenNthCalledWith(2, 'a/2.png');
  });
});
