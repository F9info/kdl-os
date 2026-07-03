import { DynamicTool } from '@langchain/core/tools';

const MEILI_HOST = process.env.MEILISEARCH_HOST ?? 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_SEARCH_API_KEY ?? '';

export function createSearchTool(index = 'all') {
  return new DynamicTool({
    name: 'meilisearch',
    description: 'Full-text search across indexed content. Input: search query string.',
    func: async (query) => {
      const url = `${MEILI_HOST}/indexes/${index}/search`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MEILI_KEY}`,
        },
        body: JSON.stringify({ q: query, limit: 5 }),
      });
      if (!res.ok) return `Search failed: ${res.status}`;
      const data = await res.json();
      const hits = data.hits ?? [];
      if (hits.length === 0) return 'No results found.';
      return hits.map((h, i) => `[${i + 1}] ${JSON.stringify(h)}`).join('\n');
    },
  });
}
