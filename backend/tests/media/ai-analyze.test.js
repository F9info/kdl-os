import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, minioMock, activityMock, reindexMock, tagMediaMock, getActiveProviderMock } = vi.hoisted(() => ({
  prismaMock: {
    media: { findUnique: vi.fn(), update: vi.fn() },
    mediaSuggestion: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => fn(prismaMock)),
  },
  minioMock: { getObject: vi.fn() },
  activityMock: vi.fn(),
  reindexMock: vi.fn(),
  tagMediaMock: vi.fn(),
  getActiveProviderMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/minio.js', () => ({ minio: minioMock }));
vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: activityMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}));
vi.mock('../../src/modules/media/media-search.service.js', () => ({ enqueueReindex: reindexMock }));
vi.mock('../../src/modules/media/tags.service.js', () => ({ tagMedia: tagMediaMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: getActiveProviderMock }));

const analyzeService = await import('../../src/modules/media/ai/analyze.service.js');
const suggestionsService = await import('../../src/modules/media/ai/suggestions.service.js');

async function* fakeStream(buf) {
  yield buf;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseAnalysisResult', () => {
  it('extracts a JSON object even when wrapped in prose/fences', () => {
    const text = 'Sure, here you go:\n```json\n{"tags":["cat","pet"],"title":"A cat","description":"A cute cat.","alt_text":"A cat sitting","seo_keywords":["cat photo"]}\n```';
    expect(analyzeService.parseAnalysisResult(text)).toEqual({
      tags: ['cat', 'pet'],
      title: 'A cat',
      description: 'A cute cat.',
      alt_text: 'A cat sitting',
      seo_keywords: ['cat photo'],
    });
  });

  it('throws when no JSON object is present', () => {
    expect(() => analyzeService.parseAnalysisResult('no json here')).toThrow();
  });
});

describe('runAnalyzeJob', () => {
  const mockDriver = { analyzeImage: vi.fn() };

  it('returns 501-shaped error when vision is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    await expect(analyzeService.runAnalyzeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 501 });
  });

  it('rejects non-image media with 422', async () => {
    getActiveProviderMock.mockResolvedValue({
      row: { id: 'ai-1' }, driver: mockDriver, credentials: { api_key: 'k' }, config: {},
    });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'VIDEO', path: 'x', mime_type: 'video/mp4' });
    await expect(analyzeService.runAnalyzeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 422 });
  });

  it('analyzes an image via the mocked vision driver and writes PENDING suggestions', async () => {
    getActiveProviderMock.mockResolvedValue({
      row: { id: 'ai-1' }, driver: mockDriver, credentials: { api_key: 'k' }, config: { model: 'm' },
    });
    prismaMock.media.findUnique.mockResolvedValue({
      id: 'm1', type: 'IMAGE', path: 'u1/x.jpg', mime_type: 'image/jpeg',
    });
    minioMock.getObject.mockResolvedValue(fakeStream(Buffer.from('fake-image-bytes')));
    prismaMock.mediaSuggestion.findMany.mockResolvedValue([
      { id: 's1', type: 'TAGS' }, { id: 's2', type: 'TITLE' },
    ]);
    mockDriver.analyzeImage.mockResolvedValue({
      text: '{"tags":["cat"],"title":"A cat","description":"desc","alt_text":"alt","seo_keywords":["kw"]}',
      model: 'm',
    });

    const result = await analyzeService.runAnalyzeJob({ mediaId: 'm1' });
    expect(mockDriver.analyzeImage).toHaveBeenCalledWith(expect.objectContaining({
      credentials: { api_key: 'k' },
      mimeType: 'image/jpeg',
    }));
    expect(prismaMock.mediaSuggestion.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ media_id: 'm1', type: 'TAGS', value: ['cat'], source: 'ai' }),
        expect.objectContaining({ media_id: 'm1', type: 'TITLE', value: 'A cat' }),
      ]),
    }));
    expect(result.suggestion_ids).toEqual(['s1', 's2']);
  });
});

describe('suggestion accept/reject', () => {
  it('accept: TAGS suggestion tags the media, marks ACCEPTED, and reindexes', async () => {
    prismaMock.mediaSuggestion.findUnique.mockResolvedValue({
      id: 's1', media_id: 'm1', type: 'TAGS', value: ['cat', 'pet'], status: 'PENDING',
    });
    prismaMock.mediaSuggestion.update.mockResolvedValue({ id: 's1', status: 'ACCEPTED' });

    const updated = await suggestionsService.acceptSuggestion('s1', 'user-1');

    expect(tagMediaMock).toHaveBeenCalledWith(['m1'], ['cat', 'pet'], 'user-1');
    expect(prismaMock.mediaSuggestion.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'ACCEPTED' } });
    expect(reindexMock).toHaveBeenCalledWith('m1');
    expect(updated.status).toBe('ACCEPTED');
  });

  it('accept: TITLE suggestion updates media.title', async () => {
    prismaMock.mediaSuggestion.findUnique.mockResolvedValue({
      id: 's2', media_id: 'm1', type: 'TITLE', value: 'A cat', status: 'PENDING',
    });
    prismaMock.mediaSuggestion.update.mockResolvedValue({ id: 's2', status: 'ACCEPTED' });

    await suggestionsService.acceptSuggestion('s2', 'user-1');

    expect(prismaMock.media.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { title: 'A cat' } });
  });

  it('accept: returns null for unknown suggestion id', async () => {
    prismaMock.mediaSuggestion.findUnique.mockResolvedValue(null);
    expect(await suggestionsService.acceptSuggestion('missing', 'user-1')).toBeNull();
  });

  it('accept: no-ops on an already-decided suggestion', async () => {
    prismaMock.mediaSuggestion.findUnique.mockResolvedValue({
      id: 's3', media_id: 'm1', type: 'TITLE', value: 'x', status: 'ACCEPTED',
    });
    const result = await suggestionsService.acceptSuggestion('s3', 'user-1');
    expect(result.status).toBe('ACCEPTED');
    expect(prismaMock.media.update).not.toHaveBeenCalled();
  });

  it('reject: marks REJECTED without mutating media', async () => {
    prismaMock.mediaSuggestion.findUnique.mockResolvedValue({
      id: 's4', media_id: 'm1', type: 'ALT_TEXT', value: 'alt', status: 'PENDING',
    });
    prismaMock.mediaSuggestion.update.mockResolvedValue({ id: 's4', status: 'REJECTED' });

    const updated = await suggestionsService.rejectSuggestion('s4', 'user-1');

    expect(prismaMock.media.update).not.toHaveBeenCalled();
    expect(tagMediaMock).not.toHaveBeenCalled();
    expect(updated.status).toBe('REJECTED');
  });
});
