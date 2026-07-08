import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, minioMock, reindexMock, getActiveProviderMock } = vi.hoisted(() => ({
  prismaMock: {
    media: { findUnique: vi.fn(), update: vi.fn() },
  },
  minioMock: { getObject: vi.fn() },
  reindexMock: vi.fn(),
  getActiveProviderMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/minio.js', () => ({ minio: minioMock }));
vi.mock('../../src/modules/media/media-search.service.js', () => ({ enqueueReindex: reindexMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: getActiveProviderMock }));

const {
  runTranscribeJob, normalizeSegments, segmentsToSrt, segmentsToVtt,
} = await import('../../src/modules/media/ai/transcribe.service.js');

async function* fakeStream(buf) {
  yield buf;
}

const SEGMENTS = [
  { start: 0, end: 2.5, text: ' Hello world.' },
  { start: 2.5, end: 61.04, text: 'Welcome to the demo.' },
];

beforeEach(() => {
  vi.clearAllMocks();
  minioMock.getObject.mockResolvedValue(fakeStream(Buffer.from('audio-bytes')));
  prismaMock.media.update.mockResolvedValue({});
});

describe('runTranscribeJob', () => {
  const mockDriver = { transcribe: vi.fn() };

  it('throws 501-shaped error when speech_to_text is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    await expect(runTranscribeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 501 });
  });

  it('rejects non-audio/video media with 422', async () => {
    getActiveProviderMock.mockResolvedValue({ driver: mockDriver, credentials: {}, config: {} });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', type: 'IMAGE', path: 'p', original_name: 'x.png' });
    await expect(runTranscribeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 422 });
  });

  it('transcribes via mocked driver, stores normalized segments + text, reindexes', async () => {
    getActiveProviderMock.mockResolvedValue({
      driver: mockDriver, credentials: { api_key: 'k' }, config: { model: 'whisper-1' },
    });
    prismaMock.media.findUnique.mockResolvedValue({
      id: 'm1', type: 'VIDEO', path: 'u/v.mp4', original_name: 'demo.mp4',
    });
    mockDriver.transcribe.mockResolvedValue({
      text: ' Hello world. Welcome to the demo. ',
      segments: [...SEGMENTS, { broken: true }],
      language: 'en',
    });

    const result = await runTranscribeJob({ mediaId: 'm1', language: 'en' });

    expect(mockDriver.transcribe).toHaveBeenCalledWith(expect.objectContaining({
      credentials: { api_key: 'k' },
      filename: 'demo.mp4',
      language: 'en',
    }));
    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        transcript: [
          { start: 0, end: 2.5, text: 'Hello world.' },
          { start: 2.5, end: 61.04, text: 'Welcome to the demo.' },
        ],
        transcript_text: 'Hello world. Welcome to the demo.',
        transcript_lang: 'en',
      },
    });
    expect(reindexMock).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ segments: 2, language: 'en' });
  });
});

describe('normalizeSegments', () => {
  it('drops malformed entries and trims text', () => {
    expect(normalizeSegments([
      { start: 0, end: 1, text: '  a ' },
      { start: 'x', end: 1, text: 'bad' },
      null,
      { start: 1, end: 2 },
    ])).toEqual([
      { start: 0, end: 1, text: 'a' },
      { start: 1, end: 2, text: '' },
    ]);
    expect(normalizeSegments(undefined)).toEqual([]);
  });
});

describe('SRT/VTT export', () => {
  const segments = [
    { start: 0, end: 2.5, text: 'Hello world.' },
    { start: 2.5, end: 61.04, text: 'Welcome to the demo.' },
  ];

  it('renders SRT with comma milliseconds and 1-based indexes', () => {
    const srt = segmentsToSrt(segments);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world.');
    expect(srt).toContain('2\n00:00:02,500 --> 00:01:01,040\nWelcome to the demo.');
  });

  it('renders VTT with header and dot milliseconds', () => {
    const vtt = segmentsToVtt(segments);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500\nHello world.');
  });
});

describe('D4 gate — transcript search', () => {
  it('index doc exposes transcript and Meili declares it searchable', async () => {
    const { readFile } = await import('fs/promises');
    const src = await readFile(
      new URL('../../src/modules/media/media-search.service.js', import.meta.url), 'utf8');
    expect(src).toMatch(/searchableAttributes:[^\]]*'transcript'/s);
    expect(src).toMatch(/transcript: media\.transcript_text/);
  });
});
