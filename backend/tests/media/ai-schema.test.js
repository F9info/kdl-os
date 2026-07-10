import { describe, it, expect } from 'vitest';
import { createAiProviderSchema } from '../../src/modules/media/ai/schema.js';

// Regression: the Phase D5 embeddings feature/driver was added to the driver
// registry (drivers/index.js FEATURES) but this schema's featureEnum was never
// updated, so POST /media/ai/providers 422'd for every embeddings provider —
// undetected because the D5 vitest suites only exercised the service layer
// directly, bypassing controller-level Zod validation. Found via the D9 E2E gate.
describe('createAiProviderSchema — feature enum', () => {
  it('accepts all 4 v1 AI features, including embeddings', () => {
    for (const feature of ['vision', 'image_ops', 'speech_to_text', 'embeddings']) {
      const result = createAiProviderSchema.safeParse({
        feature, driver: 'x', name: 'n', credentials: {},
      });
      expect(result.success, feature).toBe(true);
    }
  });

  it('rejects an unknown feature', () => {
    const result = createAiProviderSchema.safeParse({
      feature: 'not-a-feature', driver: 'x', name: 'n', credentials: {},
    });
    expect(result.success).toBe(false);
  });
});
