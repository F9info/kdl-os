import { z } from 'zod'

export const sectorSchema = z.object({
  eyebrow: z.string().max(200).optional(),
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  category: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  image: z.string().max(500).optional(),
  cta_label: z.string().max(100).optional(),
  cta_href: z.string().max(500).optional(),
  seo_title: z.string().max(200).optional(),
  seo_description: z.string().max(500).optional(),
  og_image: z.string().max(500).optional(),
  canonical_url: z.string().max(500).optional(),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type SectorFormData = z.infer<typeof sectorSchema>
