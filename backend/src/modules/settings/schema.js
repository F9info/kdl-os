import { z } from 'zod';

export const listSettingsSchema = z.object({});

export const getSettingSchema = z.object({
  params: z.object({
    key: z.string().min(1),
  }),
});

export const createSettingSchema = z.object({
  body: z.object({
    key: z.string().min(1).max(100),
    value: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
    description: z.string().optional(),
    is_public: z.boolean().default(false),
  }),
});

export const updateSettingSchema = z.object({
  params: z.object({
    key: z.string().min(1),
  }),
  body: z.object({
    value: z.string(),
  }),
});

export const deleteSettingSchema = z.object({
  params: z.object({
    key: z.string().min(1),
  }),
});
