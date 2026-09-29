import { z } from 'zod';

export const getDetailPageTypesSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
  }),
});
