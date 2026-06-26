import { z } from 'zod'

export const typeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  is_active: z.boolean(),
})

export type TypeFormData = z.infer<typeof typeSchema>
