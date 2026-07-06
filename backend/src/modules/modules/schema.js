import { z } from 'zod';

export const settingsPatchSchema = z.object({
  body: z.object({
    settings: z.record(z.unknown()),
  }),
});
