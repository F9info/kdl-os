import { z } from 'zod';
import { updatedSinceField } from '../../shared/utils/updated-since.js';

export const listGallerySchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
    updated_since: updatedSinceField,
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

const fields = {
  project_id: z.string().min(1).nullish(),
  title: z.string().min(1).max(200),
  image_url: z.string().min(1).max(2000),
  caption: z.string().max(1000).nullish(),
  album: z.string().max(100).nullish(),
  order: z.number().int(),
  is_active: z.boolean(),
};

export const createGallerySchema = z.object({
  body: z.object({ ...fields, order: fields.order.default(0), is_active: fields.is_active.default(true) }),
});

export const updateGallerySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object(fields).partial(),
});
