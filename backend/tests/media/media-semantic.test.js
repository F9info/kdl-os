import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mocks ───────────────────────────────────────────────────────────
const {
  prismaMock, chromaMock, collectionMock, getActiveProviderMock, meiliMock, meiliSearchMock,
} = vi.hoisted(() => {
  const collectionMock = { upsert: vi.fn(), delete: vi.fn(), query: vi.fn() };
  const meiliSearchMock = vi.fn();
  return {
    prismaMock: {
      media: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    chromaMock: { getOrCreateCollection: vi.fn(async () => collectionMock) },
    collectionMock,
    getActiveProviderMock: vi.fn(),
    meiliMock: { index: vi.fn(() => ({ search: meiliSearchMock })) },
    meiliSearchMock,
  };
});

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/chromadb.js', () => ({ chroma: chromaMock }));
vi.mock('../../src/config/meilisearch.js', () => ({ meili: meiliMock }));
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({
  getActiveProvider: getActiveProviderMock,
}));

const {
  buildEmbeddingText, runEmbedJob, semanticSearchIds, mergeHybrid, searchMediaSemantic,
} = await import('../../src/modules/media/ai/media-semantic.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  chromaMock.getOrCreateCollection.mockImplementation(async () => collectionMock);
  meiliMock.index.mockImplementation(() => ({ search: meiliSearchMock }));
});

// ─── buildEmbeddingText ─────────────────────────────────────────────────────

describe('buildEmbeddingText', () => {
  it('flattens caption + tags + ocr_text + transcript_text', () => {
    const media = {
      caption: 'A sunset over the beach',
      tags: [{ tag: { name: 'sunset' } }, { tag: { name: 'beach' } }],
      ocr_text: 'BEACH HOUSE FOR SALE',
      transcript_text: 'waves crashing in the background',
    };
    expect(buildEmbeddingText(media)).toBe(
      'A sunset over the beach\nsunset beach\nBEACH HOUSE FOR SALE\nwaves crashing in the background'
    );
  });

  it('skips empty/missing fields and returns empty string when nothing embeddable', () => {
    expect(buildEmbeddingText({ tags: [] })).toBe('');
    expect(buildEmbeddingText({ caption: '   ', tags: [], ocr_text: null, transcript_text: undefined })).toBe('');
  });

  it('accepts plain tag shape ({ name }) as well as pivot shape ({ tag: { name } })', () => {
    const media = { caption: 'x', tags: [{ name: 'a' }, { tag: { name: 'b' } }] };
    expect(buildEmbeddingText(media)).toBe('x\na b');
  });
});

// ─── mergeHybrid ────────────────────────────────────────────────────────────

describe('mergeHybrid', () => {
  it('preserves semantic rank order and drops ids not present in meiliHits', () => {
    const semanticIds = ['m3', 'm1', 'm2'];
    const meiliHits = [{ id: 'm1', title: 'A' }, { id: 'm2', title: 'B' }];
    expect(mergeHybrid(semanticIds, meiliHits)).toEqual([
      { id: 'm1', title: 'A' },
      { id: 'm2', title: 'B' },
    ]);
  });

  it('returns [] when semanticIds is empty', () => {
    expect(mergeHybrid([], [{ id: 'm1' }])).toEqual([]);
  });

  it('returns [] when meiliHits is empty', () => {
    expect(mergeHybrid(['m1', 'm2'], [])).toEqual([]);
  });

  it('returns [] when there is no overlap at all', () => {
    expect(mergeHybrid(['m1', 'm2'], [{ id: 'm9' }])).toEqual([]);
  });
});

// ─── runEmbedJob ────────────────────────────────────────────────────────────

