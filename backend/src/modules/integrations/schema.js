import { z } from 'zod';

export const createProviderSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  driver: z.string().min(1),
  name: z.string().min(1).max(100),
  credentials: z.record(z.unknown()),
  config: z.record(z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(false),
  is_default: z.boolean().optional().default(false),
  is_fallback: z.boolean().optional().default(false),
});

export const updateProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  is_fallback: z.boolean().optional(),
});

export const testSendSchema = z.object({
  to: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export const getLogsQuerySchema = z.object({
  query: z.object({
    channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']).optional(),
    status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']).optional(),
    source: z.string().max(100).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});
