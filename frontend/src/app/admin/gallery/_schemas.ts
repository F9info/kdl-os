import { z } from 'zod'

export const gallerySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  image_url: z.string().min(1, 'Image address is required').max(2000),
  caption: z.string().max(1000).optional(),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type GalleryFormData = z.infer<typeof gallerySchema>
