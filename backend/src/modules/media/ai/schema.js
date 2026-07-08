import { z } from 'zod';

const featureEnum = z.enum(['vision', 'image_ops', 'speech_to_text']);

export const createAiProviderSchema = z.object({
  feature: featureEnum,
  driver: z.string().min(1),
  name: z.string().min(1).max(100),
  credentials: z.record(z.unknown()),
  config: z.record(z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

export const updateAiProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});
