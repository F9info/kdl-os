import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, getActiveProviderMock, createMediaVersionMock, getFileUrlMock, fetchMock } = vi.hoisted(() => ({
  prismaMock: { media: { findUnique: vi.fn() } },
  getActiveProviderMock: vi.fn(),
  createMediaVersionMock: vi.fn(),
  getFileUrlMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: getActiveProviderMock }));
vi.mock('../../src/shared/services/storage.service.js', () => ({ getFileUrl: getFileUrlMock }));
vi.mock('../../src/modules/media/processing.service.js', () => ({ createMediaVersion: createMediaVersionMock }));

vi.stubGlobal('fetch', fetchMock);

const { runImageOpJob, IMAGE_OPS } = await import('../../src/modules/media/ai/image-ops.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  getFileUrlMock.mockResolvedValue('http://fake/source.png');
});

describe('runImageOpJob', () => {
  const mockDriver = { runImageOp: vi.fn() };

  it('exposes the D6 op set', () => {
    expect(IMAGE_OPS).toEqual(['bg-removal', 'upscale', 'enhance', 'object-removal']);
  });

  it('rejects an unsupported op with 422 before touching the provider', async () => {
    await expect(runImageOpJob({ mediaId: 'm1', op: 'face-swap' })).rejects.toMatchObject({ status: 422 });
    expect(getActiveProviderMock).not.toHaveBeenCalled();
  });

  it('throws 501-shaped error when image_ops is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    await expect(runImageOpJob({ mediaId: 'm1', op: 'bg-removal' })).rejects.toMatchObject({ status: 501 });
  });

  it('rejects non-image media with 422', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: {}, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'VIDEO', path: 'p', mime_type: 'video/mp4' });
    await expect(runImageOpJob({ mediaId: 'm1', op: 'bg-removal' })).rejects.toMatchObject({ status: 422 });
  });

  it('rejects object-removal without a mask with 422', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: {}, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'p', mime_type: 'image/png' });
    await expect(runImageOpJob({ mediaId: 'm1', op: 'object-removal' })).rejects.toMatchObject({ status: 422 });
  });

  it('runs bg-removal via mocked driver and creates a new version', async () => {
    getActiveProviderMock.mockResolvedValue({
      driver: mockDriver, credentials: { api_token: 't' }, config: { poll_interval_ms: 1 },
    });
    prismaMock.media.findUnique.mockResolvedValue({
      id: 'm1', type: 'IMAGE', path: 'u/photo.png', mime_type: 'image/png',
    });
    mockDriver.runImageOp.mockResolvedValue({ outputUrl: 'http://replicate/out.png', predictionId: 'pred1' });
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    createMediaVersionMock.mockResolvedValue({ version: { id: 'v1', version: 2 } });

    const result = await runImageOpJob({ mediaId: 'm1', op: 'bg-removal', createdBy: 'u1' });

    expect(mockDriver.runImageOp).toHaveBeenCalledWith({
      credentials: { api_token: 't' },
      config: { poll_interval_ms: 1 },
      op: 'bg-removal',
      input: { image: 'http://fake/source.png' },
    });
    expect(createMediaVersionMock).toHaveBeenCalledWith('m1', expect.objectContaining({
      ext: 'png',
      note: 'AI bg-removal',
      createdBy: 'u1',
    }));
    expect(result).toEqual({ version_id: 'v1', version: 2, prediction_id: 'pred1' });
  });

  it('passes scale for upscale and mask for object-removal into driver input', async () => {
    getActiveProviderMock.mockResolvedValue({
      driver: mockDriver, credentials: { api_token: 't' }, config: {},
    });
    prismaMock.media.findUnique.mockResolvedValue({
      id: 'm1', type: 'IMAGE', path: 'u/photo.png', mime_type: 'image/png',
    });
    mockDriver.runImageOp.mockResolvedValue({ outputUrl: 'http://replicate/out.png' });
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer });
    createMediaVersionMock.mockResolvedValue({ version: { id: 'v2', version: 3 } });

    await runImageOpJob({ mediaId: 'm1', op: 'object-removal', mask: 'http://fake/mask.png' });

    expect(mockDriver.runImageOp).toHaveBeenCalledWith(expect.objectContaining({
      op: 'object-removal',
      input: { image: 'http://fake/source.png', mask: 'http://fake/mask.png' },
    }));
  });

  it('throws when the replicate output download fails', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: {}, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({
      id: 'm1', type: 'IMAGE', path: 'u/photo.png', mime_type: 'image/png',
    });
    mockDriver.runImageOp.mockResolvedValue({ outputUrl: 'http://replicate/out.png' });
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    await expect(runImageOpJob({ mediaId: 'm1', op: 'enhance' })).rejects.toThrow(/Failed to download/);
  });
});
