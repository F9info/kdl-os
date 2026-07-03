import { z } from 'zod';

export const listActivityLogSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    actor: z.string().optional(),
    module: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});
