import { z } from 'zod';
import { seoSchema } from './seo.js';

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
  // null clears all page SEO; empty strings inside are cleaned away by the service.
  seo: seoSchema.nullable().optional(),
});

// Body of POST /:id/publish: the content saved as part of publishing (all optional; defaults to
// the pending draft). Status is implied.
export const publishPageSchema = updatePageSchema
  .omit({ status: true })
  .extend({ force: z.boolean().optional() }); // force = "publish anyway" despite check errors
