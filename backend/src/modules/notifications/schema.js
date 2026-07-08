import { z } from 'zod';

export const createNotificationsSchema = z.object({
  // TODO: add fields
});

export const updateNotificationsSchema = createNotificationsSchema.partial();
