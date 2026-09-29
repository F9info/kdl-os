import { z } from 'zod'

export const catalogItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  category: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  image: z.string().max(500).optional(),
  brand_tag: z.string().max(300).optional(),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type CatalogItemFormData = z.infer<typeof catalogItemSchema>
