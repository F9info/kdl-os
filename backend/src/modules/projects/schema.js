import { z } from 'zod';
import { IDENTITY_FIELDS } from '../identity/schema.js';

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    is_default: z.boolean().optional().default(false),
  }),
});

export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional(),
    is_default: z.boolean().optional(),
  }),
});

export const answerOnboardingSchema = z.object({
  body: z.object({ frontend: z.enum(['yes', 'no']) }),
});

const layoutSlot = z.object({
  enabled: z.boolean(),
  // '1'-'5' (built-in designs) or custom:<id> (a saved Section Builder block); same rule as template-engine.
  variant: z.string().regex(/^([1-5]|custom:[A-Za-z0-9_-]+)$/),
});

export const saveLayoutSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({ topHeader: layoutSlot.optional(), header: layoutSlot.optional(), footer: layoutSlot.optional() })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Send at least one of topHeader, header, footer' }),
});

// Identity fields a site may override (T5.5). Missing or empty = inherit the project's value.
export const SITE_IDENTITY_KEYS = [
  'app_name',
  'app_title',
  'description',
  'logo_light',
  'favicon',
];
const siteIdentityFields = Object.fromEntries(SITE_IDENTITY_KEYS.map((k) => [k, IDENTITY_FIELDS[k]]));

export const siteIdentityParamsSchema = z.object({
  params: z.object({ id: z.string().min(1), siteId: z.string().min(1) }),
});

// Same field rules as the project Identity; '' removes an override.
export const saveSiteIdentitySchema = z.object({
  params: siteIdentityParamsSchema.shape.params,
  body: z.object(siteIdentityFields).partial().strict(),
});
