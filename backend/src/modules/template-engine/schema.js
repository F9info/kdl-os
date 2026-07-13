import { z } from 'zod';

const PLATFORMS = ['webapp', 'tv', 'android', 'ios'];
const platformEnum = z.enum(PLATFORMS);

export const getSchemaQuerySchema = z.object({
  query: z.object({
    platform: platformEnum,
  }),
});

export const getValuesQuerySchema = z.object({
  query: z.object({
    platform: platformEnum,
    type: z.string().min(1),
  }),
});

const valueEntrySchema = z.object({
  field_id: z.string().optional(),
  slug: z.string().optional(),
  value: z.string(),
}).refine((v) => v.field_id || v.slug, { message: 'field_id or slug is required' });

export const postValuesBodySchema = z.object({
  body: z.object({
    platform: platformEnum,
    type_id: z.string().min(1),
    values: z.array(valueEntrySchema).min(1),
  }),
});

export const postResetBodySchema = z.object({
  body: z.object({
    platform: platformEnum,
    type_id: z.string().min(1),
  }),
});

export const getTokensQuerySchema = z.object({
  query: z.object({
    platform: platformEnum,
    theme: z.enum(['dark', 'light', 'focus']).optional(),
    device: z.string().optional(),
  }),
});
