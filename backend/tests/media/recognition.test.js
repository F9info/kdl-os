import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'fs/promises';

const { prismaMock, minioMock, tagMediaMock, getActiveProviderMock, embedMock } = vi.hoisted(() => ({
  prismaMock: {
    media: { findUnique: vi.fn(), update: vi.fn() },
    appSetting: { findUnique: vi.fn() },
  },
  minioMock: { getObject: vi.fn() },
  tagMediaMock: vi.fn(),
  getActiveProviderMock: vi.fn(),
  embedMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/minio.js', () => ({ minio: minioMock }));
vi.mock('../../src/modules/media/tags.service.js', () => ({ tagMedia: tagMediaMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: getActiveProviderMock }));
vi.mock('../../src/modules/media/ai/media-semantic.service.js', () => ({ enqueueEmbed: embedMock }));

const recognitionService = await import('../../src/modules/media/ai/recognition.service.js');
const barcodeService = await import('../../src/modules/media/barcode.service.js');
const { isRecognitionEnabled } = await import('../../src/modules/media/settings.js');

async function* fakeStream(buf) {
  yield buf;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseRecognitionResult', () => {
  it('extracts categories even when wrapped in prose/fences', () => {
    const text = 'Here:\n```json\n{"labels":["coffee cup","table"],"logos":["starbucks"],"landmarks":[],"products":["macbook pro"]}\n```';
    expect(recognitionService.parseRecognitionResult(text)).toEqual({
      labels: ['coffee cup', 'table'],
      logos: ['starbucks'],
      landmarks: [],
      products: ['macbook pro'],
    });
  });

  it('drops non-string entries and tolerates missing categories', () => {
    expect(recognitionService.parseRecognitionResult('{"labels":["dog",42,""],"logos":"nope"}')).toEqual({
      labels: ['dog'], logos: [], landmarks: [], products: [],
    });
  });

  it('throws when no JSON object is present', () => {
    expect(() => recognitionService.parseRecognitionResult('no json here')).toThrow();
  });
});

describe('runRecognitionJob', () => {
  const mockDriver = { analyzeImage: vi.fn() };
  const provider = { row: { id: 'ai-1' }, driver: mockDriver, credentials: { api_key: 'k' }, config: { model: 'm' } };

  it('returns 501-shaped error when vision is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    await expect(recognitionService.runRecognitionJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 501 });
  });

  it('rejects non-image media with 422', async () => {
    getActiveProviderMock.mockResolvedValue(provider);
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'VIDEO', path: 'x', mime_type: 'video/mp4' });
    await expect(recognitionService.runRecognitionJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 422 });
  });

  it('tags media with deduped labels/logos/landmarks/products from the mocked vision driver', async () => {
    getActiveProviderMock.mockResolvedValue(provider);
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'u1/x.jpg', mime_type: 'image/jpeg' });
    minioMock.getObject.mockResolvedValue(fakeStream(Buffer.from('fake-image-bytes')));
    mockDriver.analyzeImage.mockResolvedValue({
      text: '{"labels":["coffee","laptop"],"logos":["apple"],"landmarks":["eiffel tower"],"products":["macbook pro","laptop"]}',
      model: 'm',
    });

    const result = await recognitionService.runRecognitionJob({ mediaId: 'm1' });

    expect(mockDriver.analyzeImage).toHaveBeenCalledWith(expect.objectContaining({
      credentials: { api_key: 'k' },
      mimeType: 'image/jpeg',
    }));
    // "laptop" appears in both labels and products — deduped
    expect(tagMediaMock).toHaveBeenCalledWith(['m1'], ['coffee', 'laptop', 'apple', 'eiffel tower', 'macbook pro'], null);
    expect(embedMock).toHaveBeenCalledWith('m1');
    expect(result.tags).toEqual(['coffee', 'laptop', 'apple', 'eiffel tower', 'macbook pro']);
  });

  it('does not tag when the model finds nothing', async () => {
    getActiveProviderMock.mockResolvedValue(provider);
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'u1/x.jpg', mime_type: 'image/png' });
    minioMock.getObject.mockResolvedValue(fakeStream(Buffer.from('fake-image-bytes')));
    mockDriver.analyzeImage.mockResolvedValue({ text: '{"labels":[],"logos":[],"landmarks":[],"products":[]}', model: 'm' });

    const result = await recognitionService.runRecognitionJob({ mediaId: 'm1' });

    expect(tagMediaMock).not.toHaveBeenCalled();
    expect(result.tags).toEqual([]);
  });
});

describe('runBarcodeDecodeJob (real zxing decode)', () => {
  it('decodes the QR fixture and stores {format, text} on the media row', async () => {
    const fixture = await readFile(new URL('../fixtures/qr-kdl.png', import.meta.url));
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', path: 'u1/qr.png', mime_type: 'image/png' });
    minioMock.getObject.mockResolvedValue(fakeStream(fixture));

    const result = await barcodeService.runBarcodeDecodeJob({ mediaId: 'm1' });

    expect(result.barcodes).toEqual([{ format: 'QRCode', text: 'https://kdl.example.com/asset/42' }]);
    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { barcodes: [{ format: 'QRCode', text: 'https://kdl.example.com/asset/42' }] },
    });
  });

  it('stores null when the image contains no barcode', async () => {
    // 1x1 white PNG
    const blank = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm2', path: 'u1/blank.png', mime_type: 'image/png' });
    minioMock.getObject.mockResolvedValue(fakeStream(blank));

    const result = await barcodeService.runBarcodeDecodeJob({ mediaId: 'm2' });

    expect(result.barcodes).toEqual([]);
    expect(prismaMock.media.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { barcodes: null } });
  });

  it('rejects unsupported mime types with 422', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm3', path: 'u1/x.svg', mime_type: 'image/svg+xml' });
    await expect(barcodeService.runBarcodeDecodeJob({ mediaId: 'm3' })).rejects.toMatchObject({ status: 422 });
  });
});

describe('media.recognition setting', () => {
  it('defaults to OFF when the setting row is absent', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    expect(await isRecognitionEnabled()).toBe(false);
  });

  it('is ON only when explicitly set to "true"', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({ key: 'media.recognition', value: 'true' });
    expect(await isRecognitionEnabled()).toBe(true);
    prismaMock.appSetting.findUnique.mockResolvedValue({ key: 'media.recognition', value: 'false' });
    expect(await isRecognitionEnabled()).toBe(false);
  });
});
