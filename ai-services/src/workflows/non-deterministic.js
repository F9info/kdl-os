import { BaseWorkflow } from './base.js';
import { brainRouter } from '../orchestrator/brain-router.js';

export class NonDeterministicWorkflow extends BaseWorkflow {
  constructor(opts) {
    super({ priority: 'HIGH', ...opts });
    this.priority = opts.priority ?? 'HIGH';
    this.sessionId = opts.sessionId ?? 'workflow-default';
  }

  async _nextStep(state, lastResult) {
    const stepNames = this.steps.map((s, i) => `${i}: ${s.name}`).join(', ');
    const prompt = [
      `You are directing a workflow. Current step: ${state.currentStep} (${this.steps[state.currentStep]?.name}).`,
      `Result: ${String(lastResult).slice(0, 500)}`,
      `Available steps: ${stepNames}`,
      `Completed: ${state.results.map((r) => r.step).join(', ')}`,
      `Reply with ONLY a step index number, or "done" to finish.`,
    ].join('\n');

    const response = await brainRouter(prompt, this.priority, { sessionId: this.sessionId });
    const text = response.content?.trim() ?? '';

    if (text.toLowerCase() === 'done') return this.steps.length;
    const idx = parseInt(text, 10);
    return isNaN(idx) || idx < 0 || idx >= this.steps.length
      ? state.currentStep + 1
      : idx;
  }
}
