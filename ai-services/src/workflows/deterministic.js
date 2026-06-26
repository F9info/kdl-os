import { BaseWorkflow } from './base.js';

export class DeterministicWorkflow extends BaseWorkflow {
  constructor(opts) {
    super(opts);
  }

  async _nextStep(state, _result) {
    return state.currentStep + 1;
  }
}