describe('runEmbedJob', () => {
  it('skips (no Chroma/DB access) when the embeddings feature is unconfigured', async () => {
    getActiveProviderMock.mockResolvedValue(null);
    const result = await runEmbedJob({ media_id: 'm1' });
    expect(result).toEqual({ skipped: true, reason: 'embeddings feature not configured' });
    expect(prismaMock.media.findFirst).not.toHaveBeenCalled();
    expect(chromaMock.getOrCreateCollection).not.toHaveBeenCalled();
  });

  it('embeds and upserts text built from caption+tags+ocr_text+transcript_text', async () => {
    const driverEmbed = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);
    getActiveProviderMock.mockResolvedValue({
      driver: { embed: driverEmbed }, credentials: { api_key: 'k' }, config: { model: 'm' },
    });
    prismaMock.media.findFirst.mockResolvedValue({
      id: 'm1',
      caption: 'A sunset over the beach',
      tags: [{ tag: { name: 'sunset' } }],
      ocr_text: 'BEACH HOUSE',
      transcript_text: 'waves crashing',
    });

    const result = await runEmbedJob({ media_id: 'm1' });

    const expectedText = 'A sunset over the beach\nsunset\nBEACH HOUSE\nwaves crashing';
    expect(driverEmbed).toHaveBeenCalledWith({
      credentials: { api_key: 'k' }, config: { model: 'm' }, texts: [expectedText],
    });
    expect(collectionMock.upsert).toHaveBeenCalledWith({
      ids: ['m1'], embeddings: [[0.1, 0.2, 0.3]], documents: [expectedText],
    });
    expect(collectionMock.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ embedded: true });
  });

  it('deletes any stale vector and skips embedding when the doc has no embeddable text', async () => {
    getActiveProviderMock.mockResolvedValue({
      driver: { embed: vi.fn() }, credentials: {}, config: {},
    });
    prismaMock.media.findFirst.mockResolvedValue({ id: 'm1', caption: null, tags: [], ocr_text: null, transcript_text: null });

    const result = await runEmbedJob({ media_id: 'm1' });

    expect(collectionMock.delete).toHaveBeenCalledWith({ ids: ['m1'] });
    expect(collectionMock.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: 'no embeddable text' });
  });

  it('deletes any stale vector when the media no longer exists (deleted/missing)', async () => {
    getActiveProviderMock.mockResolvedValue({
      driver: { embed: vi.fn() }, credentials: {}, config: {},
    });
    prismaMock.media.findFirst.mockResolvedValue(null);

    const result = await runEmbedJob({ media_id: 'gone' });

    expect(collectionMock.delete).toHaveBeenCalledWith({ ids: ['gone'] });
    expect(collectionMock.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: true });
  });
});

// ─── semanticSearchIds ──────────────────────────────────────────────────────

describe('semanticSearchIds', () => {
  it('embeds the query and returns Chroma ids in rank order', async () => {
    const provider = { driver: { embed: vi.fn().mockResolvedValue([[0.9, 0.1]]) }, credentials: {}, config: {} };
    collectionMock.query.mockResolvedValue({ ids: [['m3', 'm1', 'm2']] });

    const ids = await semanticSearchIds(provider, 'sunset beach', 50);

    expect(provider.driver.embed).toHaveBeenCalledWith({ credentials: {}, config: {}, texts: ['sunset beach'] });
    expect(collectionMock.query).toHaveBeenCalledWith({ queryEmbeddings: [[0.9, 0.1]], nResults: 50 });
    expect(ids).toEqual(['m3', 'm1', 'm2']);
  });

  it('returns [] when Chroma has no results yet', async () => {
    const provider = { driver: { embed: vi.fn().mockResolvedValue([[0.1]]) }, credentials: {}, config: {} };
    collectionMock.query.mockResolvedValue({ ids: [] });
    expect(await semanticSearchIds(provider, 'q')).toEqual([]);
  });
});

// ─── searchMediaSemantic — D5 gate: "E2E: NL query finds fixture" ─────────
// (vitest-level fixture proving the semantic→Meili pipeline finds a planted
// fixture doc; a full HTTP/Playwright E2E is consolidated under D9 per the
// arch doc, see .agents/DECISIONS.md MEDIA-004.)

