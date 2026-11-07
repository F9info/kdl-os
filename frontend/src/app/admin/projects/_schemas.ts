import { z } from 'zod'
import { OPTIONAL_KINDS, PROJECT_STATUSES } from '@/admin/lib/project-kinds'

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  // ADMIN is always on and is not a choice, so only the optional kinds are in the form.
  kinds: z.array(z.enum(OPTIONAL_KINDS)),
  status: z.enum(PROJECT_STATUSES),
})

export type ProjectForm = z.infer<typeof projectFormSchema>
