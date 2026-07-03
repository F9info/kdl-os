import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  chroma: {
    getOrCreateCollection: vi.fn(),
  },
  openrouterEmbed: vi.fn(),
}));

vi.mock('../src/config/chroma.js', () => ({ chroma: mocks.chroma }));
vi.mock('../src/brains/openrouter.js', () => ({ openrouterEmbed: mocks.openrouterEmbed }));
vi.mock('p-limit', () => ({
  default: () => (fn) => fn(),
}));

import { ingestDocument } from '../src/knowledge/ingest.js';

describe('knowledge ingest regression — bounded embed concurrency (KDL-26 M4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chroma.getOrCreateCollection.mockResolvedValue({
      upsert: vi.fn().mockResolvedValue(undefined),
    });
    mocks.openrouterEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it('creates one embedding per chunk and upserts with metadata', async () => {
    const content = 'word '.repeat(600);
    const metadata = { source: 'test-doc' };

    const result = await ingestDocument(content, metadata);

    expect(result.chunks).toBeGreaterThan(1);
    expect(mocks.openrouterEmbed).toHaveBeenCalledTimes(result.chunks);
    const c = await mocks.chroma.getOrCreateCollection.mock.results[0].value;
    const upsertCall = c.upsert.mock.calls[0][0];
    expect(upsertCall.documents).toHaveLength(result.chunks);
    expect(upsertCall.embeddings).toHaveLength(result.chunks);
    expect(upsertCall.metadatas).toHaveLength(result.chunks);
    expect(upsertCall.metadatas[0]).toMatchObject({
      source: 'test-doc',
      chunk_index: 0,
      total_chunks: result.chunks,
    });
  });
});
