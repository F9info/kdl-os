import { z } from 'zod';
import { PLATFORMS as PLATFORM_DEFS } from './schema/index.js';

const PLATFORM_IDS = ['webapp', 'tv', 'android', 'ios'];
const platformEnum = z.enum(PLATFORM_IDS);

const ALL_DEVICE_IDS = [...new Set(PLATFORM_DEFS.flatMap((p) => p.devices.map((d) => d.id)))];
const deviceEnum = z.enum([...ALL_DEVICE_IDS, 'all']).optional();

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

export const postActiveThemeBodySchema = z.object({
  body: z.object({
    platform: platformEnum,
    theme: z.enum(['dark', 'light', 'system']),
  }),
});

export const getTokensQuerySchema = z.object({
  query: z
    .object({
      platform: platformEnum,
      theme: z.enum(['dark', 'light', 'focus']).optional(),
      device: deviceEnum,
    })
    .superRefine((q, ctx) => {
      // A device id must belong to the requested platform — a cross-platform
      // pair compiles nothing useful and caches under a key that per-platform
      // invalidation never deletes.
      if (!q.device || q.device === 'all') return;
      const plat = PLATFORM_DEFS.find((p) => p.id === q.platform);
      if (!plat?.devices.some((d) => d.id === q.device)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['device'],
          message: `device "${q.device}" does not belong to platform "${q.platform}"`,
        });
      }
    }),
});
