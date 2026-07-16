import { z } from 'zod';

const PROVIDERS = ['local', 'minio', 's3', 'spaces', 'r2'];

const settingsBody = z.object({
  provider: z.enum(PROVIDERS).optional(),
  endpoint: z.string().url().nullable().optional(),
  region: z.string().nullable().optional(),
  bucket: z.string().nullable().optional(),
  accessKey: z.string().nullable().optional(),
  secretKey: z.string().nullable().optional(),
});

export const updateStorageSettingsSchema = z.object({ body: settingsBody });
export const testStorageConnectionSchema = z.object({ body: settingsBody.optional().default({}) });
