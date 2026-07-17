import { z } from 'zod';

export const createTemplateSchema = z.object({
  slug: z.string().min(1).max(128).regex(/^[a-z0-9_-]+$/, 'slug must be lowercase alphanumeric with hyphens/underscores'),
  category_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  variables: z.array(z.string()).optional(),
  in_app_body: z.string().max(4096).nullable().optional(),
  email_subject: z.string().max(512).nullable().optional(),
  email_body: z.string().max(65536).nullable().optional(),
  sms_body: z.string().max(1600).nullable().optional(),
  whatsapp_body: z.string().max(4096).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createCategorySchema = z.object({
  slug: z.string().min(1).max(128).regex(/^[a-z0-9_-]+$/, 'slug must be lowercase alphanumeric with hyphens/underscores'),
  name: z.string().min(1).max(255),
  description: z.string().max(1024).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1024).nullable().optional(),
});

export const broadcastSchema = z.object({
  to: z.object({
    role_slug: z.string().optional(),
    all: z.boolean().optional(),
  }),
  template: z.string().optional(),
  inline: z.object({
    title: z.string().max(255).optional(),
    body: z.string().max(4096),
    icon: z.string().max(128).optional(),
    action_url: z.string().url().optional(),
  }).optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'])).optional(),
  data: z.record(z.unknown()).optional(),
});

// Legacy exports kept for any existing imports
export const createNotificationsSchema = createTemplateSchema;
export const updateNotificationsSchema = updateTemplateSchema;
