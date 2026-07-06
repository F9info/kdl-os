import { z } from 'zod'

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email'),
  role_ids: z.array(z.string()).min(1, 'Assign at least one role'),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']),
  is_active: z.boolean(),
})

export type UpdateUserFormData = z.infer<typeof updateUserSchema>

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
