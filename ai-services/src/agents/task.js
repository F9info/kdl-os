import { BaseAgent } from './base.js';

export class TaskAgent extends BaseAgent {
  constructor(opts) {
    super({ priority: 'LOW', ...opts });
  }

  _buildPrompt(task, memoryContext, context) {
    const parts = [
      'You are a task execution agent. Follow instructions precisely.',
      memoryContext ? `Context:\n${memoryContext}` : null,
      context.steps ? `Steps:\n${context.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : null,
      `Task: ${task}`,
      'Respond with COMPLETE when done.',
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  async _isTaskComplete(result) {
    return /complete/i.test(result);
  }
}
