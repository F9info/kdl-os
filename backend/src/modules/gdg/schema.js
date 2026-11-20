import { z } from 'zod';
import { CATEGORY_NAMES } from './chapter-feed.js';

const optionalText = (max) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v ? v.trim() || null : null));
const optionalUrl = z
  .string()
  .max(1000)
  .nullish()
  .transform((v) => (v ? v.trim() || null : null))
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v) || v.startsWith('/'), 'Use a full http(s) link or a site path');

const eventFields = {
  project_id: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(200),
  start_date: z.coerce.date(),
  end_date: z.coerce.date().nullish(),
  venue: optionalText(300),
  event_type: optionalText(100),
  image_url: optionalUrl,
  banner_url: optionalUrl,
  register_url: optionalUrl,
  page_url: optionalUrl,
  description: optionalText(2000),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  category: z.enum(CATEGORY_NAMES).nullish(),
  is_featured: z.boolean().default(false),
  is_hidden: z.boolean().default(false),
};

const idParams = z.object({ id: z.string().min(1) });

export const listEventsSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    source: z.enum(['manual', 'gdg']).optional(),
  }),
});

export const getEventSchema = z.object({ params: idParams });

export const createEventSchema = z.object({
  body: z
    .object(eventFields)
    .refine((e) => !e.end_date || e.end_date >= e.start_date, { message: 'The end must be after the start', path: ['end_date'] }),
});

export const updateEventSchema = z.object({
  params: idParams,
  body: z.object(eventFields).partial(),
});

export const deleteEventSchema = z.object({ params: idParams });

export const projectQuerySchema = z.object({
  query: z.object({ project_id: z.string().min(1).optional() }),
});

export const saveSyncSchema = z.object({
  query: z.object({ project_id: z.string().min(1).optional() }),
  body: z.object({
    project_id: z.string().min(1).optional(),
    chapter_id: z.coerce.number().int().positive().max(10_000_000).nullable(),
    chapter_slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{2,100}$/, 'Use the slug from the chapter URL, e.g. gdg-vizag')
      .nullable(),
    auto_sync: z.boolean().default(true),
  }),
});
