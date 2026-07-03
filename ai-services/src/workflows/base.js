import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const BLOCKERS_PATH = join(__dir, '../../../BLOCKERS.md');

export class BaseWorkflow {
  constructor({ name, steps = [], maxIterations = 20 }) {
    this.name = name;
    this.steps = steps;
    this.maxIterations = maxIterations;
  }

  async run(input) {
    let iterations = 0;
    let state = { input, results: [], currentStep: 0 };

    while (state.currentStep < this.steps.length && iterations < this.maxIterations) {
      iterations++;
      const step = this.steps[state.currentStep];

      try {
        const stepResult = await step.fn(state);
        state.results.push({ step: step.name, output: stepResult, iteration: iterations });
        state.currentStep = await this._nextStep(state, stepResult);
      } catch (err) {
        state.results.push({ step: step.name, error: err.message, iteration: iterations });
        break;
      }
    }

    if (iterations >= this.maxIterations) {
      await this._writeBlockers(`Workflow "${this.name}" hit maxIterations (${this.maxIterations}). State: ${JSON.stringify(state.results.slice(-3))}`);
    }

    return { state, iterations, completed: iterations < this.maxIterations };
  }

  async _nextStep(state, _result) {
    return state.currentStep + 1;
  }

  async _writeBlockers(message) {
    try {
      let existing = '';
      try { existing = await readFile(BLOCKERS_PATH, 'utf8'); } catch { /* file may not exist */ }
      const entry = `\n## ${new Date().toISOString()} — ${this.name}\n${message}\n`;
      await writeFile(BLOCKERS_PATH, existing + entry, 'utf8');
    } catch { /* non-fatal */ }
  }
}
