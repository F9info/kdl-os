import { z } from 'zod';

const configSchema = z
  .object({
    category: z.string().min(1),
    atoms: z.array(z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough()),
    settings: z.record(z.any()),
  })
  .passthrough();

export const createCustomBlockSchema = z.object({
  projectId: z.string().min(1),
  categoryKey: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  config: configSchema,
});

export const updateCustomBlockSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  config: configSchema.optional(),
});
