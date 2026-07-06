import { z } from 'zod';

export const createExampleSchema = z.object({
  // TODO: add fields
});

export const updateExampleSchema = createExampleSchema.partial();
