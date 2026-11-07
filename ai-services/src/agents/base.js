import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { brainRouter } from '../orchestrator/brain-router.js';
import { wrapUntrusted } from '../governance/compliance.js';
import { estimateCostUsd } from '../config/model-pricing.js';
import { searchMemory } from '../memory/long-term.js';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const BLOCKERS_PATH = join(__dir, '../../../BLOCKERS.md');
const MAX_ITERATIONS = 10;
// One run may not spend more than this, whatever the iteration cap allows (USD).
const MAX_RUN_COST_USD = parseFloat(process.env.AGENT_RUN_BUDGET_USD ?? '1.00');

export class BaseAgent {
  constructor({ sessionId, tenantId, priority = 'MEDIUM', tools = [], maxIterations = MAX_ITERATIONS, maxRunCostUsd = MAX_RUN_COST_USD }) {
    // Required: long-term memory and RAG are tenant-namespaced (no shared fallback).
    if (!tenantId) throw new Error('tenantId is required to construct an agent');
    this.sessionId = sessionId;
    this.tenantId = tenantId;
    this.priority = priority;
    this.tools = tools;
    this.maxIterations = maxIterations;
    this.maxRunCostUsd = maxRunCostUsd;
  }

  async run(task, context = {}) {
    let iterations = 0;
    let currentTask = task;
    let result = null;
    let spent = 0;
    let overBudget = false;

    while (iterations < this.maxIterations) {
      iterations++;

      const relevantMemory = await searchMemory(currentTask, 3, this.tenantId);
      const memoryContext = wrapUntrusted(relevantMemory.map((m) => m.document));

      const prompt = this._buildPrompt(currentTask, memoryContext, context);
      const response = await brainRouter(prompt, this.priority, { sessionId: this.sessionId, tenantId: this.tenantId });

      if (response.error) {
        return { error: response.error, iterations };
      }

      result = response.content;

      spent += response.cost ?? estimateCostUsd(response.model, response.usage);
      if (spent >= this.maxRunCostUsd) {
        overBudget = true;
        break;
      }

      const done = await this._isTaskComplete(result, currentTask);
      if (done) break;

      currentTask = await this._getNextStep(result, currentTask);
    }

    if (overBudget) {
      await this._writeBlockers(
        `${this.constructor.name}.run() stopped: spent ~$${spent.toFixed(4)} of the $${this.maxRunCostUsd} per-run cap, session ${this.sessionId}.`
      );
    } else if (iterations >= this.maxIterations) {
      await this._writeBlockers(
        `${this.constructor.name}.run() hit maxIterations (${this.maxIterations}) for session ${this.sessionId}. Priority: ${this.priority}.`
      );
    }

    return { result, iterations, ...(overBudget ? { stopped: 'run_budget' } : {}) };
  }

  _buildPrompt(task, memoryContext, _context) {
    const parts = ['You are an AI agent. Complete the task below.'];
    if (memoryContext) parts.push(memoryContext);
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
