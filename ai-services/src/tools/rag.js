import { DynamicTool } from '@langchain/core/tools';
import { ragChain } from '../chains/rag-chain.js';

export function createRagTool(sessionId, priority = 'MEDIUM') {
  return new DynamicTool({
    name: 'rag_search',
    description: 'Search the knowledge base for relevant information. Input: query string.',
    func: async (query) => {
      const result = await ragChain(query, sessionId, priority);
      return result.error ? `Error: ${result.error}` : result.content;
    },
  });
}
