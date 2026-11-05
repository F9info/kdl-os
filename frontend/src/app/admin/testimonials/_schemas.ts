import { z } from 'zod'

export const testimonialSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  role: z.string().max(200).optional(),
  quote: z.string().min(1, 'Quote is required').max(2000),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type TestimonialFormData = z.infer<typeof testimonialSchema>
