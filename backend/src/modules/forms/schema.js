import { z } from 'zod';
import { fieldsSchema } from './fields.js';

const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens');

const formBody = {
  name: z.string().trim().min(1).max(200),
  fields: fieldsSchema,
  submit_label: z.string().trim().min(1).max(60),
  success_message: z.string().trim().min(1).max(300),
  // Empty string clears it.
  notify_email: z.union([z.string().email().max(254), z.literal('')]).nullable(),
  is_active: z.boolean(),
};

// Only name and slug are required; fields default to name/email/message, the rest to column defaults.
export const createFormSchema = z.object({
  body: z.object(formBody).partial().required({ name: true }).extend({ slug }),
});

export const updateFormSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object(formBody).partial().strict(),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

export const slugParamSchema = z.object({ params: z.object({ slug }) });

export const submissionsQuerySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
});
