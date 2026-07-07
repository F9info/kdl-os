import { z } from 'zod';

export const createIntegrationsSchema = z.object({
  // TODO: add fields
});

export const updateIntegrationsSchema = createIntegrationsSchema.partial();
