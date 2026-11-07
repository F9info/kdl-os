import { z } from 'zod';
const keyField = z.string().trim().min(1).max(100);

export const createLandingSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens'),
    // Any key in the template library (built-in or user-made). Unknown keys answer 404 from the service.
    template: keyField.default('blank'),
  }),
});

const text = (max) => z.string().trim().max(max);
export const templateKeyParams = z.object({ params: z.object({ key: keyField }) });
export const duplicateTemplateSchema = z.object({
  params: templateKeyParams.shape.params,
  body: z.object({ name: text(200).optional() }).default({}),
});
export const updateTemplateSchema = z.object({
  params: templateKeyParams.shape.params,
  body: z.object({ name: text(200).min(1).optional(), description: text(1000).optional() }).strict(),
});
export const saveAsTemplateSchema = z.object({
  body: z.object({ pageId: z.string().min(1), name: text(200).min(1), description: text(1000).optional() }),
});
