import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  type_id: z.string().optional(),
  is_active: z.boolean(),
})

export type CategoryFormData = z.infer<typeof categorySchema>
