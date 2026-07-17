import { z } from 'zod';

// Mirrors the NotificationChannel Prisma enum.
export const channelEnum = z.enum(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']);

const slug = z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'invalid slug');
const cuid = z.string().min(1).max(64);

// Template variable values: flat primitives only — rendered into text bodies.
const templateData = z.record(z.union([z.string(), z.number(), z.boolean()])).default({});

export const idParamSchema = z.object({
  params: z.object({ id: cuid }),
});

// ─── Preferences ─────────────────────────────────────────────────────────────

export const updatePreferencesSchema = z.object({
  body: z.object({
    preferences: z.array(
      z.object({
        category_id: cuid,
        channel: channelEnum,
        enabled: z.boolean(),
      }).strict(),
    ).min(1).max(200),
  }).strict(),
});

// ─── Templates ────────────────────────────────────────────────────────────────

const templateBodyFields = {
  slug,
  category_id: cuid,
  name: z.string().min(1).max(200),
  variables: z.array(z.string().min(1).max(100)).max(50),
  in_app_body: z.string().max(10_000).nullable(),
  email_subject: z.string().max(500).nullable(),
  email_body: z.string().max(100_000).nullable(),
  sms_body: z.string().max(1_000).nullable(),
  whatsapp_body: z.string().max(10_000).nullable(),
  is_active: z.boolean(),
};

export const createTemplateSchema = z.object({
  body: z.object({
    ...templateBodyFields,
    variables: templateBodyFields.variables.default([]),
    in_app_body: templateBodyFields.in_app_body.optional(),
    email_subject: templateBodyFields.email_subject.optional(),
    email_body: templateBodyFields.email_body.optional(),
    sms_body: templateBodyFields.sms_body.optional(),
    whatsapp_body: templateBodyFields.whatsapp_body.optional(),
    is_active: templateBodyFields.is_active.default(true),
  }).strict(),
});

// Whitelist for PATCH — unknown keys rejected so `data: req.body`-style mass
// assignment (created_at, id, …) is impossible (KDL-270 M14).
export const updateTemplateSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    slug: slug.optional(),
    category_id: cuid.optional(),
    name: templateBodyFields.name.optional(),
    variables: templateBodyFields.variables.optional(),
    in_app_body: templateBodyFields.in_app_body.optional(),
    email_subject: templateBodyFields.email_subject.optional(),
    email_body: templateBodyFields.email_body.optional(),
    sms_body: templateBodyFields.sms_body.optional(),
    whatsapp_body: templateBodyFields.whatsapp_body.optional(),
    is_active: templateBodyFields.is_active.optional(),
  }).strict(),
});

export const previewTemplateSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    data: templateData,
  }).strict(),
});

// ─── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  body: z.object({
    slug,
    name: z.string().min(1).max(200),
    description: z.string().max(1_000).nullable().optional(),
  }).strict(),
});

// is_system deliberately absent — not settable via API.
export const updateCategorySchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    slug: slug.optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1_000).nullable().optional(),
  }).strict(),
});

// ─── Broadcast ────────────────────────────────────────────────────────────────

export const broadcastSchema = z.object({
  body: z.object({
    to: z.object({
      role_slug: slug.optional(),
      all: z.boolean().optional(),
    }).strict(),
    template: slug.optional(),
    inline: z.object({
      title: z.string().min(1).max(500),
      body: z.string().min(1).max(10_000),
    }).strict().optional(),
    channels: z.array(channelEnum).min(1).max(4).optional(),
    data: templateData.optional(),
  }).strict(),
});
