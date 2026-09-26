import { z } from 'zod';

export const listFaqsSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getFaqSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createFaqSchema = z.object({
  body: z.object({
    project_id: z.string().min(1).nullish(),
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(4000),
    order: z.number().int().default(0),
    is_active: z.boolean().default(true),
  }),
});

export const updateFaqSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    project_id: z.string().min(1).nullish(),
    question: z.string().min(1).max(500).optional(),
    answer: z.string().min(1).max(4000).optional(),
    order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteFaqSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
