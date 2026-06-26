import { BaseAgent } from './base.js';

export class ContentAgent extends BaseAgent {
  constructor(opts) {
    super({ priority: 'MEDIUM', ...opts });
  }

  _buildPrompt(task, memoryContext, context) {
    const parts = [
      'You are a content generation agent. Produce high-quality written content.',
      memoryContext ? `Context:\n${memoryContext}` : null,
      context.tone ? `Tone: ${context.tone}` : null,
      context.format ? `Format: ${context.format}` : null,
      `Content task: ${task}`,
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  async _isTaskComplete(result) {
    return result.length > 100;
  }
}
