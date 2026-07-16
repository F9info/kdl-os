import { z } from 'zod';

// Puck `Data` is a free-form JSON tree; we validate the envelope, not the tree.
const puckData = z.object({
  root: z.object({ props: z.record(z.any()).optional() }).passthrough(),
  content: z.array(z.any()),
  zones: z.record(z.any()).optional(),
}).passthrough();

export const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens'),
  data: puckData.optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: puckData.optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});
