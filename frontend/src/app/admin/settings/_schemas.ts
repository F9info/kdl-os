import { z } from 'zod'

export const settingSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, and underscores only'),
  value: z.string().min(1, 'Value is required'),
  type: z.enum(['string', 'number', 'boolean', 'json']),
  description: z.string().max(500).optional(),
  is_public: z.boolean(),
})

export type SettingFormData = z.infer<typeof settingSchema>
