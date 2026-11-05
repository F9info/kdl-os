import { z } from 'zod';

export const listTestimonialSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

const fields = {
  project_id: z.string().min(1).nullish(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).nullish(),
  quote: z.string().min(1).max(2000),
  photo_url: z.string().max(2000).nullish(),
  order: z.number().int(),
  is_active: z.boolean(),
};

export const createTestimonialSchema = z.object({
  body: z.object({ ...fields, order: fields.order.default(0), is_active: fields.is_active.default(true) }),
});

export const updateTestimonialSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object(fields).partial(),
});
