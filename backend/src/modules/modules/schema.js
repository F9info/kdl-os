import { z } from 'zod';

export const settingsPatchSchema = z.object({
  body: z.object({
    settings: z.record(z.unknown()),
  }),
});

export const slugParamSchema = z.object({
  params: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must contain only lowercase letters, digits, and hyphens'),
  }),
});

export const resolveConflictsSchema = z.object({
  params: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must contain only lowercase letters, digits, and hyphens'),
  }),
  body: z
    .object({
      resolveConflicts: z.boolean().optional().default(false),
    })
    .optional()
    .default({}),
});

// ?products=website,landing previews a selection (comma list); omitted = the stored selection.
export const graphQuerySchema = z.object({
  query: z.object({
    products: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v.split(',').map((p) => p.trim()).filter(Boolean))),
  }),
});

export const productsBodySchema = z.object({
  body: z.object({
    products: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20),
    // Optional: how the Website product is delivered (see products.js). Omitted = leave unchanged.
    delivery: z.enum(['web-app', 'static', 'both']).optional(),
  }),
});
