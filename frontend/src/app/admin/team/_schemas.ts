import { z } from 'zod'

export const teamMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  role: z.string().min(1, 'Role is required').max(150),
  bio: z.string().max(2000).optional(),
  photo_url: z.string().max(500).optional(),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type TeamMemberFormData = z.infer<typeof teamMemberSchema>