describe('searchMediaSemantic', () => {
  it('intersects Chroma top-K with Meili-filtered hits, preserving semantic rank order', async () => {
    const provider = { driver: { embed: vi.fn().mockResolvedValue([[0.5, 0.5]]) }, credentials: {}, config: {} };
    // Semantic order from Chroma: the planted fixture ("m1") ranks first.
    collectionMock.query.mockResolvedValue({ ids: [['m1', 'm3', 'm2']] });
    // Meili filters (e.g. type/folder) exclude m3 — only m1 and m2 remain live.
    meiliSearchMock.mockResolvedValue({
      hits: [{ id: 'm2', title: 'Beach house listing' }, { id: 'm1', title: 'Golden hour at the shore' }],
    });
    prismaMock.media.findMany.mockResolvedValue([
      { id: 'm2', title: 'Beach house listing' },
      { id: 'm1', title: 'Golden hour at the shore' },
    ]);

    const result = await searchMediaSemantic(provider, { q: 'sunset beach fixture', archived: 'all' });

    expect(meiliMock.index).toHaveBeenCalledWith('media');
    const [, opts] = meiliSearchMock.mock.calls[0];
    expect(opts.filter).toBe('id IN ["m1", "m3", "m2"]');

    // Hybrid order follows semantic rank (m1 before m2), not Meili's hit order.
    expect(result.hits.map((h) => h.id)).toEqual(['m1', 'm2']);
    expect(result.media.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result.pagination).toEqual({ page: 1, limit: 50, total: 2, pages: 1 });
  });

  it('short-circuits to an empty result without touching Chroma/Meili when q is blank', async () => {
    const provider = { driver: { embed: vi.fn() }, credentials: {}, config: {} };
    const result = await searchMediaSemantic(provider, { q: '   ' });
    expect(provider.driver.embed).not.toHaveBeenCalled();
    expect(result).toEqual({ hits: [], media: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
  });

  it('returns an empty result when the semantic query has no Chroma matches', async () => {
    const provider = { driver: { embed: vi.fn().mockResolvedValue([[0.1]]) }, credentials: {}, config: {} };
    collectionMock.query.mockResolvedValue({ ids: [[]] });
    const result = await searchMediaSemantic(provider, { q: 'nothing like this exists' });
    expect(result).toEqual({ hits: [], media: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
    expect(meiliSearchMock).not.toHaveBeenCalled();
  });
});

// ─── Controller — GET /media/search?mode=semantic ──────────────────────────

describe('searchMedia controller — mode=semantic', () => {
  const makeRes = () => {
    const res = { statusCode: null, body: null };
    res.status = vi.fn((code) => { res.statusCode = code; return res; });
    res.json = vi.fn((body) => { res.body = body; return res; });
    return res;
  };

  it('responds 501 when no embeddings provider is configured', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/database.js', () => ({ prisma: prismaMock }));
    vi.doMock('../../src/shared/services/storage.service.js', () => ({
      uploadFile: vi.fn(), getFileUrl: vi.fn(), deleteFile: vi.fn(), deleteFiles: vi.fn(), copyFile: vi.fn(),
    }));
    vi.doMock('../../src/modules/media/media.queue.js', () => ({
      enqueueVariantJob: vi.fn(), enqueueScanJob: vi.fn(async () => {}),
    }));
    vi.doMock('../../src/modules/user-management/shared/activity-logger.js', () => ({
      writeActivityAsync: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1'),
    }));
    vi.doMock('../../src/modules/media/ai/ai-provider.service.js', () => ({
      getActiveProvider: vi.fn().mockResolvedValue(null),
    }));
    const searchMediaSemanticMock = vi.fn();
    vi.doMock('../../src/modules/media/ai/media-semantic.service.js', () => ({
      searchMediaSemantic: searchMediaSemanticMock,
    }));

    const { searchMedia } = await import('../../src/modules/media/controller.js');
    const req = {
      validated: { query: { mode: 'semantic', q: 'sunset beach' } },
      user: { userId: 'u1' },
      userPermissions: { bypass: false },
    };
    const res = makeRes();
    const next = vi.fn();

    await searchMedia(req, res, next);

    expect(res.statusCode).toBe(501);
    expect(res.body).toMatchObject({
      success: false,
      message: 'AI feature "embeddings" is not configured',
    });
    expect(searchMediaSemanticMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    vi.doUnmock('../../src/config/database.js');
    vi.doUnmock('../../src/shared/services/storage.service.js');
    vi.doUnmock('../../src/modules/media/media.queue.js');
    vi.doUnmock('../../src/modules/user-management/shared/activity-logger.js');
    vi.doUnmock('../../src/modules/media/ai/ai-provider.service.js');
    vi.doUnmock('../../src/modules/media/ai/media-semantic.service.js');
  });
});
