import { describe, it, expect, vi } from 'vitest';

describe('search tool regression — MEILI_SEARCH_API_KEY (KDL-26 M5)', () => {
  it('uses MEILI_SEARCH_API_KEY when provided', async () => {
    const originalKey = process.env.MEILI_SEARCH_API_KEY;
    process.env.MEILI_SEARCH_API_KEY = 'scoped-search-key';

    vi.resetModules();
    const { createSearchTool } = await import('../src/tools/search.js');
    const tool = createSearchTool('content');

    expect(tool.name).toBe('meilisearch');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hits: [] }),
    });
    globalThis.fetch = fetchMock;

    await tool.invoke('hello');

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('http://localhost:7700/indexes/content/search');
    expect(call[1].headers.Authorization).toBe('Bearer scoped-search-key');

    process.env.MEILI_SEARCH_API_KEY = originalKey;
  });
});
