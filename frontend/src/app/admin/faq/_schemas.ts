import { z } from 'zod'

export const faqSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
  answer: z.string().min(1, 'Answer is required').max(4000),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type FaqFormData = z.infer<typeof faqSchema>
