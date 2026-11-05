import { z } from 'zod'

export const newLandingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  template: z.string().min(1),
})

export type NewLandingForm = z.infer<typeof newLandingSchema>
