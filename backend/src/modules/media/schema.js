import { z } from 'zod';

export const uploadMediaSchema = z.object({});

export const listMediaSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const deleteMediaSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
