import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  prismaMock, createMediaVersionMock, reindexMock, embedMock, getActiveProviderMock,
  getFileUrlMock, uploadFileMock,
} = vi.hoisted(() => ({
  prismaMock: { media: { findUnique: vi.fn() } },
  createMediaVersionMock: vi.fn(),
  reindexMock: vi.fn(),
  embedMock: vi.fn(),
  getActiveProviderMock: vi.fn(),
  getFileUrlMock: vi.fn(),
  uploadFileMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/shared/services/storage.service.js', () => ({
  getFileUrl: getFileUrlMock,
  uploadFile: uploadFileMock,
}));
vi.mock('../../src/modules/media/processing.service.js', () => ({ createMediaVersion: createMediaVersionMock }));
vi.mock('../../src/modules/media/media-search.service.js', () => ({ enqueueReindex: reindexMock }));
vi.mock('../../src/modules/media/ai/media-semantic.service.js', () => ({ enqueueEmbed: embedMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: getActiveProviderMock }));

const { runAiImageOpJob } = await import('../../src/modules/media/ai/image-ops.service.js');

const mockDriver = { runImageOp: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  getActiveProviderMock.mockResolvedValue({
    driver: mockDriver, credentials: { api_token: 't' }, config: {},
  });
  prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'u/photo.jpg' });
  getFileUrlMock.mockResolvedValue('https://storage.example/u/photo.jpg?sig=1');
  uploadFileMock.mockResolvedValue('https://storage.example/ai-masks/m1/mask.png?sig=1');
  createMediaVersionMock.mockResolvedValue({ version: { id: 'v1', version: 2 } });
  mockDriver.runImageOp.mockResolvedValue({ outputUrl: 'https://replicate.example/output.png', predictionId: 'p1' });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => Buffer.from('output-bytes'),
  });
});

describe('runAiImageOpJob', () => {
  it('throws 501-shaped error when image_ops is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    await expect(runAiImageOpJob({ mediaId: 'm1', op: 'bg-removal' })).rejects.toMatchObject({ status: 501 });
  });

  it('rejects non-image media with 422', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'VIDEO', path: 'u/v.mp4' });
    await expect(runAiImageOpJob({ mediaId: 'm1', op: 'bg-removal' })).rejects.toMatchObject({ status: 422 });
  });

  it('bg-removal: calls driver with image url, creates a new version, reindexes + embeds', async () => {
    const result = await runAiImageOpJob({ mediaId: 'm1', op: 'bg-removal', createdBy: 'u1' });

    expect(mockDriver.runImageOp).toHaveBeenCalledWith({
      credentials: { api_token: 't' },
      config: {},
      op: 'bg-removal',
      input: { image: 'https://storage.example/u/photo.jpg?sig=1' },
    });
    expect(createMediaVersionMock).toHaveBeenCalledWith('m1', {
      buffer: Buffer.from('output-bytes'),
      ext: 'png',
      note: 'AI image op: bg-removal',
      createdBy: 'u1',
    });
    expect(reindexMock).toHaveBeenCalledWith('m1');
    expect(embedMock).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ version_id: 'v1', version: 2, op: 'bg-removal' });
  });

  it('upscale 2x: passes scale through to the driver input', async () => {
    await runAiImageOpJob({ mediaId: 'm1', op: 'upscale', scale: 2 });
    expect(mockDriver.runImageOp).toHaveBeenCalledWith(expect.objectContaining({
      op: 'upscale',
      input: { image: 'https://storage.example/u/photo.jpg?sig=1', scale: 2 },
    }));
  });

  it('upscale 4x: passes scale through to the driver input', async () => {
    await runAiImageOpJob({ mediaId: 'm1', op: 'upscale', scale: 4 });
    expect(mockDriver.runImageOp).toHaveBeenCalledWith(expect.objectContaining({
      input: { image: 'https://storage.example/u/photo.jpg?sig=1', scale: 4 },
    }));
  });

  it('enhance: uses the img input key expected by the gfpgan model', async () => {
    await runAiImageOpJob({ mediaId: 'm1', op: 'enhance' });
    expect(mockDriver.runImageOp).toHaveBeenCalledWith(expect.objectContaining({
      op: 'enhance',
      input: { img: 'https://storage.example/u/photo.jpg?sig=1' },
    }));
  });

  it('object-removal: uploads the editor-supplied mask and passes both urls to the driver', async () => {
    await runAiImageOpJob({ mediaId: 'm1', op: 'object-removal', mask: 'data:image/png;base64,Zm9v' });

    expect(uploadFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png' }),
      expect.stringContaining('ai-masks/m1/'),
    );
    expect(mockDriver.runImageOp).toHaveBeenCalledWith(expect.objectContaining({
      op: 'object-removal',
      input: {
        image: 'https://storage.example/u/photo.jpg?sig=1',
        mask: 'https://storage.example/ai-masks/m1/mask.png?sig=1',
      },
    }));
  });
});
