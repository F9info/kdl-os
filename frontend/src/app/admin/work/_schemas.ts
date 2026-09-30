import { z } from 'zod'

export const workSchema = z.object({
  eyebrow: z.string().max(200).optional(),
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  subtitle: z.string().max(4000).optional(),
  image: z.string().max(500).optional(),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type WorkFormData = z.infer<typeof workSchema>
