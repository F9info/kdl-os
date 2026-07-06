import { z } from 'zod';

export const settingsPatchSchema = z.object({
  settings: z.record(z.unknown()),
});
