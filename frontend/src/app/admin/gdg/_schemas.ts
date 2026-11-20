import { z } from 'zod'

export const CATEGORIES = [
  'DevFest',
  'Women Techmakers',
  'I/O Extended',
  'Study Jams',
  'Build with AI',
  'Workshops and talks',
  'Meetups',
] as const

const link = z
  .string()
  .max(1000)
  .refine(
    (v) => v === '' || /^https?:\/\/\S+$/i.test(v) || v.startsWith('/'),
    'Use a full http(s) link or a site path'
  )

export const eventSchema = z
  .object({
    title: z.string().trim().min(2, 'Title is required').max(200),
    start_date: z.string().min(1, 'Start is required'),
    end_date: z.string(),
    venue: z.string().max(300),
    event_type: z.string().max(100),
    image_url: link,
    register_url: link,
    description: z.string().max(2000),
    category: z.string(),
    is_featured: z.boolean(),
    is_hidden: z.boolean(),
  })
  .refine((e) => !e.end_date || e.end_date >= e.start_date, {
    message: 'The end must be after the start',
    path: ['end_date'],
  })

export type EventFormData = z.infer<typeof eventSchema>

export const syncSchema = z.object({
  chapter_id: z.string().regex(/^\d*$/, 'Numbers only'),
  chapter_slug: z
    .string()
    .regex(/^([a-z0-9-]{2,100})?$/, 'Use the slug from the chapter URL, e.g. gdg-vizag'),
  auto_sync: z.boolean(),
})

export type SyncFormData = z.infer<typeof syncSchema>
