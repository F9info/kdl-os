import { z } from 'zod';
import { BUTTON_KEYS, FORM_KEYS } from './site-styles.js';
import { PLATFORMS as PLATFORM_DEFS } from './schema/index.js';

// Derived from the real PLATFORMS list, not hand-duplicated — a platform id
// added there (e.g. webapp_admin) is instantly valid here too.
const PLATFORM_IDS = PLATFORM_DEFS.map((p) => p.id);
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

export const getVersionsQuerySchema = z.object({
  query: z.object({
    platform: platformEnum,
    type_id: z.string().min(1),
  }),
});

export const postRestoreVersionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const postActiveThemeBodySchema = z.object({
  body: z.object({
    platform: platformEnum,
    theme: z.enum(['dark', 'light', 'system']),
  }),
});

export const postLocksReleaseBodySchema = z.object({
  body: z.object({
    platform: platformEnum.optional(),
    type_id: z.string().min(1).optional(),
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

// Website button and form-field style (site-styles.js). At least one of the two.
export const putSiteStylesBodySchema = z.object({
  body: z
    .object({
      button: z.enum(BUTTON_KEYS).optional(),
      form: z.enum(FORM_KEYS).optional(),
    })
    .strict()
    .refine((b) => b.button !== undefined || b.form !== undefined, {
      message: 'Send button, form or both',
    }),
});

// ── Theme presets (T10) ──────────────────────────────────────────────────────
const hex6 = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #1a2b3c');
const paletteSchema = z
  .object({ primary: hex6, secondary: hex6, accent: hex6, highlight: hex6, background: hex6, text: hex6 })
  .strict();
const presetKey = z.string().trim().min(1).max(100);
export const createPresetSchema = z.object({
  body: z.object({ name: z.string().trim().min(1).max(60), light: paletteSchema, dark: paletteSchema }),
});
export const updatePresetSchema = z.object({
  params: z.object({ key: presetKey }),
  body: z
    .object({ name: z.string().trim().min(1).max(60), light: paletteSchema, dark: paletteSchema })
    .partial()
    .strict(),
});
export const presetKeyParams = z.object({ params: z.object({ key: presetKey }) });
export const duplicatePresetSchema = z.object({
  params: z.object({ key: presetKey }),
  body: z.object({ name: z.string().trim().max(60).optional() }).default({}),
});
