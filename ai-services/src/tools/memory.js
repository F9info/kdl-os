import { DynamicTool } from '@langchain/core/tools';
import { searchMemory } from '../memory/long-term.js';

export function createMemoryTool() {
  return new DynamicTool({
    name: 'long_term_memory',
    description: 'Search long-term vector memory for stored knowledge. Input: query string.',
    func: async (query) => {
      const results = await searchMemory(query, 3);
      if (results.length === 0) return 'No relevant memories found.';
      return results.map((r, i) => `[${i + 1}] ${r.document}`).join('\n');
    },
  });
}
