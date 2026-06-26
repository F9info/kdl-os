import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { brainRouter } from '../orchestrator/brain-router.js';
import { getMemory, setMemory } from '../memory/short-term.js';
import { searchMemory } from '../memory/long-term.js';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const BLOCKERS_PATH = join(__dir, '../../../BLOCKERS.md');
const MAX_ITERATIONS = 10;

export class BaseAgent {
  constructor({ sessionId, priority = 'MEDIUM', tools = [], maxIterations = MAX_ITERATIONS }) {
    this.sessionId = sessionId;
    this.priority = priority;
    this.tools = tools;
    this.maxIterations = maxIterations;
  }

  async run(task, context = {}) {
    let iterations = 0;
    let currentTask = task;
    let result = null;

    while (iterations < this.maxIterations) {
      iterations++;

      const relevantMemory = await searchMemory(currentTask, 3);
      const memoryContext = relevantMemory.map((m) => m.document).join('\n');

      const prompt = this._buildPrompt(currentTask, memoryContext, context);
      const response = await brainRouter(prompt, this.priority, { sessionId: this.sessionId });

      if (response.error) {
        return { error: response.error, iterations };
      }

      result = response.content;

      const done = await this._isTaskComplete(result, currentTask);
      if (done) break;

      currentTask = await this._getNextStep(result, currentTask);
    }

    if (iterations >= this.maxIterations) {
      await this._writeBlockers(
        `${this.constructor.name}.run() hit maxIterations (${this.maxIterations}) for session ${this.sessionId}. Priority: ${this.priority}.`
      );
    }

    return { result, iterations };
  }

  _buildPrompt(task, memoryContext, _context) {
    const parts = ['You are an AI agent. Complete the task below.'];
    if (memoryContext) parts.push(`Relevant memory:\n${memoryContext}`);
    parts.push(`Task: ${task}`);
    return parts.join('\n\n');
  }

  async _isTaskComplete(result, _originalTask) {
    return result.toLowerCase().includes('done') || result.toLowerCase().includes('complete');
  }

  async _getNextStep(result, _originalTask) {
    return result;
  }

  async _writeBlockers(message) {
    try {
      let existing = '';
      try { existing = await readFile(BLOCKERS_PATH, 'utf8'); } catch { /* file may not exist */ }
      const entry = `\n## ${new Date().toISOString()} — ${this.constructor.name} (session: ${this.sessionId})\n${message}\n`;
      await writeFile(BLOCKERS_PATH, existing + entry, 'utf8');
    } catch { /* non-fatal */ }
  }
}
