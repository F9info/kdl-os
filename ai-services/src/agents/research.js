import { BaseAgent } from './base.js';
import { ragChain } from '../chains/rag-chain.js';

export class ResearchAgent extends BaseAgent {
  constructor(opts) {
    super({ priority: 'HIGH', ...opts });
  }

  _buildPrompt(task, memoryContext, context) {
    const parts = [
      'You are a research agent. Gather, analyse, and synthesise accurate information.',
      memoryContext ? `Memory context:\n${memoryContext}` : null,
      context.sources ? `Available sources:\n${context.sources}` : null,
      `Research task: ${task}`,
      'Respond with: FINDINGS: <findings> | DONE',
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  async run(task, context = {}) {
    const ragResult = await ragChain(task, this.sessionId, 'HIGH');
    if (ragResult.error) return { error: ragResult.error, iterations: 0 };
    const enrichedContext = { ...context, ragContext: ragResult.content };
    return super.run(task, enrichedContext);
  }
}
