import { z } from 'zod';

const configSchema = z
  .object({
    category: z.string().min(1),
    atoms: z.array(z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough()),
    settings: z.record(z.any()),
  })
  .passthrough();

export const createCustomBlockBodySchema = z.object({
  projectId: z.string().min(1),
  categoryKey: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  config: configSchema,
});

export const updateCustomBlockBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  config: configSchema.optional(),
});

// Wrapped shapes for the shared `validate(schema)` middleware, which parses
// `{body, query, params}` together — see backend/src/middleware/validate.js.

export const createCustomBlockSchema = z.object({
  body: createCustomBlockBodySchema,
});

export const listCustomBlocksQuerySchema = z.object({
  query: z.object({
    // Omitted by callers with no project context (e.g. the legacy Page
    // Builder editor) — listCustomBlocks then lists across every project.
    projectId: z.string().min(1).optional(),
    category: z.string().min(1),
  }),
});

export const customBlockIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateCustomBlockSchema = z.object({
  body: updateCustomBlockBodySchema,
  params: z.object({ id: z.string().min(1) }),
});
