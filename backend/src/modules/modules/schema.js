import { z } from 'zod';

export const settingsPatchSchema = z.object({
  body: z.object({
    settings: z.record(z.unknown()),
  }),
});

export const slugParamSchema = z.object({
  params: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must contain only lowercase letters, digits, and hyphens'),
  }),
});
