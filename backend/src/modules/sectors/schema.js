import { z } from 'zod';

export const listSectorsSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getSectorSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const sectorBody = {
  project_id: z.string().min(1).nullish(),
  eyebrow: z.string().max(200).nullish(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  category: z.string().max(200).nullish(),
  description: z.string().max(4000).nullish(),
  image: z.string().max(500).nullish(),
  cta_label: z.string().max(100).nullish(),
  cta_href: z.string().max(500).nullish(),
  order: z.number().int().default(0),
  is_active: z.boolean().default(true),
};

export const createSectorSchema = z.object({ body: z.object(sectorBody) });

export const updateSectorSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    ...sectorBody,
    name: sectorBody.name.optional(),
    slug: sectorBody.slug.optional(),
    order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteSectorSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
