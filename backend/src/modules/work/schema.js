import { z } from 'zod';

export const listWorkSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getWorkSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const getPublicWorkSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  query: z.object({ project_id: z.string().min(1).optional() }),
});

const workBody = {
  project_id: z.string().min(1).nullish(),
  eyebrow: z.string().max(200).nullish(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  subtitle: z.string().max(4000).nullish(),
  image: z.string().max(500).nullish(),
  order: z.number().int().default(0),
  is_active: z.boolean().default(true),
};

export const createWorkSchema = z.object({ body: z.object(workBody) });

export const updateWorkSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    ...workBody,
    name: workBody.name.optional(),
    slug: workBody.slug.optional(),
    order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteWorkSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
