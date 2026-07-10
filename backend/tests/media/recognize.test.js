import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, minioMock, getActiveProviderMock } = vi.hoisted(() => ({
  prismaMock: {
    media: { findUnique: vi.fn() },
    mediaSuggestion: { create: vi.fn() },
  },
  minioMock: { getObject: vi.fn() },
  getActiveProviderMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/minio.js', () => ({ minio: minioMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: getActiveProviderMock }));

const recognizeService = await import('../../src/modules/media/ai/recognize.service.js');

async function* fakeStream(buf) {
  yield buf;
}

beforeEach(() => {
  vi.clearAllMocks();
  minioMock.getObject.mockResolvedValue(fakeStream(Buffer.from('bytes')));
});

describe('parseRecognitionResult', () => {
  it('flattens labels/logos/landmarks/products into a deduped lowercase tags list', () => {
    const text = '```json\n{"labels":["Shoe","shoe"],"logos":["Nike"],"landmarks":["Eiffel Tower"],"products":["Air Max"]}\n```';
    const result = recognizeService.parseRecognitionResult(text);
    expect(result.labels).toEqual(['Shoe', 'shoe']);
    expect(result.logos).toEqual(['Nike']);
    expect(result.landmarks).toEqual(['Eiffel Tower']);
    expect(result.products).toEqual(['Air Max']);
    expect(result.tags.sort()).toEqual(['air max', 'eiffel tower', 'nike', 'shoe']);
  });

  it('handles empty categories', () => {
    const result = recognizeService.parseRecognitionResult('{"labels":[],"logos":[],"landmarks":[],"products":[]}');
    expect(result.tags).toEqual([]);
  });

  it('throws when no JSON object is present', () => {
    expect(() => recognizeService.parseRecognitionResult('no json here')).toThrow();
  });
});

describe('runRecognizeJob', () => {
  const mockDriver = { analyzeImage: vi.fn() };

  it('returns 501-shaped error when vision is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    await expect(recognizeService.runRecognizeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 501 });
    expect(prismaMock.media.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-image media with 422', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: { api_key: 'k' }, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'VIDEO', path: 'p', mime_type: 'video/mp4' });
    await expect(recognizeService.runRecognizeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 422 });
  });

  it('calls the vision driver via analyzeImage and creates a TAGS suggestion sourced "ai-recognition"', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: { api_key: 'k' }, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'u/photo.png', mime_type: 'image/png' });
    mockDriver.analyzeImage.mockResolvedValue({
      text: '{"labels":["car"],"logos":["Toyota"],"landmarks":[],"products":[]}',
    });
    prismaMock.mediaSuggestion.create.mockResolvedValue({ id: 'sug1' });

    const result = await recognizeService.runRecognizeJob({ mediaId: 'm1' });

    expect(mockDriver.analyzeImage).toHaveBeenCalledWith(expect.objectContaining({
      credentials: { api_key: 'k' },
      mimeType: 'image/png',
    }));
    expect(prismaMock.mediaSuggestion.create).toHaveBeenCalledWith({
      data: { media_id: 'm1', type: 'TAGS', value: ['car', 'toyota'], source: 'ai-recognition' },
    });
    expect(result.suggestion_id).toBe('sug1');
    expect(result.tags).toEqual(['car', 'toyota']);
  });

  it('skips suggestion creation when nothing is recognized', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: {}, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'u/photo.png', mime_type: 'image/png' });
    mockDriver.analyzeImage.mockResolvedValue({ text: '{"labels":[],"logos":[],"landmarks":[],"products":[]}' });

    const result = await recognizeService.runRecognizeJob({ mediaId: 'm1' });

    expect(prismaMock.mediaSuggestion.create).not.toHaveBeenCalled();
    expect(result.suggestion_id).toBeNull();
  });
});

describe('D7 scope guard — no face recognition path exists', () => {
  it('the recognition prompt explicitly forbids face/identity output', async () => {
    const src = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../src/modules/media/ai/recognize.service.js', import.meta.url), 'utf8'));
    expect(src).toMatch(/face/i);
    expect(src).not.toMatch(/faceRecognition|face_recognition|detectFaces|faceMatch/i);
  });
});
