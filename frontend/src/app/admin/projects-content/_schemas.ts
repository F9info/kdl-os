import { z } from 'zod'

export const caseStudySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  eyebrow: z.string().max(200).optional(),
  tags: z.string().max(500).optional(),
  image: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  cta_label: z.string().max(100).optional(),
  cta_href: z.string().max(500).optional(),
  link_label: z.string().max(200).optional(),
  link_href: z.string().max(500).optional(),
  order: z.number().int(),
  is_active: z.boolean(),
})

export type CaseStudyFormData = z.infer<typeof caseStudySchema>
