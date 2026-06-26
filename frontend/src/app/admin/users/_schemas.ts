import { z } from 'zod'

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email'),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']),
  is_active: z.boolean(),
})

export type UpdateUserFormData = z.infer<typeof updateUserSchema>
