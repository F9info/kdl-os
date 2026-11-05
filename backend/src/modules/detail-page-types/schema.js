import { z } from 'zod';

const slugField = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only');

export const getDetailPageTypesSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
  }),
});

export const createTypeSchema = z.object({
  body: z.object({
    project_id: z.string().min(1),
    name: z.string().min(1).max(100),
    label: z.string().min(1).max(100).optional(),
    nav_parent_label: z.string().min(1).max(100).optional(),
    slug_prefix: slugField.optional(),
  }),
});

export const typeParamsSchema = z.object({
  params: z.object({ typeKey: z.string().min(1) }),
  query: z.object({ project_id: z.string().min(1) }),
});

export const createEntrySchema = z.object({
  params: z.object({ typeKey: z.string().min(1) }),
  body: z.object({
    project_id: z.string().min(1),
    title: z.string().min(1).max(200),
    slug: slugField.optional(),
    description: z.string().max(4000).nullish(),
    body: z.string().max(100000).nullish(),
    image: z.string().max(500).nullish(),
  }),
});

export const updateEntrySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    project_id: z.string().min(1),
    title: z.string().min(1).max(200).optional(),
    slug: slugField.optional(),
    description: z.string().max(4000).nullish(),
    body: z.string().max(100000).nullish(),
    image: z.string().max(500).nullish(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteEntrySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({ project_id: z.string().min(1) }),
});

export const getPublicEntrySchema = z.object({
  params: z.object({ prefix: z.string().min(1), slug: z.string().min(1) }),
  query: z.object({ project_id: z.string().min(1).optional() }),
});

export const convertLegacySchema = z.object({
  body: z.object({ project_id: z.string().min(1) }),
});
