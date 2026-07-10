import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import os from 'os';
import { rm } from 'fs/promises';

const { getUploadSettingsMock, uploadMediaMock } = vi.hoisted(() => ({
  getUploadSettingsMock: vi.fn(),
  uploadMediaMock: vi.fn(),
}));
vi.mock('../../src/modules/media/settings.js', () => ({ getUploadSettings: getUploadSettingsMock }));
vi.mock('../../src/modules/media/service.js', () => ({ uploadMedia: uploadMediaMock, resolveUrls: async (m) => m }));

// Service reads CHUNK_UPLOAD_DIR at module load — set before importing it.
const TEST_ROOT = path.join(os.tmpdir(), `kdl-chunk-test-${process.pid}`);
process.env.CHUNK_UPLOAD_DIR = TEST_ROOT;
const svc = await import('../../src/modules/media/chunked-upload.service.js');

const SETTINGS = {
  allowedMimes: new Set(['image/png', 'video/mp4']),
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileSizeMb: 10,
  maxChunkedSizeBytes: 1024, // tiny cap for tests
  maxChunkedSizeMb: 1,
};

beforeEach(async () => {
  vi.clearAllMocks();
  getUploadSettingsMock.mockResolvedValue(SETTINGS);
  uploadMediaMock.mockResolvedValue({ id: 'm-new' });
  await rm(TEST_ROOT, { recursive: true, force: true });
});

const initSession = (overrides = {}) => svc.initChunkedUpload({
  filename: 'big.png', size: 8, mime_type: 'image/png', folder_id: null, total_parts: 3, ...overrides,
}, 'user-1');

describe('chunked upload init', () => {
  it('rejects disallowed mime', async () => {
    await expect(initSession({ mime_type: 'application/x-msdownload' }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('not allowed') });
  });

  it('rejects size above chunked cap', async () => {
    await expect(initSession({ size: 2048 }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('max size') });
  });

  it('returns an upload session id', async () => {
    const res = await initSession();
    expect(res.upload_id).toBeTruthy();
    expect(res.total_parts).toBe(3);
  });
});

describe('chunk parts + status', () => {
  it('rejects out-of-range part index', async () => {
    const { upload_id } = await initSession();
    await expect(svc.saveChunkPart(upload_id, 3, Buffer.from('X'), 'user-1'))
      .rejects.toMatchObject({ status: 422 });
    await expect(svc.saveChunkPart(upload_id, -1, Buffer.from('X'), 'user-1'))
      .rejects.toMatchObject({ status: 422 });
  });

  it('hides sessions from other users', async () => {
    const { upload_id } = await initSession();
    await expect(svc.saveChunkPart(upload_id, 0, Buffer.from('X'), 'user-2'))
      .rejects.toMatchObject({ status: 404 });
    await expect(svc.getChunkedStatus(upload_id, 'user-2'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('rejects parts whose total exceeds the declared size', async () => {
    const { upload_id } = await initSession({ size: 4, total_parts: 2 });
    await svc.saveChunkPart(upload_id, 0, Buffer.from('AAA'), 'user-1');
    await expect(svc.saveChunkPart(upload_id, 1, Buffer.from('BBB'), 'user-1'))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('exceeds declared') });
  });

  it('status reports received parts for resume', async () => {
    const { upload_id } = await initSession();
    await svc.saveChunkPart(upload_id, 0, Buffer.from('AAA'), 'user-1');
    await svc.saveChunkPart(upload_id, 2, Buffer.from('CC'), 'user-1');
    const status = await svc.getChunkedStatus(upload_id, 'user-1');
    expect(status.received_parts).toEqual([0, 2]);
    expect(status.complete).toBe(false);
  });
});

describe('chunk assembly (complete)', () => {
  it('rejects completion with missing parts', async () => {
    const { upload_id } = await initSession();
    await svc.saveChunkPart(upload_id, 0, Buffer.from('AAA'), 'user-1');
    await expect(svc.completeChunkedUpload(upload_id, 'user-1'))
      .rejects.toMatchObject({ status: 422, detail: { missing: [1, 2] } });
  });

  it('assembles parts in index order and hands off to the upload pipeline', async () => {
    const { upload_id } = await initSession();
    // deliberately out of order — assembly must sort by index
    await svc.saveChunkPart(upload_id, 2, Buffer.from('CC'), 'user-1');
    await svc.saveChunkPart(upload_id, 0, Buffer.from('AAA'), 'user-1');
    await svc.saveChunkPart(upload_id, 1, Buffer.from('BBB'), 'user-1');

    const media = await svc.completeChunkedUpload(upload_id, 'user-1');
    expect(media).toEqual({ id: 'm-new' });

    const [file, userId, folderId, opts] = uploadMediaMock.mock.calls[0];
    expect(file.buffer.toString()).toBe('AAABBBCC');
    expect(file.size).toBe(8);
    expect(file.originalname).toBe('big.png');
    expect(file.mimetype).toBe('image/png');
    expect(userId).toBe('user-1');
    expect(folderId).toBeNull();
    expect(opts.maxBytesOverride).toBe(SETTINGS.maxChunkedSizeBytes);

    // session cleaned up
    await expect(svc.getChunkedStatus(upload_id, 'user-1')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects when assembled size does not match declared size', async () => {
    const { upload_id } = await initSession({ size: 8, total_parts: 2 });
    await svc.saveChunkPart(upload_id, 0, Buffer.from('AAA'), 'user-1');
    await svc.saveChunkPart(upload_id, 1, Buffer.from('BB'), 'user-1'); // 5 !== 8
    await expect(svc.completeChunkedUpload(upload_id, 'user-1'))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('does not match') });
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });
});
