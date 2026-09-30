import { z } from 'zod';

export const listCatalogSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getCatalogSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const getPublicCatalogSchema = z.object({
  params: z.object({
    slug: z.string().min(1),
  }),
  query: z.object({
    project_id: z.string().min(1).optional(),
  }),
});

const catalogBody = {
  project_id: z.string().min(1).nullish(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  category: z.string().max(200).nullish(),
  description: z.string().max(4000).nullish(),
  image: z.string().max(500).nullish(),
  brand_tag: z.string().max(300).nullish(),
  order: z.number().int().default(0),
  is_active: z.boolean().default(true),
};

export const createCatalogSchema = z.object({ body: z.object(catalogBody) });

export const updateCatalogSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    ...catalogBody,
    name: catalogBody.name.optional(),
    slug: catalogBody.slug.optional(),
    order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteCatalogSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
