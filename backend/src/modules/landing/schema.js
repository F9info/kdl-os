import { z } from 'zod';
import { TEMPLATE_KEYS } from './templates.js';

export const createLandingSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens'),
    template: z.enum(TEMPLATE_KEYS).default('blank'),
  }),
});
